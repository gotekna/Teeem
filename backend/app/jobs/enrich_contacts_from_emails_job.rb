# Background job to enrich contacts with data extracted from email signatures
# Finds contacts with emails in the warehouse but missing phone/address data
class EnrichContactsFromEmailsJob < ApplicationJob
  queue_as :default

  def perform(options = {})
    limit = options[:limit] || 100
    contact_ids = options[:contact_ids]  # Optional: specific contacts to enrich

    enriched_count = 0
    skipped_count = 0
    error_count = 0

    contacts_to_enrich = find_contacts_to_enrich(contact_ids, limit)

    Rails.logger.info "[ContactEnrichment] Starting enrichment for #{contacts_to_enrich.count} contacts"

    contacts_to_enrich.each do |contact|
      result = enrich_contact(contact)
      case result
      when :enriched
        enriched_count += 1
      when :skipped
        skipped_count += 1
      when :error
        error_count += 1
      end
    rescue StandardError => e
      Rails.logger.error "[ContactEnrichment] Error enriching contact #{contact.id}: #{e.message}"
      error_count += 1
    end

    Rails.logger.info "[ContactEnrichment] Completed: #{enriched_count} enriched, #{skipped_count} skipped, #{error_count} errors"

    {
      enriched: enriched_count,
      skipped: skipped_count,
      errors: error_count
    }
  end

  private

  def find_contacts_to_enrich(contact_ids, limit)
    contacts = if contact_ids.present?
      Contact.where(id: contact_ids)
    else
      # Find contacts that:
      # 1. Have an email address
      # 2. Are missing phone OR address
      # 3. Have emails in the warehouse from them
      Contact.joins(:contact_emails)
             .where("(mobile_phone IS NULL OR mobile_phone = '') OR (office_phone IS NULL OR office_phone = '') OR (address IS NULL OR address = '')")
             .where("EXISTS (SELECT 1 FROM email_warehouse WHERE LOWER(email_warehouse.from_email) = LOWER(contact_emails.email))")
             .distinct
             .limit(limit)
    end

    contacts
  end

  def enrich_contact(contact)
    return :skipped if contact.email.blank?

    # Find most recent email FROM this contact (signature is in sent emails)
    recent_email = EmailWarehouse
      .where("LOWER(from_email) = ?", contact.email.downcase)
      .where.not(body_text: [ nil, "" ])
      .order(received_at: :desc)
      .first

    return :skipped unless recent_email

    # Try to extract signature data
    extractor = EmailSignatureExtractorService.new(recent_email)

    if extractor.enrich_contact!(contact)
      Rails.logger.info "[ContactEnrichment] Enriched contact #{contact.id} (#{contact.email})"
      :enriched
    else
      :skipped
    end
  end
end
