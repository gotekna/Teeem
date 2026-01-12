# frozen_string_literal: true

# StripeSubscriptionService - Handles Stripe subscriptions for email hosting
#
# Manages recurring billing for email subscriptions including:
# - Subscription creation via Checkout Session
# - Subscription updates (add/remove mailboxes)
# - Cancellation and pausing
# - Webhook handling for invoice events
#
# Usage:
#   service = StripeSubscriptionService.new
#   session = service.create_checkout_session(
#     email_subscription: subscription,
#     success_url: "https://...",
#     cancel_url: "https://..."
#   )
#
class StripeSubscriptionService
  class SubscriptionError < StandardError; end

  def initialize
    @api_key = ENV.fetch("STRIPE_SECRET_KEY", nil)
    raise SubscriptionError, "Stripe API key not configured" unless @api_key

    Stripe.api_key = @api_key
  end

  # Create or retrieve Stripe customer for contact
  # @param contact [Contact] The contact to create customer for
  # @return [Stripe::Customer] The Stripe customer
  def find_or_create_customer(contact)
    if contact.stripe_customer_id.present?
      begin
        return Stripe::Customer.retrieve(contact.stripe_customer_id)
      rescue Stripe::InvalidRequestError
        # Customer was deleted in Stripe, create new one
        contact.update!(stripe_customer_id: nil)
      end
    end

    customer = Stripe::Customer.create({
      email: contact.email,
      name: contact.display_name,
      metadata: {
        contact_id: contact.id,
        teeem_contact: true
      }
    })

    contact.update!(stripe_customer_id: customer.id)
    customer
  end

  # Create a Checkout Session for subscription
  # @param email_subscription [EmailSubscription] The subscription
  # @param success_url [String] URL to redirect on success
  # @param cancel_url [String] URL to redirect on cancel
  # @return [Stripe::Checkout::Session]
  def create_checkout_session(email_subscription:, success_url:, cancel_url:)
    contact = email_subscription.contact
    customer = find_or_create_customer(contact)

    # Build line items from mailboxes
    line_items = build_line_items(email_subscription)

    session = Stripe::Checkout::Session.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: line_items,
      mode: "subscription",
      success_url: success_url,
      cancel_url: cancel_url,
      client_reference_id: email_subscription.id.to_s,
      subscription_data: {
        metadata: {
          email_subscription_id: email_subscription.id,
          domain: email_subscription.domain,
          contact_id: contact.id
        }
      },
      metadata: {
        email_subscription_id: email_subscription.id,
        type: "email_hosting"
      }
    })

    # Store session ID
    email_subscription.update!(
      stripe_checkout_session_id: session.id,
      status: "payment_pending"
    )

    session
  end

  # Handle successful checkout completion
  # @param session_id [String] Stripe Checkout Session ID
  # @return [EmailSubscription, nil]
  def handle_checkout_complete(session_id)
    session = Stripe::Checkout::Session.retrieve({
      id: session_id,
      expand: ["subscription"]
    })

    email_subscription = EmailSubscription.find_by(
      stripe_checkout_session_id: session_id
    )
    return nil unless email_subscription

    subscription = session.subscription

    email_subscription.update!(
      stripe_subscription_id: subscription.id,
      stripe_customer_id: session.customer,
      status: "active",
      current_period_start: Time.at(subscription.current_period_start),
      current_period_end: Time.at(subscription.current_period_end)
    )

    # Trigger mailbox provisioning
    email_subscription.email_mailboxes.pending.each(&:provision!)

    email_subscription
  end

  # Handle subscription invoice paid
  # @param invoice [Stripe::Invoice] The Stripe invoice object
  def handle_invoice_paid(invoice)
    subscription_id = invoice.subscription
    return unless subscription_id

    email_subscription = EmailSubscription.find_by(
      stripe_subscription_id: subscription_id
    )
    return unless email_subscription

    # Create billing record
    EmailSubscriptionInvoice.create!(
      email_subscription: email_subscription,
      stripe_invoice_id: invoice.id,
      billing_period_start: Time.at(invoice.period_start),
      billing_period_end: Time.at(invoice.period_end),
      retail_amount: invoice.amount_paid / 100.0,
      wholesale_amount: calculate_wholesale(email_subscription),
      status: "paid",
      paid_at: Time.current
    )

    # Update subscription period
    if invoice.subscription
      stripe_sub = Stripe::Subscription.retrieve(invoice.subscription)
      email_subscription.update!(
        current_period_start: Time.at(stripe_sub.current_period_start),
        current_period_end: Time.at(stripe_sub.current_period_end)
      )
    end
  end

  # Handle subscription invoice payment failed
  # @param invoice [Stripe::Invoice] The Stripe invoice object
  def handle_invoice_failed(invoice)
    subscription_id = invoice.subscription
    return unless subscription_id

    email_subscription = EmailSubscription.find_by(
      stripe_subscription_id: subscription_id
    )
    return unless email_subscription

    email_subscription.update!(status: "payment_failed")

    # Create failed billing record
    EmailSubscriptionInvoice.create!(
      email_subscription: email_subscription,
      stripe_invoice_id: invoice.id,
      billing_period_start: Time.at(invoice.period_start),
      billing_period_end: Time.at(invoice.period_end),
      retail_amount: invoice.amount_due / 100.0,
      wholesale_amount: calculate_wholesale(email_subscription),
      status: "failed"
    )

    # TODO: Send payment failed notification
    Rails.logger.warn "[StripeSubscriptionService] Payment failed for subscription #{email_subscription.id}"
  end

  # Handle subscription cancelled/deleted
  # @param subscription_id [String] Stripe subscription ID
  def handle_subscription_cancelled(subscription_id)
    email_subscription = EmailSubscription.find_by(
      stripe_subscription_id: subscription_id
    )
    return unless email_subscription

    email_subscription.update!(
      status: "cancelled",
      cancelled_at: Time.current
    )

    Rails.logger.info "[StripeSubscriptionService] Subscription #{email_subscription.id} cancelled"
  end

  # Update subscription (add/remove line items)
  # @param email_subscription [EmailSubscription]
  # @return [Stripe::Subscription]
  def update_subscription(email_subscription)
    return nil unless email_subscription.stripe_subscription_id

    stripe_sub = Stripe::Subscription.retrieve(email_subscription.stripe_subscription_id)

    # Get current items
    current_items = stripe_sub.items.data

    # Build new items
    new_items = build_subscription_items(email_subscription)

    # Update subscription
    Stripe::Subscription.update(
      email_subscription.stripe_subscription_id,
      {
        items: build_update_items(current_items, new_items),
        proration_behavior: "create_prorations"
      }
    )
  end

  # Cancel subscription
  # @param email_subscription [EmailSubscription]
  # @param at_period_end [Boolean] Whether to cancel at period end
  # @return [Stripe::Subscription]
  def cancel_subscription(email_subscription, at_period_end: true)
    return nil unless email_subscription.stripe_subscription_id

    if at_period_end
      Stripe::Subscription.update(
        email_subscription.stripe_subscription_id,
        { cancel_at_period_end: true }
      )
    else
      Stripe::Subscription.cancel(email_subscription.stripe_subscription_id)
    end
  end

  # Retrieve subscription from Stripe
  # @param subscription_id [String]
  # @return [Stripe::Subscription]
  def retrieve_subscription(subscription_id)
    Stripe::Subscription.retrieve(subscription_id)
  end

  # Get or create Stripe product for email hosting
  # @return [String] Product ID
  def email_hosting_product_id
    @product_id ||= begin
      product_name = "Email Hosting - PolarisMail"
      existing = Stripe::Product.list(limit: 100).data.find { |p| p.name == product_name }

      if existing
        existing.id
      else
        product = Stripe::Product.create({
          name: product_name,
          description: "Professional email hosting via PolarisMail",
          metadata: { teeem_product: "email_hosting" }
        })
        product.id
      end
    end
  end

  private

  def build_line_items(email_subscription)
    pricing = EmailPricingService.new
    items = []

    # Count mailboxes by type
    mailbox_counts = email_subscription.email_mailboxes.group(:mailbox_type).count

    mailbox_counts.each do |type, count|
      price = pricing.retail_price(type)
      items << {
        price_data: {
          currency: "aud",
          unit_amount: (price * 100).to_i,
          product: email_hosting_product_id,
          recurring: { interval: "month" }
        },
        quantity: count
      }
    end

    items
  end

  def build_subscription_items(email_subscription)
    pricing = EmailPricingService.new
    items = []

    mailbox_counts = email_subscription.email_mailboxes.group(:mailbox_type).count

    mailbox_counts.each do |type, count|
      price = pricing.retail_price(type)
      items << {
        type: type,
        quantity: count,
        unit_amount: (price * 100).to_i
      }
    end

    items
  end

  def build_update_items(current_items, new_items)
    # For simplicity, delete all existing and add new
    # In production, you'd want to match and update
    updates = []

    current_items.each do |item|
      updates << { id: item.id, deleted: true }
    end

    new_items.each do |item|
      updates << {
        price_data: {
          currency: "aud",
          unit_amount: item[:unit_amount],
          product: email_hosting_product_id,
          recurring: { interval: "month" }
        },
        quantity: item[:quantity]
      }
    end

    updates
  end

  def calculate_wholesale(email_subscription)
    pricing = EmailPricingService.new
    total = 0.0

    email_subscription.email_mailboxes.each do |mailbox|
      total += pricing.wholesale_price(mailbox.mailbox_type)
    end

    total
  end
end
