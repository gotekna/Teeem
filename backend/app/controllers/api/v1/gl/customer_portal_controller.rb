# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for customer-facing portal
      class CustomerPortalController < ApplicationController
        skip_before_action :authorize_request, only: [:access, :invoice, :pay, :statement, :setup_direct_debit]
        before_action :set_corporate_company, except: [:access, :invoice, :pay, :statement, :setup_direct_debit]
        before_action :validate_portal_token, only: [:invoice, :pay, :statement, :setup_direct_debit]

        # ===== PUBLIC (Token-based) ENDPOINTS =====

        # POST /api/v1/gl/portal/access
        def access
          token = ::Gl::PortalToken.find_by(token: params[:token])

          unless token&.valid_token?
            render json: { success: false, error: "Invalid or expired token" }, status: :unauthorized
            return
          end

          token.access!
          session = token.create_session!(
            ip_address: request.remote_ip,
            user_agent: request.user_agent
          )

          render json: {
            success: true,
            data: {
              session_token: session.session_token,
              token_type: token.token_type,
              contact: token.contact.as_json(only: [:id, :name, :email]),
              expires_at: session.expires_at
            }
          }
        end

        # GET /api/v1/gl/portal/invoice
        def invoice
          invoice = @portal_token.invoice || Gl::Invoice.find_by(id: params[:invoice_id])

          unless invoice && (@portal_token.token_type == "portal" || invoice.id == @portal_token.invoice_id)
            render json: { success: false, error: "Invoice not found" }, status: :not_found
            return
          end

          render json: {
            success: true,
            data: invoice.as_json(include: :lines).merge(
              company: invoice.corporate_company.as_json(only: [:id, :name, :abn]),
              can_pay: invoice.status.in?(%w[submitted approved]) && invoice.amount_due.positive?
            )
          }
        end

        # POST /api/v1/gl/portal/pay
        def pay
          invoice = @portal_token.invoice || Gl::Invoice.find_by(id: params[:invoice_id])

          unless invoice
            render json: { success: false, error: "Invoice not found" }, status: :not_found
            return
          end

          # This would integrate with payment gateway (Stripe, etc.)
          # For now, record payment intent
          render json: {
            success: true,
            data: {
              invoice_id: invoice.id,
              amount: invoice.amount_due,
              payment_methods: available_payment_methods(invoice),
              # Would return Stripe payment intent or similar
              payment_url: generate_payment_url(invoice)
            }
          }
        end

        # GET /api/v1/gl/portal/statement
        def statement
          statements = ::Gl::CustomerStatement
                       .for_contact(@portal_token.contact)
                       .recent
                       .limit(12)

          render json: {
            success: true,
            data: {
              contact: @portal_token.contact.as_json(only: [:id, :name]),
              statements: statements.as_json,
              outstanding: outstanding_invoices(@portal_token.contact)
            }
          }
        end

        # POST /api/v1/gl/portal/setup_direct_debit
        def setup_direct_debit
          mandate = ::Gl::DirectDebitMandate.authorize_online!(
            @portal_token.contact,
            bank_details: {
              bsb: params[:bsb],
              account_number: params[:account_number],
              account_name: params[:account_name]
            },
            ip_address: request.remote_ip,
            frequency: params[:frequency] || "per_invoice"
          )

          render json: { success: true, data: mandate, message: "Direct debit authorized" }
        rescue StandardError => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end

        # ===== ADMIN ENDPOINTS =====

        # GET /api/v1/gl/customer_portal/tokens
        def tokens
          tokens = @corporate_company.gl_portal_tokens
                                     .includes(:contact)
                                     .order(created_at: :desc)

          tokens = tokens.where(contact_id: params[:contact_id]) if params[:contact_id].present?
          tokens = tokens.active if params[:active_only] == "true"

          render json: { success: true, data: tokens.as_json(include: :contact) }
        end

        # POST /api/v1/gl/customer_portal/generate_token
        def generate_token
          contact = Contact.find(params[:contact_id])
          token_type = params[:token_type] || "portal"
          expires_in = params[:expires_in]&.to_i&.days

          token = case token_type
                  when "invoice"
                    invoice = Gl::Invoice.find(params[:invoice_id])
                    ::Gl::PortalToken.for_invoice(invoice, expires_in: expires_in || 30.days)
                  when "statement"
                    ::Gl::PortalToken.for_statement(contact, expires_in: expires_in || 7.days)
                  else
                    ::Gl::PortalToken.for_portal(contact, expires_in: expires_in)
                  end

          portal_url = "#{base_portal_url}/portal/#{token.token}"

          render json: {
            success: true,
            data: {
              token: token,
              portal_url: portal_url
            }
          }, status: :created
        end

        # POST /api/v1/gl/customer_portal/revoke_token/:id
        def revoke_token
          token = @corporate_company.gl_portal_tokens.find(params[:id])
          token.revoke!

          render json: { success: true, message: "Token revoked" }
        end

        # GET /api/v1/gl/customer_portal/statements
        def statements
          statements = @corporate_company.gl_customer_statements
                                         .includes(:contact)
                                         .order(statement_date: :desc)

          statements = statements.where(contact_id: params[:contact_id]) if params[:contact_id].present?

          render json: { success: true, data: statements.as_json(include: :contact) }
        end

        # POST /api/v1/gl/customer_portal/generate_statement
        def generate_statement
          contact = Contact.find(params[:contact_id])

          statement = ::Gl::CustomerStatement.generate!(
            contact,
            as_of: params[:as_of] ? Date.parse(params[:as_of]) : Date.current,
            user: current_user
          )

          render json: { success: true, data: statement }, status: :created
        end

        # POST /api/v1/gl/customer_portal/send_statement/:id
        def send_statement
          statement = @corporate_company.gl_customer_statements.find(params[:id])
          # TODO: Send email
          statement.mark_sent!

          render json: { success: true, data: statement, message: "Statement sent" }
        end

        # GET /api/v1/gl/customer_portal/direct_debits
        def direct_debits
          mandates = @corporate_company.gl_direct_debit_mandates
                                       .includes(:contact)
                                       .order(created_at: :desc)

          mandates = mandates.where(contact_id: params[:contact_id]) if params[:contact_id].present?
          mandates = mandates.active if params[:active_only] == "true"

          render json: { success: true, data: mandates.as_json(include: :contact) }
        end

        # POST /api/v1/gl/customer_portal/cancel_direct_debit/:id
        def cancel_direct_debit
          mandate = @corporate_company.gl_direct_debit_mandates.find(params[:id])
          mandate.cancel!(params[:reason])

          render json: { success: true, data: mandate, message: "Direct debit cancelled" }
        end

        private

        def set_corporate_company
          @corporate_company = CorporateCompany.find(params[:corporate_company_id])
        end

        def validate_portal_token
          @portal_token = ::Gl::PortalToken.find_by(token: params[:token])

          unless @portal_token&.valid_token?
            render json: { success: false, error: "Invalid or expired token" }, status: :unauthorized
          end
        end

        def available_payment_methods(_invoice)
          # Would check what payment methods are configured
          %w[credit_card direct_debit bank_transfer]
        end

        def generate_payment_url(invoice)
          # Would generate Stripe payment link or similar
          "#{base_portal_url}/pay/#{invoice.payment_token}"
        end

        def base_portal_url
          # Would come from settings
          ENV.fetch("PORTAL_URL", "https://pay.teeem.app")
        end

        def outstanding_invoices(contact)
          Gl::Invoice.where(contact: contact, invoice_type: "sales")
                     .where(status: %w[submitted approved])
                     .order(due_date: :asc)
                     .as_json(only: [:id, :reference, :date, :due_date, :total, :amount_due])
        end
      end
    end
  end
end
