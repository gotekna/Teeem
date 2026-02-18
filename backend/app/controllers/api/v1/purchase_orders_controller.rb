module Api
  module V1
    class PurchaseOrdersController < ApplicationController
      include AsyncPdfGeneration
      before_action :set_purchase_order, only: [ :show, :update, :destroy, :approve, :send_to_supplier, :mark_received, :attach_documents, :available_documents, :generate_pdf, :schedule_sync_preview, :schedule_sync, :lock_budget, :unlock_budget, :save_pdf, :send_email, :bills ]

      # GET /api/v1/purchase_orders
      # Params: construction_id, supplier_id, status, search, sort_by, sort_direction, page, per_page
      def index
        @purchase_orders = PurchaseOrder.includes(
          :supplier,
          :job,
          :sm_task,  # SSoT: SmTask is THE ONE task system (belongs_to association)
          line_items: :pricebook_item
        ).all

        # Filters
        @purchase_orders = @purchase_orders.by_construction(params[:job_id])
        @purchase_orders = @purchase_orders.by_status(params[:status])
        @purchase_orders = @purchase_orders.where(supplier_id: params[:supplier_id]) if params[:supplier_id].present?

        # Search using SSoT SearchService
        # Note: Task name search via sm_task.name handled by Foundation API
        if params[:search].present?
          @purchase_orders = SearchService.apply(
            @purchase_orders,
            params[:search],
            columns: %w[purchase_order_number description],
            mode: params[:search_mode] || 'contains',
            model: PurchaseOrder
          )
        end

        # Date range filter
        if params[:start_date].present? && params[:end_date].present?
          @purchase_orders = @purchase_orders.where(
            required_date: Date.parse(params[:start_date])..Date.parse(params[:end_date])
          )
        end

        # Sorting
        sort_by = params[:sort_by] || "created_at"
        sort_direction = params[:sort_direction] || "desc"
        allowed_sort_columns = %w[purchase_order_number total required_date status created_at]
        sort_column = allowed_sort_columns.include?(sort_by) ? sort_by : "created_at"

        @purchase_orders = @purchase_orders.order("#{sort_column} #{sort_direction}")

        # Pagination
        page = params[:page]&.to_i || 1
        per_page = [ params[:per_page]&.to_i || 50, 100 ].min  # Default 50, max 100
        total_count = @purchase_orders.count
        total_pages = (total_count.to_f / per_page).ceil

        @purchase_orders = @purchase_orders.limit(per_page).offset((page - 1) * per_page)

        render json: {
          purchase_orders: @purchase_orders.as_json(
            include: {
              supplier: { methods: [ :display_name ] },
              job: {
                methods: [ :site_supervisor_info ]
              },
              line_items: {
                include: { pricebook_item: {} },
                methods: [ :price_drift, :price_outdated?, :price_status, :price_status_label ]
              }
            },
            methods: [ :timing_warnings, :delivery_aligned_with_tasks? ]
          ),
          pagination: {
            current_page: page,
            total_pages: total_pages,
            total_count: total_count,
            per_page: per_page
          }
        }
      end

      # GET /api/v1/purchase_orders/:id
      def show
        company_setting = TenantSetting.instance

        # Build sm_tasks array for frontend (backwards compatibility)
        sm_tasks_json = @purchase_order.sm_tasks.map do |task|
          task.as_json(methods: [ :materials_status ])
        end

        po_json = @purchase_order.as_json(
          include: {
            supplier: { methods: [ :display_name ] },
            job: {
              methods: [ :site_supervisor_info ]
            },
            line_items: {
              include: {
                pricebook_item: {
                  methods: [ :active_price ],
                  include: { default_supplier: { methods: [ :display_name ] } }
                },
                profit_centre: { only: [ :id, :code, :name ] }
              },
              methods: [ :price_drift, :price_outdated?, :price_status, :price_status_label ]
            },
            document_tasks: {
              methods: [ :document_url ]
            }
          },
          methods: [ :timing_warnings, :delivery_aligned_with_tasks? ]
        )

        # Add supplied_pricebook_item_ids to supplier for frontend line item warnings
        if @purchase_order.supplier_id.present?
          pricebook_item_ids = @purchase_order.line_items.pluck(:pricebook_item_id).compact
          if pricebook_item_ids.any?
            supplied_ids = PriceHistory
              .where(supplier_id: @purchase_order.supplier_id, pricebook_item_id: pricebook_item_ids)
              .distinct
              .pluck(:pricebook_item_id)
            po_json["supplier"]["supplied_pricebook_item_ids"] = supplied_ids
          end
        end

        render json: {
          **po_json,
          sm_tasks: sm_tasks_json,  # SSoT: Backwards-compatible array format for frontend
          company_setting: company_setting.as_json
        }
      end

      # GET /api/v1/purchase_orders/:id/bills
      # Returns matched BillInbox records for this PO (for side-by-side modal)
      def bills
        bills = BillInbox.includes(:corporate, :detected_company, :supplier, :approved_by, :bill_payments)
                         .where(matched_purchase_order_id: @purchase_order.id)
                         .order(created_at: :desc)

        render json: {
          bills: bills.map do |bill|
            xero_tenant_name = bill.corporate&.corporate_xero_connection&.xero_tenant_name

            bill.as_json(
              include: {
                corporate: {},
                detected_company: {},
                supplier: {},
                matched_purchase_order: {
                  include: { supplier: {} }
                },
                approved_by: {},
                bill_payments: {
                  include: { bill_payment_batch: {} }
                }
              },
              methods: [ :remaining_balance, :variance_percent, :status_color, :has_invoice_file?, :invoice_file_content_type, :invoice_file_filename ]
            ).merge(
              ai_extraction_result: bill.ai_extraction_result,
              ocr_extraction_result: bill.ocr_extraction_result,
              comparison_data: bill.comparison_data,
              contact_comparison_data: bill.contact_comparison_data,
              extracted_at: bill.extracted_at,
              xero_tenant_name: xero_tenant_name
            )
          end,
          total_count: bills.size
        }
      end

      # POST /api/v1/purchase_orders
      def create
        schedule_task_id = params[:purchase_order][:schedule_task_id]
        task_template_id = params[:purchase_order][:task_template_id]
        task_name = params[:purchase_order][:task_name]

        @purchase_order = PurchaseOrder.new(purchase_order_params.except(:schedule_task_id, :task_template_id, :task_name))

        ActiveRecord::Base.transaction do
          if @purchase_order.save
            # SSoT: Link PO to task via sm_task_id (Option B - single column)
            if schedule_task_id.present?
              # Link to existing task
              sm_task = SmTask.find(schedule_task_id)
              @purchase_order.update!(sm_task_id: sm_task.id)

              # Spawn Order/Call tasks if configured on the task
              spawn_result = SmPoSpawnService.new(sm_task, user: current_user).spawn!
              if spawn_result[:spawned_tasks].any?
                Rails.logger.info("[PurchaseOrdersController] Spawned #{spawn_result[:spawned_tasks].count} tasks for PO ##{@purchase_order.id}")
              end
            elsif task_template_id.present? || task_name.present?
              # Create new task from template or custom name
              # Calculate sensible defaults for required fields
              today = Date.current
              max_sequence = SmTask.where(job_id: @purchase_order.job_id).maximum(:sequence_order) || 0
              template = task_template_id.present? ? SmScheduleMaster.find(task_template_id) : nil

              sm_task = SmTask.create!(
                job_id: @purchase_order.job_id,
                sm_schedule_master_id: task_template_id.presence,
                name: task_name.presence || template&.name || "PO Task",
                supplier_id: @purchase_order.supplier_id,
                status: "not_started",
                # Required fields with sensible defaults
                sequence_order: max_sequence + 1,
                start_date: today,
                duration_days: template&.duration_days || 1,
                # Use provided assignment, or default to current user
                assigned_user_id: params[:purchase_order][:assigned_user_id].presence || current_user.id,
                assigned_role: params[:purchase_order][:assigned_role].presence,
                # Audit
                created_by: current_user,
                updated_by: current_user
              )
              @purchase_order.update!(sm_task_id: sm_task.id)
              Rails.logger.info("[PurchaseOrdersController] Created task '#{sm_task.name}' for PO ##{@purchase_order.id}")
            end

            render json: @purchase_order.as_json(include: :line_items), status: :created
          else
            render json: { errors: @purchase_order.errors.full_messages }, status: :unprocessable_entity
          end
        end
      rescue ActiveRecord::RecordNotFound => e
        render json: { errors: [ "#{e.model || 'Record'} not found" ] }, status: :unprocessable_entity
      rescue => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      end

      # PATCH/PUT /api/v1/purchase_orders/:id
      def update
        unless @purchase_order.can_edit?
          render json: { error: "Cannot edit purchase order in current status" }, status: :unprocessable_entity
          return
        end

        schedule_task_id = params[:purchase_order][:schedule_task_id]

        ActiveRecord::Base.transaction do
          # Update the PO
          if @purchase_order.update(purchase_order_params.except(:schedule_task_id))
            # SSoT: Handle task link changes via sm_task_id (Option B - single column)
            if schedule_task_id.present?
              # Link the new task to this PO
              sm_task = SmTask.find(schedule_task_id)
              @purchase_order.update!(sm_task_id: sm_task.id)
            elsif params[:purchase_order].key?(:schedule_task_id) && schedule_task_id.nil?
              # Explicitly setting to nil - unlink task
              @purchase_order.update!(sm_task_id: nil)
            end

            render json: @purchase_order.as_json(include: :line_items)
          else
            render json: { errors: @purchase_order.errors.full_messages }, status: :unprocessable_entity
          end
        end
      rescue ActiveRecord::RecordNotFound
        render json: { errors: [ "Schedule task not found" ] }, status: :unprocessable_entity
      rescue => e
        render json: { errors: [ e.message ] }, status: :unprocessable_entity
      end

      # DELETE /api/v1/purchase_orders/:id
      def destroy
        unless @purchase_order.can_cancel?
          render json: { error: "Cannot delete purchase order in current status" }, status: :unprocessable_entity
          return
        end

        @purchase_order.destroy
        head :no_content
      end

      # POST /api/v1/purchase_orders/:id/approve
      def approve
        unless @purchase_order.can_approve?
          render json: { error: "Purchase order cannot be approved in current status" }, status: :unprocessable_entity
          return
        end

        if @purchase_order.approve!
          render json: @purchase_order
        else
          render json: { errors: @purchase_order.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/purchase_orders/:id/send_to_supplier
      def send_to_supplier
        if @purchase_order.send_to_supplier!
          render json: @purchase_order
        else
          render json: { errors: @purchase_order.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/purchase_orders/:id/mark_received
      def mark_received
        if @purchase_order.mark_received!
          render json: @purchase_order
        else
          render json: { errors: @purchase_order.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/purchase_orders/:id/lock_budget
      # Lock the budget from the current PO total
      def lock_budget
        if @purchase_order.budget_locked?
          return render_error("Budget is already locked", status: :unprocessable_entity)
        end

        if @purchase_order.lock_budget!(current_user)
          render json: {
            success: true,
            data: @purchase_order.as_json(include: :line_items),
            message: "Budget locked at #{helpers.number_to_currency(@purchase_order.budget)}"
          }
        else
          render_error("Failed to lock budget", status: :unprocessable_entity)
        end
      end

      # POST /api/v1/purchase_orders/:id/unlock_budget
      # Unlock the budget (admin only)
      def unlock_budget
        unless current_user&.admin?
          return render_error("You don't have permission to unlock budgets", status: :forbidden)
        end

        unless @purchase_order.budget_locked?
          return render_error("Budget is not locked", status: :unprocessable_entity)
        end

        reason = params[:reason]
        if @purchase_order.unlock_budget!(current_user, reason: reason)
          render json: {
            success: true,
            data: @purchase_order.as_json(include: :line_items),
            message: "Budget unlocked"
          }
        else
          render_error("Failed to unlock budget", status: :unprocessable_entity)
        end
      end

      # POST /api/v1/purchase_orders/toggle_budget_lock
      # Toggle budget lock for multiple POs - locks unlocked ones, unlocks locked ones
      # Unlocking requires admin permission
      def toggle_budget_lock
        ids = params[:ids]
        return render_error("No PO IDs provided", status: :bad_request) if ids.blank?

        purchase_orders = PurchaseOrder.where(id: ids)

        if purchase_orders.count != ids.count
          return render_error("Some PO IDs not found", status: :not_found)
        end

        locked_pos = purchase_orders.select(&:budget_locked?)
        unlocked_pos = purchase_orders.reject(&:budget_locked?)

        # Determine action based on majority or all same state
        if locked_pos.empty?
          # All unlocked -> lock them
          action = :lock
        elsif unlocked_pos.empty?
          # All locked -> unlock them (admin only)
          action = :unlock
        else
          # Mixed state - lock the unlocked ones
          action = :lock
          purchase_orders = unlocked_pos
        end

        # Admin check for unlock
        if action == :unlock && !current_user&.admin?
          return render_error("Only admins can unlock budgets", status: :forbidden)
        end

        ActiveRecord::Base.transaction do
          purchase_orders.each do |po|
            if action == :lock
              po.lock_budget!(current_user)
            else
              po.unlock_budget!(current_user, reason: "Bulk unlock from PO list")
            end
          end
        end

        render json: {
          success: true,
          action: action,
          message: "#{purchase_orders.count} PO budget(s) #{action == :lock ? 'locked' : 'unlocked'}",
          count: purchase_orders.count
        }
      rescue ActiveRecord::RecordInvalid => e
        render_error("Failed to #{action} budgets: #{e.message}", status: :unprocessable_entity)
      end

      # POST /api/v1/purchase_orders/bulk_lock_budget
      # Lock budgets for multiple POs in a single transaction (all or nothing)
      def bulk_lock_budget
        ids = params[:ids]
        return render_error("No PO IDs provided", status: :bad_request) if ids.blank?

        purchase_orders = PurchaseOrder.where(id: ids)

        if purchase_orders.count != ids.count
          return render_error("Some PO IDs not found", status: :not_found)
        end

        # Check if any are already locked
        already_locked = purchase_orders.select(&:budget_locked?)
        if already_locked.any?
          return render json: {
            success: false,
            error: "#{already_locked.count} PO(s) already locked: #{already_locked.map(&:purchase_order_number).join(', ')}"
          }, status: :unprocessable_entity
        end

        # Lock all in a transaction
        ActiveRecord::Base.transaction do
          purchase_orders.each do |po|
            po.lock_budget!(current_user)
          end
        end

        render json: {
          success: true,
          message: "#{purchase_orders.count} PO budget(s) locked",
          count: purchase_orders.count
        }
      rescue ActiveRecord::RecordInvalid => e
        render_error("Failed to lock budgets: #{e.message}", status: :unprocessable_entity)
      end

      # POST /api/v1/purchase_orders/bulk_unlock_budget
      # Unlock budgets for multiple POs in a single transaction (all or nothing, admin only)
      def bulk_unlock_budget
        unless current_user&.admin?
          return render_error("You don't have permission to unlock budgets", status: :forbidden)
        end

        ids = params[:ids]
        reason = params[:reason] || "Bulk unlock"
        return render_error("No PO IDs provided", status: :bad_request) if ids.blank?

        purchase_orders = PurchaseOrder.where(id: ids)

        if purchase_orders.count != ids.count
          return render_error("Some PO IDs not found", status: :not_found)
        end

        # Check if any are not locked
        not_locked = purchase_orders.reject(&:budget_locked?)
        if not_locked.any?
          return render json: {
            success: false,
            error: "#{not_locked.count} PO(s) not locked: #{not_locked.map(&:purchase_order_number).join(', ')}"
          }, status: :unprocessable_entity
        end

        # Unlock all in a transaction
        ActiveRecord::Base.transaction do
          purchase_orders.each do |po|
            po.unlock_budget!(current_user, reason: reason)
          end
        end

        render json: {
          success: true,
          message: "#{purchase_orders.count} PO budget(s) unlocked",
          count: purchase_orders.count
        }
      rescue ActiveRecord::RecordInvalid => e
        render_error("Failed to unlock budgets: #{e.message}", status: :unprocessable_entity)
      end

      # POST /api/v1/purchase_orders/match_xero_bills
      # Fetch Xero bills for a job, match to native POs, update Xero Reference field
      # Params: { job_id: required }
      def match_xero_bills
        return render json: { success: false, error: "job_id is required" }, status: :bad_request if params[:job_id].blank?

        job = Job.find(params[:job_id])
        service = XeroBillPoMatcherService.new(job: job)
        result = service.match_and_update!

        render json: {
          success: true,
          data: result,
          message: "Found #{result[:bills_found]} Xero bills, matched #{result[:matched]}, updated #{result[:updated_xero]} in Xero"
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Job not found" }, status: :not_found
      rescue XeroApiClient::AuthenticationError => e
        render json: { success: false, error: "Xero authentication failed: #{e.message}" }, status: :unauthorized
      rescue StandardError => e
        Rails.logger.error("[MatchXeroBills] Failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/purchase_orders/smart_lookup
      # Smart lookup for PO auto-population
      # Params: { construction_id, task_description, category, quantity, supplier_preference }
      def smart_lookup
        service = SmartPoLookupService.new(construction_id: params[:job_id])
        result = service.lookup(
          task_description: params[:task_description],
          category: params[:category],
          quantity: params[:quantity] || 1,
          supplier_preference: params[:supplier_preference]
        )

        render json: result
      end

      # POST /api/v1/purchase_orders/smart_create
      # Create PO with smart auto-population
      def smart_create
        service = SmartPoLookupService.new(construction_id: params[:job_id])
        lookup_result = service.lookup(
          task_description: params[:task_description],
          category: params[:category],
          quantity: params[:quantity] || 1,
          supplier_preference: params[:supplier_preference]
        )

        unless lookup_result[:success]
          render json: { errors: lookup_result[:warnings] }, status: :unprocessable_entity
          return
        end

        # Build PO from lookup result (SSoT: use notes alias for description column - hidden from UI)
        @purchase_order = PurchaseOrder.new(
          construction_id: params[:job_id],
          supplier_id: lookup_result[:supplier].id,
          notes: params[:task_description],
          delivery_address: lookup_result[:metadata][:delivery_address],
          status: params[:status] || "draft",
          required_date: params[:required_date],
          budget: lookup_result[:total_with_gst],
          line_items_attributes: [
            {
              description: params[:task_description],
              quantity: params[:quantity] || 1,
              unit_price: lookup_result[:unit_price],
              pricebook_item_id: lookup_result[:price_book_item]&.id
            }
          ]
        )

        if @purchase_order.save
          render json: {
            purchase_order: @purchase_order.as_json(include: :line_items),
            lookup_metadata: lookup_result[:metadata],
            warnings: lookup_result[:warnings]
          }, status: :created
        else
          render json: { errors: @purchase_order.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/purchase_orders/bulk_create
      # Create multiple POs from JSON array
      # Params: { construction_id, purchase_orders: [{task_description, category, quantity, supplier_preference}] }
      def bulk_create
        service = SmartPoLookupService.new(construction_id: params[:job_id])
        po_requests = params[:purchase_orders] || []

        results = []
        errors = []

        po_requests.each_with_index do |po_request, index|
          lookup_result = service.lookup(
            task_description: po_request[:task_description],
            category: po_request[:category],
            quantity: po_request[:quantity] || 1,
            supplier_preference: po_request[:supplier_preference]
          )

          if lookup_result[:success]
            # SSoT: use notes alias for description column - hidden from UI
            purchase_order = PurchaseOrder.new(
              construction_id: params[:job_id],
              supplier_id: lookup_result[:supplier].id,
              notes: po_request[:task_description],
              delivery_address: lookup_result[:metadata][:delivery_address],
              status: po_request[:status] || "draft",
              required_date: po_request[:required_date],
              budget: lookup_result[:total_with_gst],
              line_items_attributes: [
                {
                  description: po_request[:task_description],
                  quantity: po_request[:quantity] || 1,
                  unit_price: lookup_result[:unit_price],
                  pricebook_item_id: lookup_result[:price_book_item]&.id
                }
              ]
            )

            if purchase_order.save
              results << {
                index: index,
                success: true,
                purchase_order: purchase_order.as_json(include: :line_items),
                warnings: lookup_result[:warnings]
              }
            else
              errors << {
                index: index,
                task_description: po_request[:task_description],
                errors: purchase_order.errors.full_messages
              }
            end
          else
            errors << {
              index: index,
              task_description: po_request[:task_description],
              errors: lookup_result[:warnings]
            }
          end
        end

        render json: {
          success: errors.empty?,
          created: results.length,
          failed: errors.length,
          results: results,
          errors: errors
        }, status: errors.empty? ? :created : :unprocessable_entity
      end

      # GET /api/v1/purchase_orders/:id/available_documents
      # Get all documents from the associated job that can be attached to this PO
      # Performance: Pre-cache attached IDs to avoid N+1
      def available_documents
        documents = DocumentTask.where(job_id: @purchase_order.job_id)
                                 .order(:category, :name)

        # Performance: Cache attached IDs as a Set for O(1) lookup
        attached_ids = @purchase_order.document_task_ids.to_set

        render json: {
          documents: documents.map do |doc|
            {
              id: doc.id,
              name: doc.name,
              description: doc.description,
              category: doc.category,
              has_document: doc.has_document,
              is_validated: doc.is_validated,
              document_url: doc.document_url,
              uploaded_at: doc.uploaded_at,
              is_attached: attached_ids.include?(doc.id)
            }
          end
        }
      end

      # POST /api/v1/purchase_orders/:id/attach_documents
      # Attach or detach documents from this PO
      # Params: { document_task_ids: [1, 2, 3] }
      def attach_documents
        document_task_ids = params[:document_task_ids] || []

        # Validate that all document tasks belong to the same construction
        if document_task_ids.any?
          invalid_docs = DocumentTask.where(id: document_task_ids)
                                     .where.not(construction_id: @purchase_order.job_id)

          if invalid_docs.any?
            return render json: {
              error: "Some documents do not belong to this job"
            }, status: :unprocessable_entity
          end
        end

        # Replace all document associations with the new list
        @purchase_order.document_task_ids = document_task_ids

        render json: {
          message: "Documents updated successfully",
          attached_count: document_task_ids.length,
          document_tasks: @purchase_order.document_tasks.map do |doc|
            {
              id: doc.id,
              name: doc.name,
              description: doc.description,
              category: doc.category,
              has_document: doc.has_document,
              is_validated: doc.is_validated,
              document_url: doc.document_url
            }
          end
        }
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/purchase_orders/:id/generate_pdf
      # Generate PDF for this purchase order with colour selections from job (SSoT)
      def generate_pdf
        if params[:format] == "html" || params[:preview]
          generator = TeknaDocumentGenerator.new(:purchase_order)
          result = generator.generate(purchase_order: @purchase_order, html_only: true)
          render html: result[:html].html_safe
        else
          enqueue_pdf_and_respond(
            generator_type: "tekna_document",
            generator_params: { template_key: "purchase_order", purchase_order_id: @purchase_order.id }
          )
        end
      rescue TeknaDocumentGenerator::GenerationError => e
        render json: { error: e.message }, status: :unprocessable_entity
      rescue => e
        render json: { error: "Failed to generate PDF: #{e.message}" }, status: :internal_server_error
      end

      # GET /api/v1/purchase_orders/:id/schedule_sync_preview
      # Preview sync with Schedule Master - shows comparison, blockers, and what would change
      # SSoT: Schedule Master (SmTask) is the source of truth for dates
      def schedule_sync_preview
        service = PoScheduleSyncService.new(@purchase_order)
        render json: { success: true, data: service.preview }
      rescue => e
        render_error(e.message, status: :internal_server_error)
      end

      # POST /api/v1/purchase_orders/:id/schedule_sync
      # Execute sync from Schedule Master - updates PO dates from linked task(s)
      # Direction: Task → PO (safe - no cascade storms)
      def schedule_sync
        service = PoScheduleSyncService.new(@purchase_order)
        result = service.call!
        render json: { success: true, data: result }
      rescue PoScheduleSyncService::SyncBlockedError => e
        render_error(e.message, blocked: true, status: :unprocessable_entity)
      rescue PoScheduleSyncService::NoLinkedTasksError => e
        render_error(e.message, no_tasks: true, status: :unprocessable_entity)
      rescue PoScheduleSyncService::NoSyncableTaskError => e
        render_error(e.message, status: :unprocessable_entity)
      rescue => e
        render_error(e.message, status: :internal_server_error)
      end

      # POST /api/v1/purchase_orders/:id/save_pdf
      # Generate PDF and save to File Warehouse (Jobs/{{JobCode}}/Purchase Orders)
      def save_pdf
        # Validate PO has line items
        if @purchase_order.line_items.reject(&:marked_for_destruction?).empty?
          return render_error("Purchase order has no line items", status: :unprocessable_entity)
        end

        # Generate PDF
        generator = TeknaDocumentGenerator.new(:purchase_order)
        result = generator.generate(purchase_order: @purchase_order)

        # Build filename: {JobName}_{PONumber}_{SmTaskName}.pdf
        job = @purchase_order.job
        po_number = @purchase_order.purchase_order_number
        task_name = @purchase_order.sm_task&.name || "General"
        filename = build_po_filename(job&.name, po_number, task_name)

        # Create StorageBlob (deduplication via SHA256 content_hash)
        storage_blob = StorageBlob.find_or_create_for_content!(
          result[:pdf_content],
          filename: filename,
          content_type: "application/pdf"
        )

        # SSoT: WarehouseDocumentCreator handles metadata + callbacks
        warehouse_doc = WarehouseDocumentCreator.create!(
          filename: "#{po_number} - #{task_name}",
          source_type: "job",
          storage_blob: storage_blob,
          linkable: job,
          metadata: {
            "purchase_order_id" => @purchase_order.id,
            "purchase_order_number" => po_number,
            "supplier_id" => @purchase_order.supplier_id,
            "supplier_name" => @purchase_order.supplier&.display_name,
            "generated_at" => Time.current.iso8601
          }
        )

        # Increment blob reference count
        storage_blob.increment_reference!

        render json: {
          success: true,
          document_id: warehouse_doc.id,
          filename: filename,
          download_url: warehouse_doc.download_url,
          message: "PDF saved to #{job&.job_code || 'Job'}/Purchase Orders"
        }
      rescue TeknaDocumentGenerator::GenerationError => e
        render_error(e.message, status: :unprocessable_entity)
      rescue => e
        Rails.logger.error "[PO SavePDF] Failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
        render_error("Failed to save PDF: #{e.message}", status: :internal_server_error)
      end

      # POST /api/v1/purchase_orders/:id/send_email
      # Generate PDF and email to supplier, then save to warehouse
      def send_email
        # Validations
        if @purchase_order.line_items.reject(&:marked_for_destruction?).empty?
          return render_error("Purchase order has no line items", status: :unprocessable_entity)
        end

        unless @purchase_order.supplier.present?
          return render_error("No supplier selected", status: :unprocessable_entity)
        end

        supplier_email = @purchase_order.supplier.email
        unless supplier_email.present?
          return render_error("Supplier has no email address", status: :unprocessable_entity)
        end

        # Generate PDF
        generator = TeknaDocumentGenerator.new(:purchase_order)
        result = generator.generate(purchase_order: @purchase_order)

        # Build filename
        job = @purchase_order.job
        po_number = @purchase_order.purchase_order_number
        task_name = @purchase_order.sm_task&.name || "General"
        filename = build_po_filename(job&.name, po_number, task_name)

        # Build email
        company_name = TenantSetting.instance&.company_name || "Company"
        subject = "Purchase Order #{po_number} - #{job&.name || 'Job'}"
        body = <<~BODY
          Hi,

          Please find attached Purchase Order #{po_number}.

          Job: #{job&.name || 'N/A'}
          #{@purchase_order.sm_task ? "Task: #{task_name}" : ""}
          Total: $#{format('%.2f', @purchase_order.total || 0)} (inc GST)

          If you have any questions, please reply to this email.

          Kind regards,
          #{company_name}
        BODY

        # Send email with PDF attachment
        BpmnMailer.workflow_email(
          to: supplier_email,
          subject: subject,
          body: body,
          attachments: [
            {
              filename: filename,
              content_type: "application/pdf",
              content: result[:pdf_content]
            }
          ]
        ).deliver_now

        # Update PO status to "sent" and set ordered_date
        @purchase_order.send_to_supplier!

        # Save PDF copy to warehouse
        storage_blob = StorageBlob.find_or_create_for_content!(
          result[:pdf_content],
          filename: filename,
          content_type: "application/pdf"
        )

        # SSoT: WarehouseDocumentCreator handles metadata + callbacks
        warehouse_doc = WarehouseDocumentCreator.create!(
          filename: "#{po_number} - #{task_name} (Sent)",
          source_type: "job",
          storage_blob: storage_blob,
          linkable: job,
          metadata: {
            "purchase_order_id" => @purchase_order.id,
            "purchase_order_number" => po_number,
            "supplier_id" => @purchase_order.supplier_id,
            "supplier_name" => @purchase_order.supplier&.display_name,
            "sent_to" => supplier_email,
            "sent_at" => Time.current.iso8601,
            "generated_at" => Time.current.iso8601
          }
        )

        storage_blob.increment_reference!

        # Reload PO to get updated status
        @purchase_order.reload

        render json: {
          success: true,
          message: "Purchase order sent to #{supplier_email}",
          purchase_order: @purchase_order.as_json(include: :line_items),
          document_id: warehouse_doc.id
        }
      rescue TeknaDocumentGenerator::GenerationError => e
        render_error(e.message, status: :unprocessable_entity)
      rescue => e
        Rails.logger.error "[PO SendEmail] Failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
        render_error("Failed to send email: #{e.message}", status: :internal_server_error)
      end

      # GET /api/v1/purchase_orders/template_variants
      # List all available PO template variants with names/descriptions
      def template_variants
        variants = [
          { key: "classic", name: "Classic Corporate", description: "Logo left, details right. Black header bar on line items. Traditional layout.", active: TenantSetting.po_template_variant == "classic" },
          { key: "modern", name: "Modern Minimal", description: "Generous whitespace. Thin hairline dividers. Light gray accents.", active: TenantSetting.po_template_variant == "modern" },
          { key: "bold", name: "Bold & Branded", description: "Full-width colored header band. Large logo. Strong visual hierarchy.", active: TenantSetting.po_template_variant == "bold" },
          { key: "compact", name: "Compact Efficient", description: "Small fonts, tight spacing. Fits max line items per page.", active: TenantSetting.po_template_variant == "compact" },
          { key: "professional", name: "Professional Clean", description: "Two-column header. Subtle color accents. Rounded info boxes.", active: TenantSetting.po_template_variant == "professional" },
          { key: "construction", name: "Construction Industry", description: "Prominent delivery address & supervisor. Yellow safety accent.", active: TenantSetting.po_template_variant == "construction" },
          { key: "custom", name: "Custom", description: "Your own HTML template. Full control over layout and styling.", active: TenantSetting.po_template_variant == "custom" }
        ]
        render json: { success: true, data: variants, current: TenantSetting.po_template_variant }
      end

      # GET /api/v1/purchase_orders/template_preview?variant=modern
      # HTML preview using rich sample data to showcase the template design
      def template_preview
        variant = params[:variant] || "classic"
        valid_variants = %w[classic modern bold compact professional construction]
        variant = "classic" unless valid_variants.include?(variant)

        render html: build_sample_po_preview(variant).html_safe
      end

      private

      # Build filename: {JobName}_{PONumber}_{SmTaskName}.pdf
      # Sanitizes special characters for safe filenames
      def build_sample_po_preview(variant)
        settings = TenantSetting.instance
        sample_context = {
          purchase_order: {
            purchase_order_number: "PO-2026-0042",
            status: "approved",
            description: "Supply and deliver materials for slab preparation",
            required_date: (Date.current + 14.days).strftime("%d %B %Y"),
            required_on_site_date: (Date.current + 12.days).strftime("%d %B %Y"),
            ordered_date: Date.current.strftime("%d %B %Y"),
            expected_delivery_date: (Date.current + 10.days).strftime("%d %B %Y"),
            created_at: Date.current.strftime("%d %B %Y"),
            delivery_address: "45 Example Avenue, Springfield QLD 4300",
            special_instructions: "Deliver to rear of site. Contact supervisor on arrival.",
            subtotal: "$12,450.00",
            subtotal_raw: 12_450.0,
            gst: "$1,245.00",
            gst_raw: 1_245.0,
            total: "$13,695.00",
            total_raw: 13_695.0,
            budget: "$15,000.00",
            supplier: {
              name: "Brisbane Building Supplies Pty Ltd",
              email: "orders@brisbanebuilding.com.au",
              phone: "07 3555 1234",
              address: "Unit 4, 120 Industrial Drive, Rocklea QLD 4106"
            },
            site_supervisor: {
              name: "Mike Johnson",
              phone: "0412 345 678",
              email: "mike@example.com"
            },
            line_items: [
              { description: "Concrete 32MPa - Ready Mix", quantity: 18, unit_price: 245.00, total: 4_410.0, total_formatted: "$4,410.00", unit_price_formatted: "$245.00", gst_code: "GST", colour: nil, colour_code: nil, colour_brand: nil, pricebook_code: "CON-32MPA" },
              { description: "Steel Reinforcement N12 Bar 6m", quantity: 45, unit_price: 38.50, total: 1_732.5, total_formatted: "$1,732.50", unit_price_formatted: "$38.50", gst_code: "GST", colour: nil, colour_code: nil, colour_brand: nil, pricebook_code: "STL-N12" },
              { description: "Timber Formwork LVL 200x45", quantity: 24, unit_price: 62.00, total: 1_488.0, total_formatted: "$1,488.00", unit_price_formatted: "$62.00", gst_code: "GST", colour: nil, colour_code: nil, colour_brand: nil, pricebook_code: "TIM-LVL200" },
              { description: "DPC Membrane 0.2mm Polyethylene", quantity: 3, unit_price: 185.00, total: 555.0, total_formatted: "$555.00", unit_price_formatted: "$185.00", gst_code: "GST", colour: nil, colour_code: nil, colour_brand: nil, pricebook_code: "DPC-02MM" },
              { description: "Slab Edge Insulation 50mm EPS", quantity: 36, unit_price: 28.50, total: 1_026.0, total_formatted: "$1,026.00", unit_price_formatted: "$28.50", gst_code: "GST", colour: nil, colour_code: nil, colour_brand: nil, pricebook_code: "INS-EPS50" },
              { description: "Ant Capping Galvanised 150mm", quantity: 48, unit_price: 14.75, total: 708.0, total_formatted: "$708.00", unit_price_formatted: "$14.75", gst_code: "GST", colour: nil, colour_code: nil, colour_brand: nil, pricebook_code: "AC-GAL150" },
              { description: "Concrete Pump Hire - Half Day", quantity: 1, unit_price: 1_200.00, total: 1_200.0, total_formatted: "$1,200.00", unit_price_formatted: "$1,200.00", gst_code: "GST", colour: nil, colour_code: nil, colour_brand: nil, pricebook_code: "HIRE-PUMP" },
              { description: "Delivery & Crane Unload", quantity: 1, unit_price: 1_330.50, total: 1_330.5, total_formatted: "$1,330.50", unit_price_formatted: "$1,330.50", gst_code: "GST", colour: nil, colour_code: nil, colour_brand: nil, pricebook_code: "DEL-CRANE" },
            ],
            line_items_count: 8,
            ted_task: "Slab Preparation"
          },
          job: {
            name: "Smith Residence - New Home Build",
            full_address: "45 Example Avenue, Springfield QLD 4300",
            job_code: "J-2026-015",
            suburb: "Springfield",
            state: "QLD",
            postcode: "4300",
            contract_value: "$650,000.00",
            contract_value_raw: 650_000
          },
          company: build_sample_company_context(settings),
          colour_selections: {
            grouped: {},
            formatted_string: "",
            has_selections: false
          },
          po_template_variant: variant,
          generated_date: Date.current.strftime("%d/%m/%Y"),
          generated_date_long: Date.current.strftime("%d %B %Y"),
          current_year: Date.current.year.to_s,
          document_title: "Purchase Order",
          is_qbcc_document: false
        }

        renderer = TeknaTemplateRenderer.new
        renderer.render(
          template_path: "templates/purchase_order",
          layout: "layouts/tekna",
          locals: sample_context
        )
      end

      def build_sample_company_context(settings)
        address = settings.address || "123 Builder Street\nBrisbane QLD 4000"
        lines = address.split(/[\n,]/).map(&:strip).reject(&:blank?)
        address_line_1 = lines[0] || ""
        suburb = ""
        state = ""
        postcode = ""
        if lines.length > 1
          last_line = lines.last
          if (match = last_line.match(/^(.+?)\s+([A-Z]{2,3})\s+(\d{4})$/))
            suburb = match[1].strip
            state = match[2]
            postcode = match[3]
          end
        end

        abn = settings.abn || "12 345 678 901"
        abn_formatted = abn.to_s.gsub(/\D/, "").then { |d| d.length == 11 ? "#{d[0..1]} #{d[2..4]} #{d[5..7]} #{d[8..10]}" : abn }

        {
          name: settings.company_name || "ABC Construction Pty Ltd",
          company_name: settings.company_name || "ABC Construction Pty Ltd",
          abn: abn,
          abn_formatted: abn_formatted,
          qbcc: settings.qbcc_license || "15344273",
          qbcc_license: settings.qbcc_license || "15344273",
          email: settings.email || "info@example.com.au",
          phone: settings.phone || "(07) 3555 0000",
          phone_formatted: settings.phone || "(07) 3555 0000",
          address: address,
          address_line_1: address_line_1,
          suburb: suburb,
          state: state,
          postcode: postcode,
          full_address: address.gsub("\n", ", "),
          logo_url: settings.logo_url,
          header_line: "#{settings.company_name || 'ABC Construction'} | ABN #{abn_formatted} | QBCC #{settings.qbcc_license || '15344273'}",
          footer_line: "#{settings.phone || '(07) 3555 0000'} | #{settings.email || 'info@example.com.au'}"
        }
      end

      def build_po_filename(job_name, po_number, task_name)
        safe_job = (job_name || "Job").gsub(/[^a-zA-Z0-9\s\-]/, "").strip[0..40]
        safe_po = (po_number || "PO").gsub(/[^a-zA-Z0-9\-]/, "")
        safe_task = (task_name || "Task").gsub(/[^a-zA-Z0-9\s\-]/, "").strip[0..40]

        "#{safe_job}_#{safe_po}_#{safe_task}.pdf".gsub(/\s+/, " ").gsub(" ", "_")
      end

      def set_purchase_order
        @purchase_order = PurchaseOrder.includes(
          { line_items: { pricebook_item: :default_supplier } },
          :supplier,
          :job
        ).find_by_slug(params[:id])
        raise ActiveRecord::RecordNotFound unless @purchase_order
      end

      def purchase_order_params
        params.require(:purchase_order).permit(
          :job_id,
          :supplier_id,
          :status,
          :schedule_task_id,
          :task_template_id,
          :task_name,
          :description,
          :delivery_address,
          :special_instructions,
          :budget,
          :required_date,
          :required_on_site_date,
          :ordered_date,
          :due_date,
          :expected_delivery_date,
          :estimation_check,
          :part_payment,
          :amount_invoiced,
          :amount_paid,
          :xero_invoice_id,
          :xero_supplier,
          :xero_complete,
          :xero_amount_paid,
          :xero_amount_paid_exc_gst,
          :xero_paid_date,
          line_items_attributes: [
            :id,
            :pricebook_item_id,
            :profit_centre_id,
            :description,
            :quantity,
            :unit_price,
            :gst_code,
            :notes,
            :line_number,
            :_destroy
          ]
        )
      end
    end
  end
end
