module Api
  module V1
    class PurchaseOrdersController < ApplicationController
      before_action :set_purchase_order, only: [ :show, :update, :destroy, :approve, :send_to_supplier, :mark_received, :attach_documents, :available_documents, :generate_pdf, :schedule_sync_preview, :schedule_sync ]

      # GET /api/v1/purchase_orders
      # Params: construction_id, supplier_id, status, search, sort_by, sort_direction, page, per_page
      def index
        @purchase_orders = PurchaseOrder.includes(
          :supplier,
          :job,
          :sm_tasks,  # SSoT: SmTask is THE ONE task system
          line_items: :pricebook_item
        ).all

        # Filters
        @purchase_orders = @purchase_orders.by_construction(params[:job_id])
        @purchase_orders = @purchase_orders.by_status(params[:status])
        @purchase_orders = @purchase_orders.where(supplier_id: params[:supplier_id]) if params[:supplier_id].present?

        # Search using SSoT SearchService
        if params[:search].present?
          @purchase_orders = SearchService.apply(
            @purchase_orders,
            params[:search],
            columns: %w[purchase_order_number description ted_task],
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
        company_setting = CorporateCompanySetting.instance

        render json: {
          **@purchase_order.as_json(
            include: {
              supplier: { methods: [ :display_name ] },
              job: {
                methods: [ :site_supervisor_info ]
              },
              sm_tasks: {  # SSoT: SmTask is THE ONE task system
                methods: [ :materials_status ]
              },
              line_items: {
                include: { pricebook_item: { methods: [ :active_price ] } },
                methods: [ :price_drift, :price_outdated?, :price_status, :price_status_label ]
              },
              document_tasks: {
                methods: [ :document_url ]
              }
            },
            methods: [ :timing_warnings, :delivery_aligned_with_tasks? ]
          ),
          company_setting: company_setting.as_json
        }
      end

      # POST /api/v1/purchase_orders
      def create
        schedule_task_id = params[:purchase_order][:schedule_task_id]
        @purchase_order = PurchaseOrder.new(purchase_order_params.except(:schedule_task_id))

        ActiveRecord::Base.transaction do
          if @purchase_order.save
            # Link SmTask to this PO if provided (SmTask is THE ONE - SSoT)
            if schedule_task_id.present?
              sm_task = SmTask.find(schedule_task_id)
              sm_task.update!(purchase_order_id: @purchase_order.id)

              # Spawn Order/Call tasks if configured on the task
              spawn_result = SmPoSpawnService.new(sm_task, user: current_user).spawn!
              if spawn_result[:spawned_tasks].any?
                Rails.logger.info("[PurchaseOrdersController] Spawned #{spawn_result[:spawned_tasks].count} tasks for PO ##{@purchase_order.id}")
              end
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
            # Handle SmTask assignment changes (SmTask is THE ONE - SSoT)
            if schedule_task_id.present?
              # Unlink any existing tasks from this PO
              SmTask.where(purchase_order_id: @purchase_order.id).update_all(purchase_order_id: nil)

              # Link the new task to this PO
              sm_task = SmTask.find(schedule_task_id)
              sm_task.update!(purchase_order_id: @purchase_order.id)
            elsif params[:purchase_order].key?(:schedule_task_id) && schedule_task_id.nil?
              # Explicitly setting to nil - unlink all tasks
              SmTask.where(purchase_order_id: @purchase_order.id).update_all(purchase_order_id: nil)
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

        # Build PO from lookup result
        @purchase_order = PurchaseOrder.new(
          construction_id: params[:job_id],
          supplier_id: lookup_result[:supplier].id,
          description: params[:task_description],
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
            purchase_order = PurchaseOrder.new(
              construction_id: params[:job_id],
              supplier_id: lookup_result[:supplier].id,
              description: po_request[:task_description],
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
        documents = DocumentTask.where(construction_id: @purchase_order.job_id)
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
        generator = TeknaDocumentGenerator.new(:purchase_order)
        result = generator.generate(purchase_order: @purchase_order)

        if params[:format] == "html" || params[:preview]
          render html: result[:html].html_safe
        else
          send_data result[:pdf_content],
            filename: result[:filename],
            type: "application/pdf",
            disposition: params[:download] ? "attachment" : "inline"
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
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/purchase_orders/:id/schedule_sync
      # Execute sync from Schedule Master - updates PO dates from linked task(s)
      # Direction: Task → PO (safe - no cascade storms)
      def schedule_sync
        service = PoScheduleSyncService.new(@purchase_order)
        result = service.execute!
        render json: { success: true, data: result }
      rescue PoScheduleSyncService::SyncBlockedError => e
        render json: { success: false, error: e.message, blocked: true }, status: :unprocessable_entity
      rescue PoScheduleSyncService::NoLinkedTasksError => e
        render json: { success: false, error: e.message, no_tasks: true }, status: :unprocessable_entity
      rescue PoScheduleSyncService::NoSyncableTaskError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      private

      def set_purchase_order
        @purchase_order = PurchaseOrder.includes(:line_items, :supplier, :job).find_by_slug(params[:id])
        raise ActiveRecord::RecordNotFound unless @purchase_order
      end

      def purchase_order_params
        params.require(:purchase_order).permit(
          :job_id,
          :supplier_id,
          :status,
          :description,
          :delivery_address,
          :special_instructions,
          :budget,
          :required_date,
          :required_on_site_date,
          :ordered_date,
          :due_date,
          :expected_delivery_date,
          :ted_task,
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
