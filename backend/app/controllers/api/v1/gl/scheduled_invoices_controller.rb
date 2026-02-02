# frozen_string_literal: true

module Api
  module V1
    module Gl
      class ScheduledInvoicesController < ApplicationController
        # GET /api/v1/gl/scheduled_invoices
        def index
          scheduled = current_company.gl_scheduled_invoices
                                     .includes(:invoice, :created_by)
                                     .order(scheduled_for: :asc)

          # Filter by status if provided
          scheduled = scheduled.where(status: params[:status]) if params[:status].present?

          render json: {
            success: true,
            data: scheduled.map { |s| scheduled_json(s) }
          }
        end

        # GET /api/v1/gl/scheduled_invoices/:id
        def show
          scheduled = find_scheduled_invoice

          render json: {
            success: true,
            data: scheduled_json(scheduled)
          }
        end

        # POST /api/v1/gl/scheduled_invoices
        def create
          invoice = ::Gl::Invoice.find(params[:invoice_id])

          scheduled = current_company.gl_scheduled_invoices.build(
            invoice: invoice,
            scheduled_for: params[:scheduled_for],
            send_email: params.fetch(:send_email, true),
            created_by: current_user,
            status: "pending"
          )

          if scheduled.save
            render json: {
              success: true,
              data: scheduled_json(scheduled),
              message: "Invoice scheduled for #{scheduled.scheduled_for.strftime('%d %b %Y at %H:%M')}"
            }
          else
            render json: {
              success: false,
              error: scheduled.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/scheduled_invoices/:id
        def update
          scheduled = find_scheduled_invoice

          if scheduled.status != "pending"
            return render json: {
              success: false,
              error: "Cannot update a #{scheduled.status} scheduled invoice"
            }, status: :unprocessable_entity
          end

          if scheduled.update(update_params)
            render json: {
              success: true,
              data: scheduled_json(scheduled),
              message: "Schedule updated"
            }
          else
            render json: {
              success: false,
              error: scheduled.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/scheduled_invoices/:id/cancel
        def cancel
          scheduled = find_scheduled_invoice

          if scheduled.status != "pending"
            return render json: {
              success: false,
              error: "Cannot cancel a #{scheduled.status} scheduled invoice"
            }, status: :unprocessable_entity
          end

          scheduled.cancel!

          render json: {
            success: true,
            data: scheduled_json(scheduled),
            message: "Scheduled invoice cancelled"
          }
        end

        # POST /api/v1/gl/scheduled_invoices/:id/send_now
        def send_now
          scheduled = find_scheduled_invoice

          if scheduled.status != "pending"
            return render json: {
              success: false,
              error: "Cannot send a #{scheduled.status} scheduled invoice"
            }, status: :unprocessable_entity
          end

          scheduled.send_invoice!

          render json: {
            success: true,
            data: scheduled_json(scheduled.reload),
            message: "Invoice sent successfully"
          }
        end

        # GET /api/v1/gl/scheduled_invoices/upcoming
        def upcoming
          scheduled = current_company.gl_scheduled_invoices
                                     .upcoming
                                     .includes(:invoice, :created_by)
                                     .limit(params[:limit] || 10)

          render json: {
            success: true,
            data: scheduled.map { |s| scheduled_json(s) }
          }
        end

        # POST /api/v1/gl/scheduled_invoices/process_due
        # Called by scheduled job to process due invoices
        def process_due
          count = 0
          ::Gl::ScheduledInvoice.due_now.find_each do |scheduled|
            scheduled.send_invoice!
            count += 1 if scheduled.status == "sent"
          end

          render json: {
            success: true,
            message: "Processed #{count} scheduled invoices"
          }
        end

        private

        def find_scheduled_invoice
          current_company.gl_scheduled_invoices.find(params[:id])
        end

        def update_params
          params.permit(:scheduled_for, :send_email)
        end

        def scheduled_json(scheduled)
          {
            id: scheduled.id,
            invoice_id: scheduled.invoice_id,
            invoice_number: scheduled.invoice.invoice_number,
            invoice_contact: scheduled.invoice.contact&.name,
            invoice_total: scheduled.invoice.total,
            scheduled_for: scheduled.scheduled_for,
            status: scheduled.status,
            send_email: scheduled.send_email,
            sent_at: scheduled.sent_at,
            cancelled_at: scheduled.cancelled_at,
            error_message: scheduled.error_message,
            created_by: scheduled.created_by&.name,
            created_at: scheduled.created_at
          }
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
