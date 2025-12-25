# frozen_string_literal: true

module Api
  module V1
    module Gl
      class InvoicesController < ApplicationController
        before_action :set_corporate_company
        before_action :set_invoice, only: [ :show, :update, :destroy, :approve, :void ]

        # GET /api/v1/gl/invoices
        def index
          invoices = scoped_invoices
            .includes(:contact, :job, :lines)
            .order(invoice_date: :desc)

          # Filters
          invoices = invoices.where(invoice_type: params[:invoice_type]) if params[:invoice_type].present?
          invoices = invoices.where(status: params[:status]) if params[:status].present?
          invoices = invoices.where(contact_id: params[:contact_id]) if params[:contact_id].present?
          invoices = invoices.where(job_id: params[:job_id]) if params[:job_id].present?

          # Date range
          if params[:from_date].present?
            invoices = invoices.where("invoice_date >= ?", params[:from_date].to_date)
          end
          if params[:to_date].present?
            invoices = invoices.where("invoice_date <= ?", params[:to_date].to_date)
          end

          # Overdue filter
          if params[:overdue] == "true"
            invoices = invoices.overdue
          end

          render json: {
            success: true,
            data: invoices.map { |i| invoice_json(i) },
            meta: {
              total: invoices.count,
              invoice_type: params[:invoice_type],
              provider: params[:provider]
            }
          }
        end

        # GET /api/v1/gl/invoices/:id
        def show
          render json: {
            success: true,
            data: invoice_json(@invoice, include_lines: true)
          }
        end

        # POST /api/v1/gl/invoices
        def create
          invoice = ::Gl::Invoice.new(invoice_params)
          invoice.corporate_company = @corporate_company
          invoice.external_provider = params[:provider] if params[:provider].present? && params[:provider] != "standalone"
          invoice.external_tenant_id = params[:tenant_id]
          invoice.created_in_teeem = true

          if invoice.save
            render json: {
              success: true,
              message: "Invoice created successfully",
              data: invoice_json(invoice, include_lines: true)
            }, status: :created
          else
            render json: {
              success: false,
              error: invoice.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # PATCH/PUT /api/v1/gl/invoices/:id
        def update
          unless @invoice.editable?
            return render json: {
              success: false,
              error: "Cannot edit invoice in #{@invoice.status} status"
            }, status: :unprocessable_entity
          end

          if @invoice.update(invoice_params)
            @invoice.mark_for_push! if @invoice.linked?

            render json: {
              success: true,
              message: "Invoice updated successfully",
              data: invoice_json(@invoice, include_lines: true)
            }
          else
            render json: {
              success: false,
              error: @invoice.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/invoices/:id
        def destroy
          unless @invoice.draft?
            return render json: {
              success: false,
              error: "Can only delete draft invoices"
            }, status: :unprocessable_entity
          end

          @invoice.destroy

          render json: {
            success: true,
            message: "Invoice deleted"
          }
        end

        # POST /api/v1/gl/invoices/:id/approve
        def approve
          if @invoice.approve!(current_user)
            @invoice.mark_for_push! if @invoice.linked?

            render json: {
              success: true,
              message: "Invoice approved",
              data: invoice_json(@invoice, include_lines: true)
            }
          else
            render json: {
              success: false,
              error: "Failed to approve invoice"
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/invoices/:id/void
        def void
          if @invoice.void!(params[:reason])
            @invoice.mark_for_push! if @invoice.linked?

            render json: {
              success: true,
              message: "Invoice voided",
              data: invoice_json(@invoice)
            }
          else
            render json: {
              success: false,
              error: "Failed to void invoice"
            }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/invoices/summary
        def summary
          invoices = scoped_invoices.active

          # Group by type and status
          by_type = invoices.group(:invoice_type).count
          by_status = invoices.group(:status).count

          # Totals
          totals = {
            sales_invoices: {
              count: invoices.sales_invoices.count,
              total: invoices.sales_invoices.sum(:total),
              due: invoices.sales_invoices.sum(:amount_due),
              overdue: invoices.sales_invoices.overdue.sum(:amount_due)
            },
            bills: {
              count: invoices.bills.count,
              total: invoices.bills.sum(:total),
              due: invoices.bills.sum(:amount_due),
              overdue: invoices.bills.overdue.sum(:amount_due)
            }
          }

          render json: {
            success: true,
            data: {
              by_type: by_type,
              by_status: by_status,
              totals: totals
            }
          }
        end

        # GET /api/v1/gl/invoices/overdue
        def overdue
          invoices = scoped_invoices
            .overdue
            .includes(:contact, :job)
            .order(:due_date)

          invoices = invoices.where(invoice_type: params[:invoice_type]) if params[:invoice_type].present?

          render json: {
            success: true,
            data: invoices.map { |i| invoice_json(i) },
            meta: {
              total_count: invoices.count,
              total_amount: invoices.sum(:amount_due)
            }
          }
        end

        private

        def set_corporate_company
          @corporate_company = CorporateCompany.find(params[:corporate_company_id] || current_user&.corporate_company_id)
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Company not found" }, status: :not_found
        end

        def set_invoice
          @invoice = scoped_invoices.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Invoice not found" }, status: :not_found
        end

        def scoped_invoices
          scope = ::Gl::Invoice.where(corporate_company: @corporate_company)

          if params[:provider].present? && params[:provider] != "standalone"
            scope = scope.where(external_provider: params[:provider], external_tenant_id: params[:tenant_id])
          else
            scope = scope.where(external_provider: nil)
          end

          scope
        end

        def invoice_params
          params.require(:invoice).permit(
            :invoice_number, :invoice_type, :reference, :invoice_date, :due_date,
            :contact_id, :contact_name, :job_id, :description, :notes,
            :currency_code, :exchange_rate,
            lines_attributes: [
              :id, :gl_account_id, :line_number, :item_code, :description,
              :quantity, :unit_price, :discount_rate, :discount_amount,
              :gl_tax_rate_id, :tax_type, :job_id,
              :tracking_category_1, :tracking_option_1,
              :tracking_category_2, :tracking_option_2,
              :_destroy
            ]
          )
        end

        def invoice_json(invoice, include_lines: false)
          json = {
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            invoice_type: invoice.invoice_type,
            type_badge: invoice.type_badge,
            reference: invoice.reference,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            contact_id: invoice.contact_id,
            contact_name: invoice.contact_name,
            job_id: invoice.job_id,
            job_name: invoice.job&.title,
            subtotal: invoice.subtotal,
            total_tax: invoice.total_tax,
            total: invoice.total,
            amount_due: invoice.amount_due,
            amount_paid: invoice.amount_paid,
            currency_code: invoice.currency_code,
            status: invoice.status,
            status_badge: invoice.status_badge,
            overdue: invoice.overdue?,
            days_overdue: invoice.days_overdue,
            external_provider: invoice.external_provider,
            external_invoice_id: invoice.external_invoice_id,
            journalized: invoice.journalized,
            created_at: invoice.created_at,
            updated_at: invoice.updated_at
          }

          if include_lines
            json[:lines] = invoice.lines.ordered.map do |line|
              {
                id: line.id,
                line_number: line.line_number,
                gl_account_id: line.gl_account_id,
                account_code: line.gl_account&.code,
                account_name: line.gl_account&.name,
                item_code: line.item_code,
                description: line.description,
                quantity: line.quantity,
                unit_price: line.unit_price,
                discount_rate: line.discount_rate,
                discount_amount: line.discount_amount,
                line_amount: line.line_amount,
                tax_type: line.tax_type,
                tax_amount: line.tax_amount,
                total: line.total,
                job_id: line.job_id,
                job_name: line.job&.title
              }
            end
          end

          json
        end
      end
    end
  end
end
