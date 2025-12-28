# ContactEmailMatchJob - Match emails to contacts based on email addresses
#
# This job runs AFTER email sync to associate emails with contacts in the system.
# It's a separate process because:
#   - It's expensive to match thousands of emails
#   - Contacts can be added/updated independently
#   - Matching logic can be improved over time without re-syncing emails
#
# Usage:
#   ContactEmailMatchJob.perform_now(credential_id)
#   ContactEmailMatchJob.perform_later(credential_id)
#   ContactEmailMatchJob.perform_now(credential_id, rematch: true)  # Re-match all emails
#
# Matching Logic:
#   1. Extract all email addresses from: from_email, to_emails, cc_emails, bcc_emails
#   2. Match against contacts.email (exact match, case-insensitive)
#   3. Set primary_contact_id based on direction:
#      - Received emails: primary = sender (from_email)
#      - Sent emails: primary = first recipient (to_emails[0])
#   4. Set contact_ids array with ALL matched contacts

class ContactEmailMatchJob < ApplicationJob
  queue_as :low

  def perform(credential_id, rematch: false)
    # SSoT: Use MicrosoftCredential
    @credential = MicrosoftCredential.find_by(id: credential_id)

    unless @credential
      Rails.logger.info "[ContactMatch] Credential #{credential_id} not found"
      return
    end

    Rails.logger.info "[ContactMatch] Starting contact matching for #{@credential.name}"

    # Build email -> contact_id lookup map for fast matching
    @email_to_contact = build_contact_lookup_map

    Rails.logger.info "[ContactMatch] Built lookup map with #{@email_to_contact.size} contacts"

    # Get emails to process
    scope = EmailWarehouse.where(microsoft_credential_id: @credential.id)

    if rematch
      # Re-match all emails
      scope = scope.all
    else
      # Only match emails that haven't been matched yet
      scope = scope.where(contacts_matched_at: nil)
    end

    total = scope.count
    Rails.logger.info "[ContactMatch] Found #{total} emails to match"

    return { matched: 0, total: 0 } if total == 0

    matched = 0
    scope.find_each(batch_size: 100) do |email|
      match_contacts_for_email(email)
      matched += 1

      if matched % 100 == 0
        Rails.logger.info "[ContactMatch] Progress: #{matched}/#{total} emails matched"
      end
    end

    Rails.logger.info "[ContactMatch] Completed: #{matched} emails matched"

    { matched: matched, total: total }
  end

  private

  def build_contact_lookup_map
    # Build a hash of email => contact_id for fast lookup
    # Normalize emails to lowercase for case-insensitive matching
    lookup = {}

    Contact.where.not(email: nil).find_each do |contact|
      next if contact.email.blank?

      normalized_email = contact.email.downcase.strip
      lookup[normalized_email] = contact.id
    end

    lookup
  end

  def match_contacts_for_email(email)
    # Extract all email addresses involved in this email
    all_email_addresses = extract_email_addresses(email)

    # Match each email address to a contact
    matched_contact_ids = all_email_addresses.map do |addr|
      @email_to_contact[addr.downcase.strip]
    end.compact.uniq

    # Determine primary contact based on direction
    primary_contact_id = determine_primary_contact(email, matched_contact_ids)

    # Update email record
    email.update!(
      contact_ids: matched_contact_ids,
      primary_contact_id: primary_contact_id,
      contacts_matched_at: Time.current
    )
  end

  def extract_email_addresses(email)
    addresses = []

    # Add sender
    addresses << email.from_email if email.from_email.present?

    # Add recipients
    addresses.concat(email.to_emails) if email.to_emails.present?
    addresses.concat(email.cc_emails) if email.cc_emails.present?
    addresses.concat(email.bcc_emails) if email.bcc_emails.present?

    addresses.compact.uniq
  end

  def determine_primary_contact(email, matched_contact_ids)
    return nil if matched_contact_ids.empty?

    # Determine if email was sent or received by mailbox owner
    is_sent = email.from_email&.downcase == email.mailbox_owner_email&.downcase

    if is_sent
      # For sent emails, primary contact is the first recipient
      primary_email = email.to_emails&.first
    else
      # For received emails, primary contact is the sender
      primary_email = email.from_email
    end

    return nil unless primary_email.present?

    # Look up the contact ID for the primary email
    @email_to_contact[primary_email.downcase.strip]
  end
end
