# frozen_string_literal: true

# EmailSubscriptionBillingJob - Daily billing reconciliation for email subscriptions
#
# Runs daily to:
# 1. Sync subscription status from Stripe
# 2. Handle failed payments and dunning
# 3. Create GL::Invoice records for accounting
# 4. Generate margin/profit reports
#
# Runs daily via solid_queue recurring schedule
# See config/recurring.yml
#
# Usage:
#   EmailSubscriptionBillingJob.perform_now
#
class EmailSubscriptionBillingJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info "[EmailSubscriptionBillingJob] Starting daily billing reconciliation"

    stats = {
      synced: 0,
      payment_issues: 0,
      invoices_created: 0,
      errors: []
    }

    # Process all active subscriptions
    EmailSubscription.active.find_each do |subscription|
      process_subscription(subscription, stats)
    rescue StandardError => e
      Rails.logger.error "[EmailSubscriptionBillingJob] Error processing subscription #{subscription.id}: #{e.message}"
      stats[:errors] << { subscription_id: subscription.id, error: e.message }
    end

    # Handle payment failures
    handle_payment_failures(stats)

    # Check for expired invites
    expire_old_invites

    Rails.logger.info "[EmailSubscriptionBillingJob] Complete: #{stats.inspect}"
    stats
  end

  private

  def process_subscription(subscription, stats)
    return unless subscription.stripe_subscription_id

    # Sync status from Stripe
    stripe_service = StripeSubscriptionService.new
    stripe_sub = stripe_service.retrieve_subscription(subscription.stripe_subscription_id)

    # Update local status
    old_status = subscription.status
    new_status = map_stripe_status(stripe_sub.status)

    if old_status != new_status
      subscription.update!(status: new_status)
      Rails.logger.info "[EmailSubscriptionBillingJob] Subscription #{subscription.id} status: #{old_status} -> #{new_status}"
    end

    # Update period dates
    subscription.update!(
      current_period_start: Time.at(stripe_sub.current_period_start),
      current_period_end: Time.at(stripe_sub.current_period_end)
    )

    # Create GL invoice if needed for this billing period
    create_gl_invoice_if_needed(subscription, stats)

    stats[:synced] += 1
  rescue Stripe::InvalidRequestError => e
    # Subscription was deleted in Stripe
    if e.message.include?("No such subscription")
      subscription.update!(status: "cancelled")
      Rails.logger.warn "[EmailSubscriptionBillingJob] Subscription #{subscription.id} not found in Stripe, marked cancelled"
    else
      raise
    end
  end

  def map_stripe_status(stripe_status)
    case stripe_status
    when "active", "trialing"
      "active"
    when "past_due"
      "payment_failed"
    when "canceled", "cancelled"
      "cancelled"
    when "unpaid"
      "suspended"
    when "paused"
      "paused"
    else
      "active"
    end
  end

  def create_gl_invoice_if_needed(subscription, stats)
    # Check if we need to create a GL invoice for the current period
    period_start = subscription.current_period_start&.to_date
    period_end = subscription.current_period_end&.to_date
    return unless period_start && period_end

    # Check if invoice already exists for this period
    existing = subscription.email_subscription_invoices.for_period(period_start, period_end).first
    return if existing&.gl_invoice.present?

    # Find paid invoice record for this period
    paid_invoice = subscription.email_subscription_invoices
                              .paid
                              .for_period(period_start, period_end)
                              .first
    return unless paid_invoice

    # Create GL invoice for internal accounting
    paid_invoice.create_gl_invoice!
    stats[:invoices_created] += 1

    Rails.logger.info "[EmailSubscriptionBillingJob] Created GL invoice for subscription #{subscription.id}"
  rescue StandardError => e
    Rails.logger.error "[EmailSubscriptionBillingJob] GL invoice creation failed: #{e.message}"
    stats[:errors] << { subscription_id: subscription.id, error: "GL invoice: #{e.message}" }
  end

  def handle_payment_failures(stats)
    # Find subscriptions with payment issues
    failed_subscriptions = EmailSubscription.where(status: "payment_failed")

    failed_subscriptions.find_each do |subscription|
      # Check how long it's been failing
      last_invoice = subscription.email_subscription_invoices.failed.recent.first
      next unless last_invoice

      days_overdue = (Date.current - last_invoice.billing_period_end.to_date).to_i

      if days_overdue > 14
        # Suspend after 14 days of non-payment
        subscription.update!(status: "suspended")
        Rails.logger.warn "[EmailSubscriptionBillingJob] Suspended subscription #{subscription.id} - #{days_overdue} days overdue"
        # TODO: Notify contact of suspension
      elsif days_overdue > 7
        # Send reminder after 7 days
        # TODO: Send payment reminder email
        Rails.logger.info "[EmailSubscriptionBillingJob] Payment reminder needed for subscription #{subscription.id}"
      end

      stats[:payment_issues] += 1
    end
  end

  def expire_old_invites
    # Expire migration invites past their expiry date
    expired_count = EmailMigrationInvite
                     .where(status: %w[pending payment_pending])
                     .where("expires_at < ?", Time.current)
                     .update_all(status: "expired")

    if expired_count.positive?
      Rails.logger.info "[EmailSubscriptionBillingJob] Expired #{expired_count} migration invites"
    end
  end
end
