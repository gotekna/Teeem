module Api
  module V1
    module External
      class UnrealPurchaseOrdersController < ApplicationController
        before_action :authenticate_api_key!

        # POST /api/v1/external/unreal_purchase_orders
        # Creates a PO shell from an SM Template Row (Schedule Master task)
        #
        # Payload:
        #   {
        #     "Task_ID": 10,           # SmTemplateRow ID in TEEEM
        #     "job_id": 30,            # Job ID in TEEEM
        #     "estimator_notes": "..." # Notes from Unreal estimator
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
          sm_template_row_id = params[:Task_ID] || params[:task_id]
          job_id = params[:job_id]
          estimator_notes = params[:estimator_notes]

          if sm_template_row_id.blank?
            return render json: {
              success: false,
              error: "Task_ID is required"
            }, status: :unprocessable_entity
          end

          if job_id.blank?
            return render json: {
              success: false,
              error: "job_id is required"
            }, status: :unprocessable_entity
          end

          # Find the SM template row
          sm_template_row = SmTemplateRow.find_by(id: sm_template_row_id)
          unless sm_template_row
            return render json: {
              success: false,
              error: "SM template row not found with ID: #{sm_template_row_id}"
            }, status: :not_found
          end

          # Find the job
          job = Job.find_by(id: job_id)
          unless job
            return render json: {
              success: false,
              error: "Job not found with ID: #{job_id}"
            }, status: :not_found
          end

          ActiveRecord::Base.transaction do
            # Create the PO shell using SM template row data
            purchase_order = PurchaseOrder.new(
              job_id: job.id,
              description: sm_template_row.name,
              ted_task: sm_template_row.trade,
              special_instructions: estimator_notes,
              status: "draft",
              source: "unreal_engine",
              unreal_task_template_id: sm_template_row_id,
              supplier_id: sm_template_row.supplier_id
            )

            if purchase_order.save
              # Log the creation
              Rails.logger.info "[Unreal PO] Created PO #{purchase_order.purchase_order_number} for job #{job.id} from SmTemplateRow #{sm_template_row_id}"

              render json: {
                success: true,
                purchase_order_id: purchase_order.id,
                purchase_order_number: purchase_order.purchase_order_number,
                job_id: job.id,
                job_title: job.title,
                task_name: sm_template_row.name,
                task_trade: sm_template_row.trade,
                supplier_id: sm_template_row.supplier_id,
                status: purchase_order.status,
                message: "Purchase order created successfully from SM template '#{sm_template_row.name}'"
              }, status: :created
            else
              render json: {
                success: false,
                error: "Failed to create purchase order",
                details: purchase_order.errors.full_messages
              }, status: :unprocessable_entity
            end
          end

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
                  line_item.description ||= pricebook_item.name
                  line_item.unit_price = pricebook_item.active_price || item_params[:unit_price] || 0

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
            gst_code: pricebook_item.gst_code || "GST",
            line_number: purchase_order.line_items.count + 1
          )

          if purchase_order.supplier_id.nil? && pricebook_item.default_supplier_id.present?
            purchase_order.update!(supplier_id: pricebook_item.default_supplier_id)
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
