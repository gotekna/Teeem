module Api
  module V1
    module Portal
      class PayNowRequestsController < BaseController
        before_action :require_subcontractor
        before_action :set_request, only: [:show, :destroy, :upload_documents]

        # GET /api/v1/portal/pay_now_requests
        def index
          requests = current_contact.pay_now_requests
                                    .includes(:purchase_order, :payment, :reviewed_by_supervisor)
                                    .order(created_at: :desc)

          # Filter by status if provided
          requests = requests.where(status: params[:status]) if params[:status].present?

          # Group by status for organized display
          grouped_requests = {
            pending: requests.pending.map { |r| request_summary_json(r) },
            approved: requests.approved.map { |r| request_summary_json(r) },
            paid: requests.paid.map { |r| request_summary_json(r) },
            rejected: requests.rejected.map { |r| request_summary_json(r) },
            cancelled: requests.cancelled.map { |r| request_summary_json(r) }
          }

          # Also get stats
          stats = {
            total_requests: requests.count,
            total_paid: requests.paid.sum(:discounted_amount),
            total_savings: requests.paid.sum(:discount_amount),
            pending_count: requests.pending.count,
            this_week_requests: requests.current_week.count,
            this_week_amount: requests.current_week.paid.sum(:discounted_amount)
          }

          render json: {
            success: true,
            data: {
              requests: grouped_requests,
              stats: stats,
              weekly_limit: weekly_limit_summary
            }
          }
        end

        # GET /api/v1/portal/pay_now_requests/:id
        def show
          render json: {
            success: true,
            data: request_detail_json(@request)
          }
        end

        # POST /api/v1/portal/pay_now_requests
        def create
          # Find the purchase order
          po = current_contact.purchase_orders.find_by(id: params[:purchase_order_id])

          unless po
            render json: {
              success: false,
              error: 'Purchase order not found or does not belong to your account'
            }, status: :not_found
            return
          end

          # Validation: Job must be completed
          unless po.completed_at.present?
            render json: {
              success: false,
              error: 'Cannot request payment for incomplete jobs. Please mark the job as complete first.'
            }, status: :unprocessable_entity
            return
          end

          # Check for existing pending request
          if po.pay_now_requests.where(status: %w[pending approved]).exists?
            render json: {
              success: false,
              error: 'A payment request is already pending for this purchase order'
            }, status: :unprocessable_entity
            return
          end

          # Check if PO is already paid
          if po.payment_status == 'complete'
            render json: {
              success: false,
              error: 'This purchase order has already been paid in full'
            }, status: :unprocessable_entity
            return
          end

          # Calculate amount (default to PO total minus any existing payments)
          existing_payments = po.payments.sum(:amount)
          remaining_amount = po.total - existing_payments

          request_params = {
            contact: current_contact,
            requested_by_portal_user: current_portal_user,
            original_amount: params[:amount]&.to_f || remaining_amount,
            discount_percentage: params[:discount_percentage]&.to_f || 5.0,
            supplier_notes: params[:notes],
            requested_payment_date: params[:requested_payment_date] || CompanySetting.today
          }

          request = po.pay_now_requests.build(request_params)

          if request.save
            # Attach uploaded files
            if params[:invoice_file].present?
              request.invoice_file.attach(params[:invoice_file])
            end

            if params[:proof_photos].present?
              params[:proof_photos].each do |photo|
                request.proof_photos.attach(photo)
              end
            end

            render json: {
              success: true,
              message: 'Payment request submitted successfully. You will be notified when it is reviewed.',
              data: request_detail_json(request)
            }, status: :created
          else
            render json: {
              success: false,
              error: 'Failed to create payment request',
              errors: request.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/portal/pay_now_requests/:id
        def destroy
          unless @request.can_be_cancelled?
            render json: {
              success: false,
              error: "Cannot cancel request with status '#{@request.status}'. Only pending requests can be cancelled."
            }, status: :unprocessable_entity
            return
          end

          if @request.cancel!
            render json: {
              success: true,
              message: 'Payment request cancelled successfully'
            }
          else
            render json: {
              success: false,
              error: 'Failed to cancel payment request',
              errors: @request.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/portal/pay_now_requests/:id/upload_documents
        def upload_documents
          if params[:proof_photos].present?
            params[:proof_photos].each do |photo|
              @request.proof_photos.attach(photo)
            end
          end

          if params[:invoice_file].present?
            @request.invoice_file.attach(params[:invoice_file])
          end

          render json: {
            success: true,
            message: 'Documents uploaded successfully',
            data: {
              invoice_file_url: @request.invoice_file.attached? ? url_for(@request.invoice_file) : nil,
              proof_photos_count: @request.proof_photos.count
            }
          }
        end

        # GET /api/v1/portal/pay_now_requests/eligible_purchase_orders
        def eligible_purchase_orders
          # Get completed POs without pending payment requests
          eligible_pos = current_contact.purchase_orders
                                        .where.not(completed_at: nil)
                                        .where.not(payment_status: 'complete')
                                        .where.not(
                                          id: PayNowRequest.where(
                                            contact: current_contact,
                                            status: %w[pending approved]
                                          ).select(:purchase_order_id)
                                        )
                                        .includes(:construction, :payments)
                                        .order(completed_at: :desc)

          render json: {
            success: true,
            data: eligible_pos.map { |po| eligible_po_json(po) }
          }
        end

        private

        def set_request
          @request = current_contact.pay_now_requests.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render json: {
            success: false,
            error: 'Payment request not found'
          }, status: :not_found
        end

        def require_subcontractor
          unless current_portal_user&.subcontractor?
            render json: {
              success: false,
              error: 'Subcontractor access required'
            }, status: :forbidden
          end
        end

        def request_summary_json(request)
          {
            id: request.id,
            purchase_order_number: request.purchase_order.purchase_order_number,
            original_amount: request.formatted_original_amount,
            discount_percentage: request.discount_percentage,
            discount_amount: request.formatted_discount_amount,
            discounted_amount: request.formatted_discounted_amount,
            status: request.status,
            status_display: request.status_display,
            status_color: request.status_color,
            requested_at: request.created_at,
            reviewed_at: request.supervisor_reviewed_at,
            paid_at: request.paid_at,
            rejection_reason: request.rejection_reason
          }
        end

        def request_detail_json(request)
          {
            id: request.id,
            purchase_order: {
              id: request.purchase_order.id,
              number: request.purchase_order.purchase_order_number,
              total: request.purchase_order.total,
              status: request.purchase_order.status,
              completed_at: request.purchase_order.completed_at
            },
            original_amount: request.formatted_original_amount,
            discount_percentage: request.discount_percentage,
            discount_amount: request.formatted_discount_amount,
            discounted_amount: request.formatted_discounted_amount,
            savings: request.formatted_discount_amount,
            status: request.status,
            status_display: request.status_display,
            status_color: request.status_color,
            supplier_notes: request.supplier_notes,
            requested_payment_date: request.requested_payment_date,
            requested_at: request.created_at,
            reviewed_by: request.reviewed_by_supervisor&.full_name,
            reviewed_at: request.supervisor_reviewed_at,
            supervisor_notes: request.supervisor_notes,
            rejection_reason: request.rejection_reason,
            rejected_at: request.rejected_at,
            payment: request.payment ? {
              id: request.payment.id,
              amount: request.payment.amount,
              payment_date: request.payment.payment_date,
              reference_number: request.payment.reference_number
            } : nil,
            paid_at: request.paid_at,
            invoice_file_url: request.invoice_file.attached? ? url_for(request.invoice_file) : nil,
            proof_photos: request.proof_photos.map { |photo| url_for(photo) }
          }
        end

        def eligible_po_json(po)
          existing_payments = po.payments.sum(:amount)
          remaining_amount = po.total - existing_payments

          {
            id: po.id,
            purchase_order_number: po.purchase_order_number,
            construction_name: po.construction&.name,
            total: po.total,
            existing_payments: existing_payments,
            remaining_amount: remaining_amount,
            completed_at: po.completed_at,
            status: po.status
          }
        end

        def weekly_limit_summary
          limit = PayNowWeeklyLimit.current

          {
            total_limit: limit.formatted_total_limit,
            used_amount: limit.formatted_used_amount,
            remaining_amount: limit.formatted_remaining_amount,
            utilization_percentage: limit.utilization_percentage,
            week_start_date: limit.week_start_date,
            week_end_date: limit.week_end_date
          }
        end
      end
    end
  end
end
