module Api
  module V1
    module External
      class UnrealPurchaseOrdersController < ApplicationController
        skip_before_action :authorize_request
        before_action :authenticate_api_key!

        # POST /api/v1/external/unreal_purchase_orders
        # Creates a PO shell linked to an existing SmTask (job-level task)
        #
        # Payload:
        #   {
        #     "task_number": 10,        # SmTask.task_number on the job
        #     "job_id": 30,             # Job ID in TEEEM
        #     "estimator_notes": "..."  # Notes from Unreal estimator
        #   }
        #
        # Response:
        #   {
        #     "success": true,
        #     "purchase_order_id": 123,
        #     "purchase_order_number": "PO-000456",
        #     "message": "Purchase order created successfully"
        #   }
        #
        def create
          # Validate required params
          task_number = params[:Task_ID] || params[:task_id] || params[:task_number]
          job_id = params[:job_id]
          estimator_notes = params[:estimator_notes]

          if task_number.blank?
            return render json: {
              success: false,
              error: "task_number (or Task_ID) is required"
            }, status: :unprocessable_entity
          end

          if job_id.blank?
            return render json: {
              success: false,
              error: "job_id is required"
            }, status: :unprocessable_entity
          end

          # Find the job
          job = Job.find_by(id: job_id)
          unless job
            return render json: {
              success: false,
              error: "Job not found with ID: #{job_id}"
            }, status: :not_found
          end

          # Find the SmTask directly by task_number on this job
          sm_task = job.sm_tasks.find_by(task_number: task_number)
          unless sm_task
            return render json: {
              success: false,
              error: "Task not found with task_number: #{task_number} on job: #{job_id}",
              hint: "Available task_numbers on this job: #{job.sm_tasks.pluck(:task_number).sort.join(', ')}"
            }, status: :not_found
          end

          # Check if task already has a PO linked
          if sm_task.has_linked_po?
            existing_po = sm_task.linked_purchase_order
            return render json: {
              success: false,
              error: "Task already has a PO linked",
              existing_po_id: existing_po.id,
              existing_po_number: existing_po.purchase_order_number
            }, status: :unprocessable_entity
          end

          # Create the PO shell linked to the SmTask
          # NOTE: Do NOT wrap render inside transaction - response must only be sent after commit
          purchase_order = nil

          ActiveRecord::Base.transaction do
            Rails.logger.info "[Unreal PO] Starting transaction for job_id=#{job.id}, task_number=#{task_number}"

            purchase_order = PurchaseOrder.create!(
              job_id: job.id,
              sm_task_id: sm_task.id,
              description: sm_task.name,
              special_instructions: estimator_notes,
              status: "draft",
              source: "unreal_engine",
              supplier_id: sm_task.supplier_id
            )

            Rails.logger.info "[Unreal PO] Created PO id=#{purchase_order.id} #{purchase_order.purchase_order_number} linked to SmTask #{sm_task.id} (task_number: #{task_number})"
          end

          # Verify the PO was actually committed to the database
          verified_po = PurchaseOrder.find_by(id: purchase_order.id)
          unless verified_po
            Rails.logger.error "[Unreal PO] CRITICAL: PO #{purchase_order.id} was created but not found after transaction commit!"
            return render json: {
              success: false,
              error: "Purchase order creation failed - transaction may have been rolled back",
              attempted_id: purchase_order.id
            }, status: :internal_server_error
          end

          Rails.logger.info "[Unreal PO] Verified PO #{verified_po.purchase_order_number} exists in database"

          # Render AFTER transaction commits - ensures PO exists before responding
          render json: {
            success: true,
            purchase_order_id: purchase_order.id,
            purchase_order_number: purchase_order.purchase_order_number,
            job_id: job.id,
            job_title: job.title,
            sm_task_id: sm_task.id,
            task_number: sm_task.task_number,
            task_name: sm_task.name,
            task_trade: sm_task.trade,
            supplier_id: sm_task.supplier_id,
            status: purchase_order.status,
            message: "Purchase order created and linked to task ##{task_number} '#{sm_task.name}'"
          }, status: :created

        rescue ActiveRecord::RecordInvalid => e
          render json: {
            success: false,
            error: e.message,
            details: e.record.errors.full_messages
          }, status: :unprocessable_entity

        rescue => e
          Rails.logger.error "[Unreal PO] Error: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")

          render json: {
            success: false,
            error: "An error occurred while creating the purchase order",
            details: e.message
          }, status: :internal_server_error
        end

        # POST /api/v1/external/unreal_purchase_orders/:id/add_line_items
        # Adds line items to an existing PO (from the separate Unreal line items process)
        #
        # Payload:
        #   {
        #     "line_items": [
        #       {
        #         "pricebook_item_id": 123,  # Optional - if provided, uses pricebook pricing
        #         "description": "GPO Double",
        #         "quantity": 24,
        #         "unit_price": 45.50        # Optional if pricebook_item_id provided
        #       }
        #     ]
        #   }
        #
        def add_line_items
          purchase_order = PurchaseOrder.find_by(id: params[:id])

          unless purchase_order
            return render json: {
              success: false,
              error: "Purchase order not found with ID: #{params[:id]}"
            }, status: :not_found
          end

          line_items_params = params[:line_items] || []

          if line_items_params.empty?
            return render json: {
              success: false,
              error: "No line items provided"
            }, status: :unprocessable_entity
          end

          ActiveRecord::Base.transaction do
            created_items = []
            supplier_ids = []

            line_items_params.each_with_index do |item_params, index|
              line_item = purchase_order.line_items.new(
                description: item_params[:description],
                quantity: item_params[:quantity] || 1,
                unit_price: item_params[:unit_price] || 0,
                gst_code: item_params[:gst_code] || "GST",
                line_number: purchase_order.line_items.count + index + 1
              )

              # If pricebook_item_id provided, use its pricing and track supplier
              if item_params[:pricebook_item_id].present?
                pricebook_item = PricebookItem.find_by(id: item_params[:pricebook_item_id])
                if pricebook_item
                  line_item.pricebook_item_id = pricebook_item.id
                  line_item.description ||= pricebook_item.item_name
                  line_item.unit_price = pricebook_item.current_price || item_params[:unit_price] || 0

                  # Track default supplier from pricebook item
                  if pricebook_item.default_supplier_id.present?
                    supplier_ids << pricebook_item.default_supplier_id
                  end
                end
              end

              line_item.save!
              created_items << line_item
            end

            # Set supplier from most common default supplier in line items
            if supplier_ids.any? && purchase_order.supplier_id.nil?
              most_common_supplier = supplier_ids.group_by(&:itself)
                                                  .max_by { |_, v| v.size }
                                                  &.first
              purchase_order.update!(supplier_id: most_common_supplier) if most_common_supplier
            end

            # Recalculate totals
            purchase_order.reload

            Rails.logger.info "[Unreal PO] Added #{created_items.count} line items to PO #{purchase_order.purchase_order_number}"

            render json: {
              success: true,
              purchase_order_id: purchase_order.id,
              purchase_order_number: purchase_order.purchase_order_number,
              line_items_added: created_items.count,
              total_line_items: purchase_order.line_items.count,
              sub_total: purchase_order.sub_total,
              tax: purchase_order.tax,
              total: purchase_order.total,
              supplier_id: purchase_order.supplier_id,
              supplier_name: purchase_order.supplier&.display_name,
              message: "Added #{created_items.count} line items to purchase order"
            }, status: :ok
          end

        rescue ActiveRecord::RecordInvalid => e
          render json: {
            success: false,
            error: e.message,
            details: e.record.errors.full_messages
          }, status: :unprocessable_entity

        rescue => e
          Rails.logger.error "[Unreal PO Line Items] Error: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")

          render json: {
            success: false,
            error: "An error occurred while adding line items",
            details: e.message
          }, status: :internal_server_error
        end

        # POST /api/v1/external/unreal_line_items
        # Adds a single line item to a PO using item_code lookup
        #
        # Payload:
        #   {
        #     "job_id": 10,           # Job ID in TEEEM (optional validation)
        #     "item_code": "WCC",     # PricebookItem.item_code to look up
        #     "qty": 50,              # Quantity
        #     "po_ID": 123,           # PurchaseOrder.id in TEEEM
        #     "est_status": 1         # Estimator status (passed through)
        #   }
        #
        def create_line_item
          item_code = params[:item_code]
          quantity = params[:qty] || 1
          po_id = params[:po_ID]

          if item_code.blank?
            return render json: { success: false, error: "item_code is required" }, status: :unprocessable_entity
          end

          if po_id.blank?
            return render json: { success: false, error: "po_ID is required" }, status: :unprocessable_entity
          end

          purchase_order = PurchaseOrder.find_by(id: po_id)
          unless purchase_order
            return render json: { success: false, error: "Purchase order not found with ID: #{po_id}" }, status: :not_found
          end

          pricebook_item = PricebookItem.find_by(item_code: item_code)
          unless pricebook_item
            return render json: { success: false, error: "Pricebook item not found with code: #{item_code}" }, status: :not_found
          end

          line_item = purchase_order.line_items.create!(
            pricebook_item_id: pricebook_item.id,
            description: pricebook_item.item_name,
            quantity: quantity.to_i,
            unit_price: pricebook_item.current_price || 0,
            gst_code: pricebook_item.gst_code || "GST"
            # line_number auto-set by PurchaseOrderLineItem.set_line_number callback
          )

          # Recalculate supplier from ALL line items' default suppliers (most common wins)
          supplier_ids = purchase_order.line_items
            .includes(:pricebook_item)
            .map { |li| li.pricebook_item&.default_supplier_id }
            .compact

          if supplier_ids.any?
            most_common_supplier = supplier_ids.group_by(&:itself)
                                                .max_by { |_, v| v.size }
                                                &.first
            purchase_order.update!(supplier_id: most_common_supplier) if most_common_supplier
          end

          purchase_order.reload

          render json: {
            success: true,
            line_item_id: line_item.id,
            purchase_order_id: purchase_order.id,
            item_code: pricebook_item.item_code,
            qty: line_item.quantity,
            unit_price: line_item.unit_price.to_f,
            line_total: (line_item.quantity * line_item.unit_price).to_f,
            est_status: params[:est_status]
          }, status: :created

        rescue ActiveRecord::RecordInvalid => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        rescue => e
          Rails.logger.error "[Unreal Line Item] Error: #{e.message}"
          render json: { success: false, error: e.message }, status: :internal_server_error
        end

        # GET /api/v1/external/unreal_jobs/:id
        # Get job details including contract price for Unreal
        #
        # Response:
        #   {
        #     "success": true,
        #     "job": {
        #       "id": 30,
        #       "name": "Smith Residence",
        #       "contract_price": 450000.00,
        #       ...
        #     }
        #   }
        #
        # NOTE: contract_price is THE ONE for total contract price (SSoT)
        # contract_value exists but is being deprecated - do not use in new code
        #
        def show_job
          job = Job.find_by(id: params[:id])

          unless job
            return render json: {
              success: false,
              error: "Job not found with ID: #{params[:id]}"
            }, status: :not_found
          end

          render json: {
            success: true,
            job: {
              id: job.id,
              name: job.name,
              title: job.title,
              job_number: job.job_number,
              # SSoT: contract_price is THE ONE for total contract price
              contract_price: job.contract_price,
              deposit: job.deposit,
              prime_cost: job.prime_cost,
              provisional_sum: job.provisional_sum,
              live_profit: job.live_profit,
              profit_percentage: job.profit_percentage,
              status: job.status,
              site_address: job.site_address,
              suburb: job.suburb,
              state: job.state,
              postcode: job.postcode
            }
          }
        end

        private

        def authenticate_api_key!
          api_key = request.headers["X-API-Key"]

          if api_key.blank?
            render json: {
              success: false,
              error: "API key required. Please include X-API-Key header."
            }, status: :unauthorized
            return
          end

          integration = ExternalIntegration.find_by_api_key(api_key)

          if integration.nil?
            render json: {
              success: false,
              error: "Invalid API key"
            }, status: :unauthorized
            return
          end

          # Record usage
          integration.record_usage!

          @current_integration = integration
        end
      end
    end
  end
end
