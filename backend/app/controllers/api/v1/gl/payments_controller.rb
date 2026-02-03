# frozen_string_literal: true

module Api
  module V1
    module Gl
      class PaymentsController < ApplicationController
        before_action :set_corporate
        before_action :set_payment, only: [ :show, :update, :complete, :void, :allocate ]

        # GET /api/v1/gl/payments
        def index
          payments = scoped_payments
            .includes(:contact, :gl_account, :invoices)
            .order(payment_date: :desc)

          # Filters
          payments = payments.where(payment_type: params[:payment_type]) if params[:payment_type].present?
          payments = payments.where(status: params[:status]) if params[:status].present?
          payments = payments.where(contact_id: params[:contact_id]) if params[:contact_id].present?
          payments = payments.where(gl_account_id: params[:account_id]) if params[:account_id].present?

          # Date range
          if params[:from_date].present?
            payments = payments.where("payment_date >= ?", params[:from_date].to_date)
          end
          if params[:to_date].present?
            payments = payments.where("payment_date <= ?", params[:to_date].to_date)
          end

          render json: {
            success: true,
            data: payments.map { |p| payment_json(p) },
            meta: {
              total: payments.count,
              payment_type: params[:payment_type],
              provider: params[:provider]
            }
          }
        end

        # GET /api/v1/gl/payments/:id
        def show
          render json: {
            success: true,
            data: payment_json(@payment, include_allocations: true)
          }
        end

        # POST /api/v1/gl/payments
        def create
          payment = ::Gl::Payment.new(payment_params)
          payment.corporate = @corporate
          payment.external_provider = params[:provider] if params[:provider].present? && params[:provider] != "standalone"
          payment.external_tenant_id = params[:tenant_id]
          payment.created_in_teeem = true

          if payment.save
            # Auto-allocate if invoice_ids provided
            if params[:invoice_ids].present?
              allocate_to_invoices(payment, params[:invoice_ids])
            end

            render json: {
              success: true,
              message: "Payment created successfully",
              data: payment_json(payment, include_allocations: true)
            }, status: :created
          else
            render json: {
              success: false,
              error: payment.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # PATCH/PUT /api/v1/gl/payments/:id
        def update
          if @payment.completed?
            return render json: {
              success: false,
              error: "Cannot edit completed payments"
            }, status: :unprocessable_entity
          end

          if @payment.update(payment_params)
            render json: {
              success: true,
              message: "Payment updated successfully",
              data: payment_json(@payment, include_allocations: true)
            }
          else
            render json: {
              success: false,
              error: @payment.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/payments/:id/complete
        def complete
          if @payment.complete!
            render json: {
              success: true,
              message: "Payment completed",
              data: payment_json(@payment, include_allocations: true)
            }
          else
            render json: {
              success: false,
              error: "Failed to complete payment"
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/payments/:id/void
        def void
          if @payment.void!
            render json: {
              success: true,
              message: "Payment voided",
              data: payment_json(@payment)
            }
          else
            render json: {
              success: false,
              error: "Failed to void payment"
            }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/payments/:id/allocate
        def allocate
          invoice = scoped_invoices.find(params[:invoice_id])
          amount = params[:amount]&.to_d || @payment.unallocated_amount

          if amount > @payment.unallocated_amount
            return render json: {
              success: false,
              error: "Amount exceeds unallocated balance"
            }, status: :unprocessable_entity
          end

          @payment.allocate_to!(invoice, amount)

          render json: {
            success: true,
            message: "Payment allocated to invoice #{invoice.invoice_number}",
            data: payment_json(@payment, include_allocations: true)
          }
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Invoice not found" }, status: :not_found
        rescue StandardError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        # GET /api/v1/gl/payments/unallocated
        def unallocated
          payments = scoped_payments
            .active
            .includes(:contact, :gl_account)
            .select { |p| !p.fully_allocated? }
            .sort_by(&:payment_date)
            .reverse

          render json: {
            success: true,
            data: payments.map { |p| payment_json(p) },
            meta: {
              total_count: payments.count,
              total_unallocated: payments.sum(&:unallocated_amount)
            }
          }
        end

        # GET /api/v1/gl/payments/summary
        def summary
          payments = scoped_payments.active

          render json: {
            success: true,
            data: {
              customer_payments: {
                count: payments.customer_payments.count,
                total: payments.customer_payments.sum(:amount)
              },
              supplier_payments: {
                count: payments.supplier_payments.count,
                total: payments.supplier_payments.sum(:amount)
              },
              refunds: {
                count: payments.refunds.count,
                total: payments.refunds.sum(:amount)
              },
              by_status: payments.group(:status).count
            }
          }
        end

        private

        def set_corporate
          @corporate = Corporate.find(params[:corporate_id] || current_user&.corporate_id)
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Company not found" }, status: :not_found
        end

        def set_payment
          @payment = scoped_payments.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Payment not found" }, status: :not_found
        end

        def scoped_payments
          scope = ::Gl::Payment.where(corporate: @corporate)

          if params[:provider].present? && params[:provider] != "standalone"
            scope = scope.where(external_provider: params[:provider], external_tenant_id: params[:tenant_id])
          else
            scope = scope.where(external_provider: nil)
          end

          scope
        end

        def scoped_invoices
          scope = ::Gl::Invoice.where(corporate: @corporate)

          if params[:provider].present? && params[:provider] != "standalone"
            scope = scope.where(external_provider: params[:provider], external_tenant_id: params[:tenant_id])
          else
            scope = scope.where(external_provider: nil)
          end

          scope
        end

        def payment_params
          params.require(:payment).permit(
            :payment_number, :payment_type, :payment_date, :reference,
            :contact_id, :contact_name, :amount,
            :gl_account_id, :bank_account_code, :bank_account_name,
            :currency_code, :exchange_rate
          )
        end

        def allocate_to_invoices(payment, invoice_ids)
          invoice_ids.each do |invoice_id|
            next if payment.fully_allocated?

            invoice = scoped_invoices.find_by(id: invoice_id)
            next unless invoice && invoice.amount_due > 0

            payment.allocate_to!(invoice)
          end
        end

        def payment_json(payment, include_allocations: false)
          json = {
            id: payment.id,
            payment_number: payment.payment_number,
            payment_type: payment.payment_type,
            type_badge: payment.type_badge,
            payment_date: payment.payment_date,
            reference: payment.reference,
            contact_id: payment.contact_id,
            contact_name: payment.contact_name,
            amount: payment.amount,
            allocated_amount: payment.allocated_amount,
            unallocated_amount: payment.unallocated_amount,
            fully_allocated: payment.fully_allocated?,
            gl_account_id: payment.gl_account_id,
            bank_account_code: payment.bank_account_code,
            bank_account_name: payment.bank_account_name || payment.gl_account&.name,
            currency_code: payment.currency_code,
            status: payment.status,
            status_badge: payment.status_badge,
            external_provider: payment.external_provider,
            external_payment_id: payment.external_payment_id,
            journalized: payment.journalized,
            created_at: payment.created_at,
            updated_at: payment.updated_at
          }

          if include_allocations
            json[:allocations] = payment.allocations.includes(:gl_invoice).map do |alloc|
              {
                id: alloc.id,
                invoice_id: alloc.gl_invoice_id,
                invoice_number: alloc.gl_invoice.invoice_number,
                invoice_total: alloc.gl_invoice.total,
                amount: alloc.amount
              }
            end

            json[:invoices] = payment.invoices.map do |inv|
              {
                id: inv.id,
                invoice_number: inv.invoice_number,
                invoice_type: inv.invoice_type,
                total: inv.total,
                status: inv.status
              }
            end
          end

          json
        end
      end
    end
  end
end
