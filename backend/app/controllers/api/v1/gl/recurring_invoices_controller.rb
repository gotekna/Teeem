module Api
  module V1
    module Gl
      class RecurringInvoicesController < ApplicationController
        before_action :set_recurring_invoice, only: [:show, :update, :destroy, :pause, :resume, :cancel, :generate_now]

        # GET /api/v1/gl/recurring_invoices
        def index
          recurring_invoices = ::Gl::RecurringInvoice.all

          # Filters
          recurring_invoices = recurring_invoices.where(invoice_type: params[:invoice_type]) if params[:invoice_type].present?
          recurring_invoices = recurring_invoices.where(status: params[:status]) if params[:status].present?
          recurring_invoices = recurring_invoices.where(contact_id: params[:contact_id]) if params[:contact_id].present?
          recurring_invoices = recurring_invoices.where(job_id: params[:job_id]) if params[:job_id].present?
          recurring_invoices = recurring_invoices.where(frequency: params[:frequency]) if params[:frequency].present?
          recurring_invoices = recurring_invoices.active if params[:active] == 'true'

          recurring_invoices = recurring_invoices.includes(:contact, :job, :created_by)
                                                  .order(created_at: :desc)

          render json: {
            success: true,
            data: recurring_invoices.map { |ri| serialize_recurring_invoice(ri) }
          }
        end

        # GET /api/v1/gl/recurring_invoices/:id
        def show
          render json: {
            success: true,
            data: serialize_recurring_invoice(@recurring_invoice, include_generated: true)
          }
        end

        # POST /api/v1/gl/recurring_invoices
        def create
          recurring_invoice = ::Gl::RecurringInvoice.new(recurring_invoice_params)
          recurring_invoice.created_by = current_user

          if recurring_invoice.save
            render json: {
              success: true,
              data: serialize_recurring_invoice(recurring_invoice)
            }, status: :created
          else
            render json: {
              success: false,
              error: recurring_invoice.errors.full_messages.join(', ')
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/recurring_invoices/:id
        def update
          @recurring_invoice.updated_by = current_user

          if @recurring_invoice.update(recurring_invoice_params)
            render json: {
              success: true,
              data: serialize_recurring_invoice(@recurring_invoice)
            }
          else
            render json: {
              success: false,
              error: @recurring_invoice.errors.full_messages.join(', ')
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/recurring_invoices/:id
        def destroy
          if @recurring_invoice.generated_invoices.exists?
            # Soft cancel instead of delete if invoices have been generated
            @recurring_invoice.cancel!
            render json: {
              success: true,
              data: serialize_recurring_invoice(@recurring_invoice),
              message: 'Recurring invoice cancelled (has generated invoices)'
            }
          else
            @recurring_invoice.destroy
            render json: { success: true, message: 'Recurring invoice deleted' }
          end
        end

        # POST /api/v1/gl/recurring_invoices/:id/pause
        def pause
          @recurring_invoice.pause!
          render json: {
            success: true,
            data: serialize_recurring_invoice(@recurring_invoice),
            message: 'Recurring invoice paused'
          }
        end

        # POST /api/v1/gl/recurring_invoices/:id/resume
        def resume
          @recurring_invoice.resume!
          render json: {
            success: true,
            data: serialize_recurring_invoice(@recurring_invoice),
            message: 'Recurring invoice resumed'
          }
        end

        # POST /api/v1/gl/recurring_invoices/:id/cancel
        def cancel
          @recurring_invoice.cancel!
          render json: {
            success: true,
            data: serialize_recurring_invoice(@recurring_invoice),
            message: 'Recurring invoice cancelled'
          }
        end

        # POST /api/v1/gl/recurring_invoices/:id/generate_now
        def generate_now
          unless @recurring_invoice.is_active || @recurring_invoice.status == 'paused'
            return render json: {
              success: false,
              error: 'Cannot generate invoice from cancelled/completed recurring invoice'
            }, status: :unprocessable_entity
          end

          # Temporarily allow generation even if not due
          invoice = @recurring_invoice.transaction do
            invoice = @recurring_invoice.send(:build_invoice_from_template)
            invoice.save!

            @recurring_invoice.occurrences_count += 1
            @recurring_invoice.last_generated_at = Time.current
            @recurring_invoice.save!

            invoice
          end

          render json: {
            success: true,
            data: {
              recurring_invoice: serialize_recurring_invoice(@recurring_invoice),
              generated_invoice: {
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                total: invoice.total,
                status: invoice.status
              }
            },
            message: 'Invoice generated successfully'
          }
        rescue => e
          render json: {
            success: false,
            error: "Failed to generate invoice: #{e.message}"
          }, status: :unprocessable_entity
        end

        # GET /api/v1/gl/recurring_invoices/summary
        def summary
          active_count = ::Gl::RecurringInvoice.active.count
          paused_count = ::Gl::RecurringInvoice.paused.count
          due_today = ::Gl::RecurringInvoice.due_for_generation.count
          total_monthly_value = ::Gl::RecurringInvoice.active.where(frequency: 'monthly').sum(:total)

          render json: {
            success: true,
            data: {
              active_count: active_count,
              paused_count: paused_count,
              due_today: due_today,
              total_monthly_value: total_monthly_value.to_f
            }
          }
        end

        private

        def set_recurring_invoice
          @recurring_invoice = ::Gl::RecurringInvoice.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: 'Recurring invoice not found' }, status: :not_found
        end

        def recurring_invoice_params
          params.require(:recurring_invoice).permit(
            :name, :invoice_type, :description,
            :contact_id, :contact_name, :job_id,
            :frequency, :frequency_interval, :day_of_month, :day_of_week,
            :start_date, :end_date, :occurrences_limit,
            :payment_terms_days, :currency_code, :exchange_rate, :notes,
            :is_active, :auto_approve,
            :send_email_on_generation, :email_to, :email_cc,
            line_items_template: [:item_code, :description, :quantity, :unit_price, :discount_percent, :tax_type, :tax_rate, :account_code]
          )
        end

        def serialize_recurring_invoice(ri, include_generated: false)
          data = {
            id: ri.id,
            name: ri.name,
            invoice_type: ri.invoice_type,
            description: ri.description,
            contact_id: ri.contact_id,
            contact_name: ri.contact_name || ri.contact&.name,
            job_id: ri.job_id,
            job_name: ri.job&.name,
            frequency: ri.frequency,
            frequency_interval: ri.frequency_interval,
            frequency_description: ri.frequency_description,
            day_of_month: ri.day_of_month,
            day_of_week: ri.day_of_week,
            start_date: ri.start_date,
            end_date: ri.end_date,
            occurrences_limit: ri.occurrences_limit,
            occurrences_count: ri.occurrences_count,
            remaining_occurrences: ri.remaining_occurrences,
            next_generation_date: ri.next_generation_date,
            last_generated_at: ri.last_generated_at,
            payment_terms_days: ri.payment_terms_days,
            currency_code: ri.currency_code,
            subtotal: ri.subtotal.to_f,
            total_tax: ri.total_tax.to_f,
            total: ri.total.to_f,
            line_items_template: ri.line_items_template,
            is_active: ri.is_active,
            status: ri.status,
            auto_approve: ri.auto_approve,
            send_email_on_generation: ri.send_email_on_generation,
            email_to: ri.email_to,
            created_by_id: ri.created_by_id,
            created_by_name: ri.created_by&.name,
            created_at: ri.created_at,
            updated_at: ri.updated_at
          }

          if include_generated
            data[:generated_invoices] = ri.generated_invoices.order(created_at: :desc).limit(20).map do |inv|
              {
                id: inv.id,
                invoice_number: inv.invoice_number,
                invoice_date: inv.invoice_date,
                total: inv.total.to_f,
                status: inv.status,
                recurring_sequence: inv.recurring_sequence
              }
            end
          end

          data
        end
      end
    end
  end
end
