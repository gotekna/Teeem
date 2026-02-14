# frozen_string_literal: true

# Background job: Auto-link unlinked Xero invoices to Contact
# Triggered: After contact create/update if display_name or company_name_or_trust present
# SSoT: Finds ExternalInvoices with matching contact_name and links them
class ContactAutoLinkInvoicesJob < ApplicationJob
  queue_as :default

  def perform(contact_id)
    contact = Contact.find_by(id: contact_id)
    return unless contact

    names_to_match = [
      contact.display_name&.strip&.squish&.downcase,
      contact.company_name_or_trust&.strip&.squish&.downcase
    ].compact.reject(&:blank?).uniq

    return if names_to_match.empty?

    # Find unlinked invoices with matching contact_name (case-insensitive, trimmed)
    linked_count = 0
    names_to_match.each do |name|
      count = ExternalInvoice.where(contact_id: nil)
        .where("LOWER(TRIM(contact_name)) = ?", name)
        .update_all(contact_id: contact.id)
      linked_count += count
    end

    if linked_count > 0
      Rails.logger.info("ContactAutoLinkInvoicesJob: Contact##{contact_id} (#{contact.display_name}) auto-linked #{linked_count} unlinked Xero invoices")
    end
  rescue StandardError => e
    Rails.logger.error("ContactAutoLinkInvoicesJob: Contact##{contact_id} failed - #{e.message}")
    raise  # Re-raise to mark job as failed
  end
end
