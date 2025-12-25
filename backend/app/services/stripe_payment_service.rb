# frozen_string_literal: true

class StripePaymentService
  class PaymentError < StandardError; end

  def initialize
    @api_key = ENV.fetch("STRIPE_SECRET_KEY", nil)
    raise PaymentError, "Stripe API key not configured" unless @api_key

    Stripe.api_key = @api_key
  end

  # Create a Checkout Session for invoice payment
  def create_checkout_session(payment_link:, success_url:, cancel_url:)
    invoice = payment_link.invoice
    config = StripeConfiguration.current

    # Calculate surcharge if configured
    subtotal = payment_link.amount
    surcharge = config.calculate_surcharge(subtotal)
    total = subtotal + surcharge

    # Build line items
    line_items = [
      {
        price_data: {
          currency: payment_link.currency.downcase,
          unit_amount: (subtotal * 100).to_i, # Stripe uses cents
          product_data: {
            name: "Invoice #{invoice.invoice_number}",
            description: invoice.description || "Payment for invoice #{invoice.invoice_number}"
          }
        },
        quantity: 1
      }
    ]

    # Add surcharge line item if applicable
    if surcharge.positive?
      line_items << {
        price_data: {
          currency: payment_link.currency.downcase,
          unit_amount: (surcharge * 100).to_i,
          product_data: {
            name: "Card Processing Fee",
            description: "#{config.surcharge_percentage}% card processing fee"
          }
        },
        quantity: 1
      }
    end

    # Create Stripe Checkout Session
    session = Stripe::Checkout::Session.create({
      payment_method_types: enabled_payment_methods(config),
      line_items: line_items,
      mode: "payment",
      success_url: success_url,
      cancel_url: cancel_url,
      client_reference_id: payment_link.token,
      customer_email: payment_link.contact.email,
      metadata: {
        payment_link_id: payment_link.id,
        invoice_id: invoice.id,
        contact_id: payment_link.contact_id,
        invoice_number: invoice.invoice_number
      },
      payment_intent_data: {
        description: "Payment for Invoice #{invoice.invoice_number}",
        metadata: {
          payment_link_token: payment_link.token,
          invoice_number: invoice.invoice_number
        }
      }
    })

    # Update payment link with session ID
    payment_link.update!(stripe_checkout_session_id: session.id)

    session
  end

  # Create a Payment Intent directly (for embedded payment form)
  def create_payment_intent(payment_link:)
    invoice = payment_link.invoice
    config = StripeConfiguration.current

    total = config.total_with_surcharge(payment_link.amount)

    intent = Stripe::PaymentIntent.create({
      amount: (total * 100).to_i,
      currency: payment_link.currency.downcase,
      description: "Payment for Invoice #{invoice.invoice_number}",
      receipt_email: payment_link.contact.email,
      metadata: {
        payment_link_id: payment_link.id,
        payment_link_token: payment_link.token,
        invoice_id: invoice.id,
        contact_id: payment_link.contact_id,
        invoice_number: invoice.invoice_number
      }
    })

    # Update payment link
    payment_link.update!(stripe_payment_intent_id: intent.id)

    # Create pending payment record
    StripePayment.create_pending!(
      invoice: invoice,
      contact: payment_link.contact,
      payment_link: payment_link,
      amount: payment_link.amount,
      payment_intent_id: intent.id
    )

    intent
  end

  # Handle successful payment (called from webhook)
  def handle_payment_success(payment_intent_id:)
    payment_intent = Stripe::PaymentIntent.retrieve(payment_intent_id)

    # Find or create payment record
    payment = StripePayment.find_by(stripe_payment_intent_id: payment_intent_id)
    payment ||= find_or_create_payment_from_intent(payment_intent)

    return unless payment

    # Extract charge details
    charge = payment_intent.latest_charge
    charge_data = if charge.is_a?(String)
      Stripe::Charge.retrieve(charge)
    else
      charge
    end

    # Extract card details
    card_details = extract_card_details(charge_data)

    # Mark as succeeded
    payment.mark_succeeded!(
      charge_id: charge_data&.id,
      receipt_url: charge_data&.receipt_url,
      card_brand: card_details[:brand],
      card_last4: card_details[:last4],
      payment_method: "card",
      fee: calculate_stripe_fee(charge_data)
    )

    # Send receipt notification
    PaymentNotificationJob.perform_later(payment.id, :receipt) if defined?(PaymentNotificationJob)

    payment
  end

  # Handle failed payment
  def handle_payment_failure(payment_intent_id:, failure_message: nil)
    payment = StripePayment.find_by(stripe_payment_intent_id: payment_intent_id)
    return unless payment

    payment.mark_failed!(failure_message)
    payment
  end

  # Process a refund
  def refund_payment(payment_intent_id:, amount: nil, reason: nil)
    params = { payment_intent: payment_intent_id }
    params[:amount] = (amount * 100).to_i if amount
    params[:reason] = reason if reason.in?(%w[duplicate fraudulent requested_by_customer])

    Stripe::Refund.create(params)
  end

  # Retrieve checkout session
  def retrieve_checkout_session(session_id)
    Stripe::Checkout::Session.retrieve(session_id)
  end

  # Verify webhook signature
  def verify_webhook(payload:, signature:, endpoint_secret:)
    Stripe::Webhook.construct_event(payload, signature, endpoint_secret)
  rescue Stripe::SignatureVerificationError => e
    raise PaymentError, "Invalid webhook signature: #{e.message}"
  end

  private

  def enabled_payment_methods(config)
    methods = []
    methods << "card" if config.card_payments_enabled?
    # Note: Bank transfer requires additional setup with Stripe
    methods << "au_becs_debit" if config.bank_transfer_enabled?
    methods = ["card"] if methods.empty?
    methods
  end

  def find_or_create_payment_from_intent(payment_intent)
    metadata = payment_intent.metadata

    payment_link = PaymentLink.find_by(id: metadata["payment_link_id"])
    invoice = ExternalInvoice.find_by(id: metadata["invoice_id"])
    contact = Contact.find_by(id: metadata["contact_id"])

    return nil unless invoice && contact

    StripePayment.create!(
      payment_link: payment_link,
      invoice: invoice,
      contact: contact,
      amount: payment_intent.amount / 100.0,
      currency: payment_intent.currency.upcase,
      status: "pending",
      stripe_payment_intent_id: payment_intent.id
    )
  end

  def extract_card_details(charge)
    return {} unless charge&.payment_method_details&.card

    card = charge.payment_method_details.card
    {
      brand: card.brand,
      last4: card.last4,
      exp_month: card.exp_month,
      exp_year: card.exp_year
    }
  end

  def calculate_stripe_fee(charge)
    return nil unless charge

    # Stripe fees are typically 1.7% + 30c for Australian cards
    # For international cards: 2.9% + 30c
    # This is an estimate - actual fees come from balance transactions
    amount = charge.amount / 100.0
    (amount * 0.017 + 0.30).round(2)
  end
end
