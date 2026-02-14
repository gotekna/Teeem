# frozen_string_literal: true

# Background job: Sync Contact → Corporate for standard contact fields
# Triggered: After contact save if company/trust with linked Corporate record
# SSoT: Contact is THE ONE for name, ABN
class ContactSyncCorporateJob < ApplicationJob
  queue_as :default

  def perform(contact_id)
    contact = Contact.find_by(id: contact_id)
    return unless contact

    # Verify preconditions (same as should_sync_to_corporate?)
    return unless contact.entity_type&.downcase.in?(["company", "trust"])
    return unless contact.company_record.present?

    # Prevent infinite loops
    return if Thread.current[:syncing_contact_to_company]

    Thread.current[:syncing_contact_to_company] = true

    contact.company_record.update!(
      name: contact.display_name,
      abn: contact.abn  # SelfHealing will format with spaces
    )

    Rails.logger.info("ContactSyncCorporateJob: Synced Contact##{contact_id} → Corporate##{contact.company_record.id}")
  rescue StandardError => e
    Rails.logger.error("ContactSyncCorporateJob: Contact##{contact_id} failed - #{e.message}")
    raise  # Re-raise to mark job as failed
  ensure
    Thread.current[:syncing_contact_to_company] = false
  end
end
