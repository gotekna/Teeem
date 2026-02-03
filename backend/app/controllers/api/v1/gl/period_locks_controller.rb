# frozen_string_literal: true

module Api
  module V1
    module Gl
      class PeriodLocksController < ApplicationController
        # GET /api/v1/gl/period_locks
        def index
          locks = current_company.gl_period_locks
                                 .includes(:locked_by, :unlocked_by)
                                 .order(period_end: :desc)

          # Filter by status
          locks = locks.where(status: params[:status]) if params[:status].present?

          render json: {
            success: true,
            data: {
              locks: locks.map { |l| lock_json(l) },
              current_lock_date: current_company_lock_date
            }
          }
        end

        # GET /api/v1/gl/period_locks/:id
        def show
          lock = find_lock

          render json: {
            success: true,
            data: lock_json(lock)
          }
        end

        # POST /api/v1/gl/period_locks
        def create
          lock = Gl::PeriodLock.lock_period!(
            current_company,
            period_type: params[:period_type],
            period_end: Date.parse(params[:period_end]),
            locked_by: current_user,
            reason: params[:reason]
          )

          render json: {
            success: true,
            data: lock_json(lock),
            message: "Period locked: #{lock.period_label}"
          }
        rescue ActiveRecord::RecordInvalid => e
          render json: {
            success: false,
            error: e.record.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/period_locks/:id/unlock
        def unlock
          lock = find_lock

          unless params[:reason].present?
            return render json: {
              success: false,
              error: "Reason required for unlocking"
            }, status: :unprocessable_entity
          end

          lock.unlock!(
            unlocked_by: current_user,
            reason: params[:reason]
          )

          render json: {
            success: true,
            data: lock_json(lock),
            message: "Period unlocked: #{lock.period_label}"
          }
        end

        # POST /api/v1/gl/period_locks/:id/soft_lock
        def soft_lock
          lock = find_lock
          lock.soft_lock!

          render json: {
            success: true,
            data: lock_json(lock),
            message: "Period soft-locked (adjustments allowed)"
          }
        end

        # POST /api/v1/gl/period_locks/:id/relock
        def relock
          lock = find_lock
          lock.relock!(locked_by: current_user, reason: params[:reason])

          render json: {
            success: true,
            data: lock_json(lock),
            message: "Period re-locked"
          }
        end

        # GET /api/v1/gl/period_locks/check
        def check
          date = Date.parse(params[:date])
          lock = Gl::PeriodLock.lock_for_date(current_company, date)

          render json: {
            success: true,
            data: {
              date: date,
              is_locked: lock.present?,
              lock: lock ? lock_json(lock) : nil,
              allows_adjustment: lock&.allows_transaction?("adjustment") || true
            }
          }
        end

        # GET /api/v1/gl/period_locks/status
        def status
          lock_date = current_company_lock_date

          # Get recent locks
          recent_locks = current_company.gl_period_locks
                                        .active
                                        .order(period_end: :desc)
                                        .limit(3)

          render json: {
            success: true,
            data: {
              lock_date: lock_date,
              locked_until: lock_date&.strftime("%d %b %Y"),
              recent_locks: recent_locks.map { |l| lock_json(l) },
              periods_available_to_lock: available_periods
            }
          }
        end

        # GET /api/v1/gl/period_locks/available_periods
        def available_periods_list
          render json: {
            success: true,
            data: available_periods
          }
        end

        private

        def find_lock
          current_company.gl_period_locks.find(params[:id])
        end

        def lock_json(lock)
          {
            id: lock.id,
            period_type: lock.period_type,
            period_start: lock.period_start,
            period_end: lock.period_end,
            period_label: lock.period_label,
            status: lock.status,
            locked_at: lock.locked_at,
            locked_by: lock.locked_by&.name,
            lock_reason: lock.lock_reason,
            unlocked_at: lock.unlocked_at,
            unlocked_by: lock.unlocked_by&.name,
            unlock_reason: lock.unlock_reason,
            transactions_at_lock: lock.transactions_at_lock,
            balance_at_lock: lock.balance_at_lock
          }
        end

        def current_company_lock_date
          TenantSetting.find_by(company_id: current_company.id)&.gl_lock_date
        end

        def available_periods
          lock_date = current_company_lock_date || Date.current.beginning_of_year - 1.year

          periods = []

          # Next 12 months available for locking
          (0..11).each do |i|
            month_end = (lock_date + 1.month + i.months).end_of_month
            next if month_end > Date.current  # Can't lock future periods

            periods << {
              type: "month",
              period_end: month_end,
              label: month_end.strftime("%B %Y")
            }
          end

          # Available quarters
          current_quarter_end = Date.current.end_of_quarter
          (1..4).each do |i|
            quarter_end = (lock_date + i * 3.months).end_of_quarter
            next if quarter_end > current_quarter_end

            quarter_num = ((quarter_end.month - 1) / 3) + 1
            periods << {
              type: "quarter",
              period_end: quarter_end,
              label: "Q#{quarter_num} #{quarter_end.year}"
            }
          end

          periods.uniq { |p| [p[:type], p[:period_end]] }
        end

        def current_company
          @current_company ||= Corporate.find(
            params[:corporate_id] || current_user.corporate_id
          )
        end
      end
    end
  end
end
