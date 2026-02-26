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
  rescue ActiveRecord::RecordNotUnique => e
    # ABN already owned by a different Corporate record (two Contacts share the same ABN).
    # This is a data integrity conflict, not a job failure - skip silently with a warning.
    # Root cause: duplicate ABN across Contacts should be resolved in the UI.
    Rails.logger.warn("ContactSyncCorporateJob: Contact##{contact_id} skipped - ABN conflict: #{e.message}")
  rescue ActiveRecord::RecordInvalid => e
    # Model-level uniqueness validation fires before the DB constraint (same root cause as above).
    raise unless e.message.include?("Abn has already been taken")

    Rails.logger.warn("ContactSyncCorporateJob: Contact##{contact_id} skipped - ABN already taken: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("ContactSyncCorporateJob: Contact##{contact_id} failed - #{e.message}")
    raise  # Re-raise to mark job as failed
  ensure
    Thread.current[:syncing_contact_to_company] = false
  end
end
