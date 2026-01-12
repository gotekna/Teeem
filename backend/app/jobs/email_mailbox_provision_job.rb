# frozen_string_literal: true

# EmailMailboxProvisionJob - Provision mailbox in PolarisMail
#
# Creates a mailbox in PolarisMail for a pending EmailMailbox record.
# Called when a subscription is activated after payment.
#
# Usage:
#   EmailMailboxProvisionJob.perform_later(mailbox.id)
#
class EmailMailboxProvisionJob < ApplicationJob
  queue_as :default

  # Retry on transient API errors
  retry_on PolarisMailService::ApiError, wait: :exponentially_longer, attempts: 5
  retry_on PolarisMailService::RateLimitError, wait: 1.minute, attempts: 10

  def perform(mailbox_id)
    mailbox = EmailMailbox.find_by(id: mailbox_id)
    return unless mailbox
    return if mailbox.status == "active" # Already provisioned

    subscription = mailbox.email_subscription
    Rails.logger.info "[EmailMailboxProvisionJob] Provisioning mailbox #{mailbox.email_address}"

    begin
      mailbox.update!(status: "provisioning")

      # Get or create PolarisMail account for this subscription
      polaris_service = PolarisMailService.new
      account_id = ensure_polaris_account(subscription, polaris_service)

      # Create the mailbox in PolarisMail
      result = polaris_service.create_mailbox(
        account_id: account_id,
        email: mailbox.email_address,
        display_name: mailbox.display_name || mailbox.email_address.split("@").first,
        type: mailbox.mailbox_type,
        quota_gb: mailbox.storage_quota_gb || 50
      )

      # Update mailbox with PolarisMail ID
      mailbox.update!(
        polaris_mailbox_id: result["id"],
        status: "active",
        provisioned_at: Time.current,
        metadata: mailbox.metadata.merge(
          "polaris_response" => result,
          "provisioned_by_job" => true
        )
      )

      # Update subscription mailbox count
      subscription.sync_mailbox_count!

      Rails.logger.info "[EmailMailboxProvisionJob] Successfully provisioned #{mailbox.email_address}"

    rescue PolarisMailService::ApiError => e
      Rails.logger.error "[EmailMailboxProvisionJob] Failed to provision #{mailbox.email_address}: #{e.message}"
      mailbox.mark_failed!(e.message)
      raise # Re-raise for retry logic
    rescue StandardError => e
      Rails.logger.error "[EmailMailboxProvisionJob] Unexpected error: #{e.message}"
      mailbox.mark_failed!(e.message)
      raise
    end
  end

  private

  # Ensure subscription has a PolarisMail account
  def ensure_polaris_account(subscription, polaris_service)
    return subscription.polaris_account_id if subscription.polaris_account_id.present?

    # Create new account in PolarisMail
    result = polaris_service.create_account(
      domain: subscription.domain,
      contact_email: subscription.contact.email
    )

    subscription.update!(polaris_account_id: result["id"])
    result["id"]
  end
end
