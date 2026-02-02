# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for time-based billing
      class TimeBillingController < ApplicationController
        before_action :set_corporate

        # GET /api/v1/gl/time_billing/rates
        def rates
          rates = @corporate.gl_billable_rates
                                    .includes(:user, :job, :contact)
                                    .order(rate_type: :asc, created_at: :desc)

          rates = rates.active if params[:active_only] == "true"
          rates = rates.for_user(User.find(params[:user_id])) if params[:user_id].present?

          render json: { success: true, data: rates.as_json(include: [:user, :job, :contact]) }
        end

        # POST /api/v1/gl/time_billing/rates
        def create_rate
          rate = @corporate.gl_billable_rates.build(rate_params)

          if rate.save
            render json: { success: true, data: rate }, status: :created
          else
            render json: { success: false, error: rate.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/time_billing/rates/:id
        def update_rate
          rate = @corporate.gl_billable_rates.find(params[:id])

          if rate.update(rate_params)
            render json: { success: true, data: rate }
          else
            render json: { success: false, error: rate.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/time_billing/entries
        def entries
          entries = @corporate.gl_billable_time_entries
                                      .includes(:user, :job, :billable_rate)
                                      .order(entry_date: :desc)

          entries = entries.where(status: params[:status]) if params[:status].present?
          entries = entries.for_job(Job.find(params[:job_id])) if params[:job_id].present?
          entries = entries.where(user_id: params[:user_id]) if params[:user_id].present?
          entries = entries.for_period(params[:start_date], params[:end_date]) if params[:start_date].present?

          render json: { success: true, data: entries.as_json(include: [:user, :job]) }
        end

        # POST /api/v1/gl/time_billing/entries
        def create_entry
          entry = @corporate.gl_billable_time_entries.build(entry_params)
          entry.user = current_user unless entry.user_id

          # Find rate if not provided
          if entry.hourly_rate.blank?
            rate = ::Gl::BillableRate.find_rate_for(
              @corporate,
              user: entry.user,
              job: entry.job,
              date: entry.entry_date
            )
            entry.billable_rate = rate
            entry.hourly_rate = rate&.hourly_rate || 0
          end

          if entry.save
            render json: { success: true, data: entry }, status: :created
          else
            render json: { success: false, error: entry.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/time_billing/entries/:id/approve
        def approve_entry
          entry = @corporate.gl_billable_time_entries.find(params[:id])

          if entry.approve!(current_user)
            render json: { success: true, data: entry, message: "Entry approved" }
          else
            render json: { success: false, error: "Cannot approve entry" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/time_billing/entries/batch_approve
        def batch_approve
          entries = @corporate.gl_billable_time_entries
                                      .where(id: params[:entry_ids])
                                      .where(status: "pending_approval")

          approved_count = 0
          entries.find_each do |entry|
            approved_count += 1 if entry.approve!(current_user)
          end

          render json: { success: true, message: "#{approved_count} entries approved" }
        end

        # GET /api/v1/gl/time_billing/unbilled
        def unbilled
          entries = @corporate.gl_billable_time_entries
                                      .ready_to_bill
                                      .includes(:user, :job)
                                      .order(entry_date: :desc)

          # Group by client
          by_client = entries.group_by { |e| e.job&.contact_id }
                             .transform_values do |client_entries|
            {
              entries: client_entries,
              total_hours: client_entries.sum(&:billable_hours),
              total_amount: client_entries.sum(&:amount)
            }
          end

          render json: {
            success: true,
            data: {
              entries: entries.as_json(include: [:user, :job]),
              by_client: by_client,
              totals: {
                total_hours: entries.sum(&:billable_hours),
                total_amount: entries.sum(&:amount),
                entry_count: entries.count
              }
            }
          }
        end

        # GET /api/v1/gl/time_billing/batches
        def batches
          batches = @corporate.gl_time_billing_batches
                                      .includes(:contact, :job, :invoice)
                                      .order(created_at: :desc)

          batches = batches.where(status: params[:status]) if params[:status].present?

          render json: { success: true, data: batches.as_json(include: [:contact, :job]) }
        end

        # POST /api/v1/gl/time_billing/batches
        def create_batch
          contact = Contact.find(params[:contact_id])
          job = params[:job_id].present? ? Job.find(params[:job_id]) : nil

          batch = ::Gl::TimeBillingBatch.create_batch!(
            @corporate,
            contact: contact,
            period_start: Date.parse(params[:period_start]),
            period_end: Date.parse(params[:period_end]),
            job: job,
            user: current_user
          )

          if batch
            render json: { success: true, data: batch }, status: :created
          else
            render json: { success: false, error: "No billable entries found for this period" },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/time_billing/batches/:id/approve
        def approve_batch
          batch = @corporate.gl_time_billing_batches.find(params[:id])

          if batch.approve!
            render json: { success: true, data: batch, message: "Batch approved" }
          else
            render json: { success: false, error: "Cannot approve batch" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/time_billing/batches/:id/generate_invoice
        def generate_invoice
          batch = @corporate.gl_time_billing_batches.find(params[:id])
          invoice = batch.generate_invoice!

          if invoice
            render json: { success: true, data: { batch: batch, invoice: invoice }, message: "Invoice created" }
          else
            render json: { success: false, error: "Cannot generate invoice. Batch must be approved." },
                   status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/time_billing/summary
        def summary
          period_start = params[:start_date] ? Date.parse(params[:start_date]) : Date.current.beginning_of_month
          period_end = params[:end_date] ? Date.parse(params[:end_date]) : Date.current.end_of_month

          entries = @corporate.gl_billable_time_entries.for_period(period_start, period_end)

          render json: {
            success: true,
            data: {
              period: { start: period_start, end: period_end },
              by_status: {
                unbilled: entries.unbilled.sum(:amount),
                pending: entries.pending.sum(:amount),
                approved: entries.approved.sum(:amount),
                billed: entries.billed.sum(:amount)
              },
              totals: {
                total_hours: entries.sum(:billable_hours),
                total_amount: entries.sum(:amount),
                billable_amount: entries.billable.sum(:amount)
              }
            }
          }
        end

        private

        def set_corporate
          @corporate = Corporate.find(params[:corporate_id])
        end

        def rate_params
          params.require(:rate).permit(
            :user_id, :job_id, :contact_id, :rate_type, :role_name,
            :hourly_rate, :overtime_rate, :weekend_rate,
            :effective_from, :effective_to, :active
          )
        end

        def entry_params
          params.require(:entry).permit(
            :user_id, :job_id, :entry_date, :hours, :billable_hours,
            :hourly_rate, :description, :task_type, :billable, :notes
          )
        end
      end
    end
  end
end
