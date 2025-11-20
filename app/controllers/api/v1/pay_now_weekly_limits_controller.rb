module Api
  module V1
    class PayNowWeeklyLimitsController < ApplicationController
      before_action :authorize_request
      before_action :authorize_builder_or_admin, except: [:current]

      # GET /api/v1/pay_now_weekly_limits/current
      def current
        limit = PayNowWeeklyLimit.current

        render json: {
          success: true,
          data: weekly_limit_json(limit)
        }
      end

      # POST /api/v1/pay_now_weekly_limits/set_limit
      def set_limit
        unless params[:amount].present?
          render json: {
            success: false,
            error: 'Limit amount is required'
          }, status: :unprocessable_entity
          return
        end

        amount = params[:amount].to_f

        if amount < 0
          render json: {
            success: false,
            error: 'Limit amount must be greater than or equal to zero'
          }, status: :unprocessable_entity
          return
        end

        begin
          new_limit = PayNowWeeklyLimit.set_limit(amount, user: current_user)

          render json: {
            success: true,
            message: "Weekly limit updated to #{new_limit.formatted_total_limit}",
            data: weekly_limit_json(new_limit)
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: "Failed to set weekly limit: #{e.message}"
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/pay_now_weekly_limits/history
      def history
        # Get past weekly limits
        limits = PayNowWeeklyLimit.order(week_start_date: :desc)
                                   .limit(params[:limit]&.to_i || 12) # Default to 12 weeks

        render json: {
          success: true,
          data: limits.map { |limit| weekly_limit_history_json(limit) }
        }
      end

      # GET /api/v1/pay_now_weekly_limits/usage_report
      def usage_report
        # Get usage stats for the current week
        current_limit = PayNowWeeklyLimit.current

        # Get requests for this week
        week_requests = PayNowRequest.for_week(current_limit.week_start_date)
                                     .includes(:contact, :purchase_order)

        # Group by status
        by_status = {
          pending: week_requests.pending.count,
          approved: week_requests.approved.count,
          paid: week_requests.paid.count,
          rejected: week_requests.rejected.count
        }

        # Top suppliers by request amount
        top_suppliers = week_requests.paid
                                    .group(:contact_id)
                                    .sum(:discounted_amount)
                                    .sort_by { |_k, v| -v }
                                    .first(5)
                                    .map do |contact_id, total_amount|
          contact = Contact.find(contact_id)
          {
            supplier_id: contact.id,
            supplier_name: contact.full_name,
            total_amount: "$#{total_amount.round(2)}",
            request_count: week_requests.paid.where(contact_id: contact_id).count
          }
        end

        render json: {
          success: true,
          data: {
            current_limit: weekly_limit_json(current_limit),
            requests_by_status: by_status,
            total_requests: week_requests.count,
            top_suppliers: top_suppliers,
            daily_breakdown: daily_breakdown(week_requests)
          }
        }
      end

      private

      def authorize_builder_or_admin
        unless current_user.builder? || current_user.admin?
          render json: {
            success: false,
            error: 'Unauthorized. Only builders can manage weekly limits.'
          }, status: :forbidden
        end
      end

      def weekly_limit_json(limit)
        {
          id: limit.id,
          total_limit: limit.total_limit,
          formatted_total_limit: limit.formatted_total_limit,
          used_amount: limit.used_amount,
          formatted_used_amount: limit.formatted_used_amount,
          remaining_amount: limit.remaining_amount,
          formatted_remaining_amount: limit.formatted_remaining_amount,
          utilization_percentage: limit.utilization_percentage,
          week_start_date: limit.week_start_date,
          week_end_date: limit.week_end_date,
          active: limit.active,
          set_by: limit.set_by ? {
            id: limit.set_by.id,
            name: limit.set_by.full_name,
            email: limit.set_by.email
          } : nil,
          previous_limit: limit.previous_limit,
          created_at: limit.created_at,
          updated_at: limit.updated_at
        }
      end

      def weekly_limit_history_json(limit)
        requests_count = PayNowRequest.for_week(limit.week_start_date).count
        paid_count = PayNowRequest.for_week(limit.week_start_date).paid.count
        rejected_count = PayNowRequest.for_week(limit.week_start_date).rejected.count

        {
          id: limit.id,
          week_start_date: limit.week_start_date,
          week_end_date: limit.week_end_date,
          total_limit: limit.formatted_total_limit,
          used_amount: limit.formatted_used_amount,
          utilization_percentage: limit.utilization_percentage,
          requests_count: requests_count,
          paid_count: paid_count,
          rejected_count: rejected_count,
          active: limit.active
        }
      end

      def daily_breakdown(week_requests)
        # Group requests by day of the week
        breakdown = week_requests.paid.group_by { |r| r.created_at.to_date }

        # Create array of all days in the week
        current_limit = PayNowWeeklyLimit.current
        (current_limit.week_start_date..current_limit.week_end_date).map do |date|
          day_requests = breakdown[date] || []
          {
            date: date,
            day_name: date.strftime('%A'),
            request_count: day_requests.count,
            total_amount: "$#{day_requests.sum(&:discounted_amount).round(2)}"
          }
        end
      end
    end
  end
end
