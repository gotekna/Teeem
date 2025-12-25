# frozen_string_literal: true

module Api
  module V1
    class PaymentPortalController < ApplicationController
      skip_before_action :authenticate_request, only: [:show, :create_checkout, :success, :webhook]
      before_action :set_payment_link, only: [:show, :create_checkout]

      # GET /api/v1/pay/:token
      # Public endpoint - get invoice details for payment
      def show
        @payment_link.record_view!

        invoice = @payment_link.invoice
        contact = @payment_link.contact
        config = StripeConfiguration.current

        surcharge = config.calculate_surcharge(@payment_link.amount)
        total = @payment_link.amount + surcharge

        render json: {
          success: true,
          data: {
            payment_link: {
              token: @payment_link.token,
              amount: @payment_link.amount.to_f,
              surcharge: surcharge.to_f,
              surcharge_percentage: config.surcharge_percentage.to_f,
              total: total.to_f,
              currency: @payment_link.currency,
              status: @payment_link.status,
              expires_at: @payment_link.expires_at
            },
            invoice: {
              id: invoice.id,
              invoice_number: invoice.invoice_number,
              reference: invoice.reference,
              description: invoice.description,
              date: invoice.invoice_date,
              due_date: invoice.due_date,
              total: invoice.total.to_f,
              amount_paid: invoice.amount_paid.to_f,
              amount_due: invoice.amount_due.to_f,
              status: invoice.status,
              line_items: invoice.line_items || []
            },
            contact: {
              name: contact.display_name,
              company: contact.company_name,
              email: contact.email
            },
            payment_methods: {
              card: config.card_payments_enabled?,
              bank_transfer: config.bank_transfer_enabled?
            },
            can_pay: @payment_link.valid_for_payment? && config.meets_minimum?(@payment_link.amount)
          }
        }
      end

      # POST /api/v1/pay/:token/checkout
      # Create Stripe Checkout session
      def create_checkout
        unless @payment_link.valid_for_payment?
          return render json: {
            success: false,
            error: @payment_link.expired? ? "This payment link has expired" : "This invoice has already been paid"
          }, status: :unprocessable_entity
        end

        service = StripePaymentService.new
        base_url = request.base_url

        session = service.create_checkout_session(
          payment_link: @payment_link,
          success_url: "#{base_url}/api/v1/pay/#{@payment_link.token}/success?session_id={CHECKOUT_SESSION_ID}",
          cancel_url: "#{base_url}/pay/#{@payment_link.token}?cancelled=true"
        )

        render json: {
          success: true,
          data: {
            checkout_url: session.url,
            session_id: session.id
          }
        }
      rescue StripePaymentService::PaymentError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue Stripe::StripeError => e
        Rails.logger.error("Stripe error creating checkout: #{e.message}")
        render json: { success: false, error: "Payment service unavailable. Please try again." }, status: :service_unavailable
      end

      # GET /api/v1/pay/:token/success
      # Handle successful payment redirect
      def success
        token = params[:token]
        session_id = params[:session_id]

        payment_link = PaymentLink.find_by(token: token)

        unless payment_link
          return render json: { success: false, error: "Payment link not found" }, status: :not_found
        end

        # Verify the session with Stripe
        service = StripePaymentService.new
        session = service.retrieve_checkout_session(session_id)

        if session.payment_status == "paid"
          # Process the payment
          service.handle_payment_success(payment_intent_id: session.payment_intent)

          render json: {
            success: true,
            data: {
              status: "paid",
              message: "Payment successful! Thank you.",
              invoice_number: payment_link.invoice.invoice_number,
              amount: payment_link.amount.to_f,
              receipt_url: session.payment_intent.present? ?
                Stripe::PaymentIntent.retrieve(session.payment_intent).charges.data.first&.receipt_url : nil
            }
          }
        else
          render json: {
            success: false,
            error: "Payment not completed",
            status: session.payment_status
          }, status: :unprocessable_entity
        end
      rescue Stripe::StripeError => e
        Rails.logger.error("Stripe error on success: #{e.message}")
        render json: { success: false, error: "Unable to verify payment" }, status: :service_unavailable
      end

      # POST /api/v1/pay/webhook
      # Stripe webhook handler
      def webhook
        payload = request.body.read
        sig_header = request.env["HTTP_STRIPE_SIGNATURE"]
        endpoint_secret = ENV["STRIPE_WEBHOOK_SECRET"]

        unless endpoint_secret
          Rails.logger.warn("Stripe webhook secret not configured")
          return head :ok
        end

        begin
          service = StripePaymentService.new
          event = service.verify_webhook(
            payload: payload,
            signature: sig_header,
            endpoint_secret: endpoint_secret
          )
        rescue StripePaymentService::PaymentError => e
          Rails.logger.error("Webhook signature verification failed: #{e.message}")
          return render json: { error: e.message }, status: :bad_request
        end

        # Handle the event
        case event.type
        when "payment_intent.succeeded"
          handle_payment_intent_succeeded(event.data.object)
        when "payment_intent.payment_failed"
          handle_payment_intent_failed(event.data.object)
        when "checkout.session.completed"
          handle_checkout_completed(event.data.object)
        when "charge.refunded"
          handle_charge_refunded(event.data.object)
        else
          Rails.logger.info("Unhandled Stripe event type: #{event.type}")
        end

        head :ok
      end

      # --- Admin endpoints (require authentication) ---

      # GET /api/v1/payment_links
      # List payment links (admin)
      def index
        links = PaymentLink.includes(:invoice, :contact)
                          .order(created_at: :desc)
                          .limit(params[:limit] || 50)

        links = links.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          data: links.map { |l| payment_link_json(l) }
        }
      end

      # POST /api/v1/payment_links
      # Create a new payment link (admin)
      def create
        invoice = ExternalInvoice.find(params[:invoice_id])

        link = PaymentLink.create_for_invoice!(
          invoice,
          created_by: current_user,
          expires_in: params[:expires_in_days]&.to_i&.days || 30.days
        )

        render json: {
          success: true,
          data: payment_link_json(link)
        }, status: :created
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Invoice not found" }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/payments
      # List payments (admin)
      def payments
        payments = StripePayment.includes(:invoice, :contact, :payment_link)
                         .order(created_at: :desc)
                         .limit(params[:limit] || 50)

        payments = payments.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          data: payments.map { |p| payment_json(p) }
        }
      end

      # GET /api/v1/payments/stats
      # Payment statistics
      def stats
        today_payments = StripePayment.successful.today
        all_successful = StripePayment.successful

        render json: {
          success: true,
          data: {
            today: {
              count: today_payments.count,
              total: today_payments.sum(:amount).to_f,
              fees: today_payments.sum(:stripe_fee).to_f
            },
            all_time: {
              count: all_successful.count,
              total: all_successful.sum(:amount).to_f,
              fees: all_successful.sum(:stripe_fee).to_f
            },
            pending: StripePayment.pending.count,
            failed: StripePayment.failed.count
          }
        }
      end

      private

      def set_payment_link
        @payment_link = PaymentLink.find_by_token!(params[:token])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Payment link not found or expired" }, status: :not_found
      end

      def handle_payment_intent_succeeded(payment_intent)
        service = StripePaymentService.new
        service.handle_payment_success(payment_intent_id: payment_intent.id)
      end

      def handle_payment_intent_failed(payment_intent)
        service = StripePaymentService.new
        service.handle_payment_failure(
          payment_intent_id: payment_intent.id,
          failure_message: payment_intent.last_payment_error&.message
        )
      end

      def handle_checkout_completed(session)
        return unless session.payment_intent

        service = StripePaymentService.new
        service.handle_payment_success(payment_intent_id: session.payment_intent)
      end

      def handle_charge_refunded(charge)
        payment = StripePayment.find_by(stripe_charge_id: charge.id)
        return unless payment

        refunded_amount = charge.amount_refunded / 100.0
        payment.update!(
          status: refunded_amount >= payment.amount ? "refunded" : "partially_refunded",
          refunded_amount: refunded_amount,
          refunded_at: Time.current
        )
      end

      def payment_link_json(link)
        {
          id: link.id,
          token: link.token,
          invoice_id: link.invoice_id,
          invoice_number: link.invoice.invoice_number,
          contact_id: link.contact_id,
          contact_name: link.contact.display_name,
          amount: link.amount.to_f,
          currency: link.currency,
          status: link.status,
          payment_url: link.payment_url,
          view_count: link.view_count,
          expires_at: link.expires_at,
          paid_at: link.paid_at,
          created_at: link.created_at
        }
      end

      def payment_json(payment)
        {
          id: payment.id,
          invoice_id: payment.invoice_id,
          invoice_number: payment.invoice.invoice_number,
          contact_id: payment.contact_id,
          contact_name: payment.contact.display_name,
          amount: payment.amount.to_f,
          stripe_fee: payment.stripe_fee&.to_f,
          net_amount: payment.net_amount&.to_f,
          currency: payment.currency,
          status: payment.status,
          display_status: payment.display_status,
          card_display: payment.card_display,
          receipt_url: payment.stripe_receipt_url,
          paid_at: payment.paid_at,
          created_at: payment.created_at
        }
      end
    end
  end
end
