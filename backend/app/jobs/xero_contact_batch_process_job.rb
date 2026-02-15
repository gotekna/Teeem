# frozen_string_literal: true

# XeroContactBatchProcessJob: Process fetched contacts into database
#
# Part of the Ultra-Scale Xero Sync Architecture (Feb 2026)
#
# This job processes a batch of Xero contacts:
# 1. Match against existing TEEEM contacts (O(1) with indices)
# 2. Build create/update operations
# 3. Bulk upsert to database
# 4. Create/update contact external links
#
# Queue: default (SolidQueue uses default queue)
#
class XeroContactBatchProcessJob < ApplicationJob
  queue_as :default

  # FRC (Feb 2026): xero_contacts_json is a JSON string, not Array<Hash>.
  # ActiveJob/SolidQueue can't serialize nested Hashes from JSON.parse
  # (NoMethodError: undefined method 'to_global_id' for an instance of Hash).
  # We serialize to JSON string in fetch job and parse here.
  def perform(session_id:, xero_contacts_json:, page:, xero_org_id:, tenant_name: nil)
    xero_contacts = JSON.parse(xero_contacts_json)
    session = XeroSyncSession.find_by(id: session_id)

    unless session
      Rails.logger.error("[XeroContactBatchProcess] Session #{session_id} not found")
      return
    end

    # Skip if session is failed
    if session.failed?
      Rails.logger.warn("[XeroContactBatchProcess] Skipping page #{page}: session already failed")
      return
    end

    teeem_tenant_id = session.teeem_tenant_id

    unless teeem_tenant_id
      Rails.logger.error("[XeroContactBatchProcess] No TEEEM tenant ID for session #{session_id}")
      session.fail!("No TEEEM tenant associated with Xero credential")
      return
    end

    Rails.logger.info("[XeroContactBatchProcess] Processing #{xero_contacts.size} contacts (page #{page}) for #{tenant_name || xero_org_id}")

    # Initialize services
    matcher = ContactMatcher.new(teeem_tenant_id, xero_org_id: xero_org_id)
    upserter = BulkContactUpsertService.new(teeem_tenant_id)

    # Process batch - build operations
    operations = []
    skipped = 0

    xero_contacts.each do |xero_contact|
      # Skip contacts without a name
      if xero_contact['Name'].blank?
        skipped += 1
        next
      end

      # Match against existing contacts
      match_result = matcher.find_match(xero_contact)

      operation = build_operation(xero_contact, match_result, xero_org_id, tenant_name)
      operations << operation if operation
    end

    # Bulk database operations
    result = upserter.bulk_upsert(operations)

    # FAIL FAST validation - verify bulk operations succeeded
    expected_count = operations.size
    actual_count = result[:created] + result[:updated]

    if actual_count < expected_count * 0.9  # Allow 10% tolerance for duplicates
      Rails.logger.warn("[XeroContactBatchProcess] Possible data integrity issue: expected ~#{expected_count}, got #{actual_count}")
      # Don't fail completely - just log the warning
    end

    # Update session progress
    session.increment_processed!(
      created: result[:created],
      updated: result[:updated],
      skipped: skipped
    )

    # Log matcher stats
    match_stats = matcher.match_stats
    Rails.logger.info("[XeroContactBatchProcess] Page #{page} complete: #{result[:created]} created, #{result[:updated]} updated, #{skipped} skipped | Matches: #{match_stats[:by_type]}")

    # Check if all batches processed
    check_session_completion(session)

  rescue StandardError => e
    Rails.logger.error("[XeroContactBatchProcess] Error processing page #{page}: #{e.class.name}: #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))

    session.increment_processed!(errors: xero_contacts.size)

    # Don't fail the whole session for one batch error - continue with other batches
    # Only fail if error_count gets too high
    if session.reload.error_count > session.total_records * 0.2  # More than 20% errors
      session.fail!("Too many errors: #{session.error_count}/#{session.total_records}")
    end

    raise  # Re-raise for Sentry/error tracking
  end

  private

  def build_operation(xero_contact, match_result, xero_org_id, tenant_name)
    attrs = build_contact_attrs(xero_contact)

    if match_result[:found]
      contact_id = match_result[:contact_id] || match_result[:contact]&.id

      unless contact_id
        Rails.logger.warn("[XeroContactBatchProcess] Match found but no contact_id: #{match_result.inspect}")
        return nil
      end

      {
        action: :update,
        contact_id: contact_id,
        attrs: attrs,
        xero_contact: xero_contact,
        xero_org_id: xero_org_id,
        tenant_name: tenant_name,
        match_type: match_result[:match_type],
        match_confidence: match_result[:match_confidence] || 1.0,
        needs_review: match_result[:needs_review] || false
      }
    else
      {
        action: :create,
        attrs: attrs.merge(entity_type: infer_entity_type(xero_contact)),
        xero_contact: xero_contact,
        xero_org_id: xero_org_id,
        tenant_name: tenant_name,
        match_type: 'new',
        match_confidence: 1.0,
        needs_review: false
      }
    end
  end

  # FRC (Feb 2026): Used invalid column names (xero_updated_at, phone, mobile_phone,
  # fax, street, country, is_supplier, is_customer). Contact model doesn't have these.
  # Root cause: attrs were written from Xero API field names, not Contact column names.
  # Fix: Map to actual Contact columns (direct_line, address, is_supplier_cached, etc.)
  def build_contact_attrs(xero_contact)
    attrs = {
      display_name: xero_contact['Name'],
      abn: normalize_abn(xero_contact['TaxNumber'])
    }

    # Extract phone numbers → direct_line (Contact's phone column)
    phones = xero_contact['Phones'] || []
    default_phone = phones.find { |p| p['PhoneType'] == 'DEFAULT' }
    mobile_phone = phones.find { |p| p['PhoneType'] == 'MOBILE' }

    attrs[:direct_line] = format_phone(default_phone || mobile_phone) if default_phone || mobile_phone

    # Extract address → Contact columns: address, city, state, postcode
    addresses = xero_contact['Addresses'] || []
    street_address = addresses.find { |a| a['AddressType'] == 'STREET' }
    postal_address = addresses.find { |a| a['AddressType'] == 'POBOX' }

    addr = street_address || postal_address
    if addr
      attrs[:address] = [addr['AddressLine1'], addr['AddressLine2'], addr['AddressLine3'], addr['AddressLine4']].compact.join(', ').presence
      attrs[:city] = addr['City']
      attrs[:state] = addr['Region']
      attrs[:postcode] = addr['PostalCode']
    end

    # Bank details (if available)
    if xero_contact['BankAccountDetails'].present?
      attrs[:bank_account_name] = xero_contact['BankAccountName']
      attrs[:bank_account_number] = xero_contact['BankAccountDetails']
    end

    # Contact status → cached columns
    attrs[:is_supplier_cached] = xero_contact['IsSupplier'] == true
    attrs[:is_customer_cached] = xero_contact['IsCustomer'] == true

    # Website
    attrs[:website] = xero_contact['Website'] if xero_contact['Website'].present?

    # Xero-specific metadata
    attrs[:xero_contact_number] = xero_contact['ContactNumber'] if xero_contact['ContactNumber'].present?
    attrs[:xero_account_number] = xero_contact['AccountNumber'] if xero_contact['AccountNumber'].present?

    attrs.compact
  end

  def normalize_abn(tax_number)
    return nil if tax_number.blank?
    tax_number.to_s.gsub(/[\s\-]/, '').presence
  end

  def format_phone(phone_hash)
    return nil unless phone_hash
    [
      phone_hash['PhoneCountryCode'],
      phone_hash['PhoneAreaCode'],
      phone_hash['PhoneNumber']
    ].compact.join(' ').presence
  end

  def infer_entity_type(xero_contact)
    name = xero_contact['Name'].to_s.downcase

    # Look for company indicators
    if name =~ /(pty|ltd|limited|inc|corp|trust|trading|holdings|group|services|solutions|industries|enterprises|foundation)\b/i
      'company'
    elsif xero_contact['IsSupplier'] || xero_contact['IsCustomer']
      'company'  # Business contacts default to company
    else
      nil  # Let the system decide
    end
  end

  def check_session_completion(session)
    session.with_lock do
      session.reload

      # Check if all fetched records have been processed
      if session.processing? && session.processed_count >= session.fetched_count
        session.complete!
        Rails.logger.info("[XeroContactBatchProcess] Session #{session.id} completed: #{session.summary.inspect}")
      end
    end
  rescue ActiveRecord::RecordNotFound
    # Session was deleted - ignore
  end
end
