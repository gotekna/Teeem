module Api
  module V1
    class PayNowRequestsController < ApplicationController
      before_action :authorize_request
      before_action :set_request, only: [:show, :approve, :reject]
      before_action :authorize_supervisor_or_admin, only: [:approve, :reject]

      # GET /api/v1/pay_now_requests
      def index
        requests = PayNowRequest.includes(:purchase_order, :contact, :reviewed_by_supervisor, :payment)

        # Filter by status
        requests = requests.where(status: params[:status]) if params[:status].present?

        # Filter by role - supervisors see pending, builders see all
        if current_user.supervisor? && !current_user.admin?
          requests = requests.where(status: 'pending')
        end

        # Filter by date range
        if params[:start_date].present? && params[:end_date].present?
          requests = requests.where(created_at: params[:start_date]..params[:end_date])
        end

        # Filter by supplier
        requests = requests.where(contact_id: params[:contact_id]) if params[:contact_id].present?

        # Sort
        sort_order = params[:sort_order] == 'asc' ? :asc : :desc
        requests = requests.order(created_at: sort_order)

        # Paginate
        page = params[:page]&.to_i || 1
        per_page = params[:per_page]&.to_i || 25
        requests = requests.limit(per_page).offset((page - 1) * per_page)

        render json: {
          success: true,
          data: {
            requests: requests.map { |r| admin_request_json(r) },
            pagination: {
              current_page: page,
              per_page: per_page,
              total: PayNowRequest.count
            }
          }
        }
      end

      # GET /api/v1/pay_now_requests/:id
      def show
        render json: {
          success: true,
          data: admin_request_detail_json(@request)
        }
      end

      # POST /api/v1/pay_now_requests/:id/approve
      def approve
        unless @request.can_be_approved?
          render json: {
            success: false,
            error: "Cannot approve request with status '#{@request.status}'"
          }, status: :unprocessable_entity
          return
        end

        begin
          @request.approve!(
            user: current_user,
            notes: params[:notes]
          )

          render json: {
            success: true,
            message: 'Payment request approved and payment processed successfully',
            data: admin_request_detail_json(@request.reload)
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: "Failed to approve payment request: #{e.message}"
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/pay_now_requests/:id/reject
      def reject
        unless @request.can_be_rejected?
          render json: {
            success: false,
            error: "Cannot reject request with status '#{@request.status}'"
          }, status: :unprocessable_entity
          return
        end

        unless params[:reason].present?
          render json: {
            success: false,
            error: 'Rejection reason is required'
          }, status: :unprocessable_entity
          return
        end

        begin
          @request.reject!(
            user: current_user,
            reason: params[:reason]
          )

          render json: {
            success: true,
            message: 'Payment request rejected',
            data: admin_request_detail_json(@request.reload)
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: "Failed to reject payment request: #{e.message}"
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/pay_now_requests/dashboard_stats
      def dashboard_stats
        today = CompanySetting.today
        week_start = today.beginning_of_week(:monday)
        month_start = today.beginning_of_month

        # Current week stats
        this_week_requests = PayNowRequest.for_week(week_start)

        # Monthly stats
        this_month_requests = PayNowRequest.where('created_at >= ?', month_start)

        # Weekly limit info
        weekly_limit = PayNowWeeklyLimit.current

        stats = {
          this_week: {
            total_requests: this_week_requests.count,
            pending: this_week_requests.pending.count,
            approved: this_week_requests.approved.count,
            paid: this_week_requests.paid.count,
            rejected: this_week_requests.rejected.count,
            total_paid_amount: this_week_requests.paid.sum(:discounted_amount),
            total_discount_given: this_week_requests.paid.sum(:discount_amount)
          },
          this_month: {
            total_requests: this_month_requests.count,
            total_paid_amount: this_month_requests.paid.sum(:discounted_amount),
            total_discount_given: this_month_requests.paid.sum(:discount_amount),
            average_request_amount: this_month_requests.paid.average(:discounted_amount) || 0
          },
          weekly_limit: {
            total_limit: weekly_limit.formatted_total_limit,
            used_amount: weekly_limit.formatted_used_amount,
            remaining_amount: weekly_limit.formatted_remaining_amount,
            utilization_percentage: weekly_limit.utilization_percentage,
            week_start_date: weekly_limit.week_start_date,
            week_end_date: weekly_limit.week_end_date
          },
          all_time: {
            total_requests: PayNowRequest.count,
            total_paid: PayNowRequest.paid.sum(:discounted_amount),
            total_savings_given: PayNowRequest.paid.sum(:discount_amount),
            approval_rate: calculate_approval_rate
          }
        }

        render json: {
          success: true,
          data: stats
        }
      end

      # GET /api/v1/pay_now_requests/pending_approval
      def pending_approval
        pending_requests = PayNowRequest.pending
                                       .includes(:purchase_order, :contact)
                                       .order(created_at: :asc)

        render json: {
          success: true,
          data: {
            count: pending_requests.count,
            requests: pending_requests.map { |r| admin_request_json(r) }
          }
        }
      end

      private

      def set_request
        @request = PayNowRequest.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Payment request not found'
        }, status: :not_found
      end

      def authorize_supervisor_or_admin
        unless current_user.supervisor? || current_user.builder? || current_user.admin?
          render json: {
            success: false,
            error: 'Unauthorized. Only supervisors and builders can approve/reject payment requests.'
          }, status: :forbidden
        end
      end

      def admin_request_json(request)
        {
          id: request.id,
          purchase_order: {
            id: request.purchase_order.id,
            number: request.purchase_order.purchase_order_number,
            total: request.purchase_order.total
          },
          supplier: {
            id: request.contact.id,
            name: request.contact.full_name,
            email: request.contact.email
          },
          original_amount: request.formatted_original_amount,
          discount_percentage: request.discount_percentage,
          discount_amount: request.formatted_discount_amount,
          discounted_amount: request.formatted_discounted_amount,
          status: request.status,
          status_display: request.status_display,
          status_color: request.status_color,
          requested_at: request.created_at,
          requested_payment_date: request.requested_payment_date
        }
      end

      def admin_request_detail_json(request)
        {
          id: request.id,
          purchase_order: {
            id: request.purchase_order.id,
            number: request.purchase_order.purchase_order_number,
            total: request.purchase_order.total,
            status: request.purchase_order.status,
            completed_at: request.purchase_order.completed_at,
            construction: {
              id: request.purchase_order.construction&.id,
              name: request.purchase_order.construction&.name,
              address: request.purchase_order.construction&.address
            }
          },
          supplier: {
            id: request.contact.id,
            name: request.contact.full_name,
            email: request.contact.email,
            phone: request.contact.mobile_phone,
            trapid_rating: request.contact.trapid_rating
          },
          financial_details: {
            original_amount: request.formatted_original_amount,
            discount_percentage: request.discount_percentage,
            discount_amount: request.formatted_discount_amount,
            discounted_amount: request.formatted_discounted_amount,
            savings_to_supplier: request.formatted_discount_amount
          },
          status: request.status,
          status_display: request.status_display,
          status_color: request.status_color,
          supplier_notes: request.supplier_notes,
          requested_payment_date: request.requested_payment_date,
          requested_at: request.created_at,
          requested_by: {
            id: request.requested_by_portal_user&.id,
            email: request.requested_by_portal_user&.email
          },
          review_details: {
            reviewed_by: request.reviewed_by_supervisor ? {
              id: request.reviewed_by_supervisor.id,
              name: request.reviewed_by_supervisor.full_name,
              email: request.reviewed_by_supervisor.email
            } : nil,
            reviewed_at: request.supervisor_reviewed_at,
            supervisor_notes: request.supervisor_notes,
            rejection_reason: request.rejection_reason,
            rejected_at: request.rejected_at
          },
          payment: request.payment ? {
            id: request.payment.id,
            amount: request.payment.amount,
            payment_date: request.payment.payment_date,
            payment_method: request.payment.payment_method,
            reference_number: request.payment.reference_number,
            notes: request.payment.notes
          } : nil,
          paid_at: request.paid_at,
          attachments: {
            invoice_file_url: request.invoice_file.attached? ? url_for(request.invoice_file) : nil,
            proof_photos: request.proof_photos.map { |photo|
              {
                url: url_for(photo),
                filename: photo.filename.to_s
              }
            }
          },
          weekly_limit: request.pay_now_weekly_limit ? {
            id: request.pay_now_weekly_limit.id,
            total_limit: request.pay_now_weekly_limit.formatted_total_limit,
            week_start_date: request.pay_now_weekly_limit.week_start_date,
            week_end_date: request.pay_now_weekly_limit.week_end_date
          } : nil
        }
      end

      def calculate_approval_rate
        total = PayNowRequest.where(status: %w[approved paid rejected]).count
        return 0 if total.zero?

        approved = PayNowRequest.where(status: %w[approved paid]).count
        ((approved.to_f / total) * 100).round(2)
      end
    end
  end
end
