require 'fuzzy_match'

class XeroContactSyncService
  attr_reader :stats

  SIMILARITY_THRESHOLD = 0.85
  RATE_LIMIT_SLEEP = 1200 # milliseconds between API calls (1.2s) to avoid Xero rate limits (60 requests per minute)

  def initialize
    @xero_client = XeroApiClient.new
    @stats = {
      matched: 0,
      created_in_teeem: 0,
      created_in_xero: 0,
      updated: 0,
      errors: [],
      skipped: 0
    }
    @sync_timestamp = Time.current
  end

  # Main sync method
  def sync
    Rails.logger.info("Starting Xero contact sync at #{@sync_timestamp}")

    begin
      # Fetch all contacts from both systems
      xero_contacts = fetch_xero_contacts
      teeem_contacts = Contact.all.to_a

      Rails.logger.info("Fetched #{xero_contacts.length} Xero contacts and #{teeem_contacts.length} TEEEM contacts")

      # Process contacts
      process_contacts(xero_contacts, teeem_contacts)

      Rails.logger.info("Xero contact sync completed: #{@stats.inspect}")

      {
        success: true,
        stats: @stats,
        synced_at: @sync_timestamp
      }
    rescue XeroApiClient::AuthenticationError => e
      error_msg = "Authentication error: #{e.message}"
      Rails.logger.error("Xero sync failed: #{error_msg}")
      @stats[:errors] << error_msg
      { success: false, error: error_msg, stats: @stats }
    rescue XeroApiClient::RateLimitError => e
      error_msg = "Rate limit exceeded: #{e.message}"
      Rails.logger.error("Xero sync failed: #{error_msg}")
      @stats[:errors] << error_msg
      { success: false, error: error_msg, stats: @stats }
    rescue StandardError => e
      error_msg = "Sync failed: #{e.message}"
      Rails.logger.error("Xero sync failed: #{error_msg}")
      Rails.logger.error(e.backtrace.join("\n"))
      @stats[:errors] << error_msg
      { success: false, error: error_msg, stats: @stats }
    end
  end

  # Make methods public for use by XeroContactSyncJob
  def fetch_xero_contacts
    result = @xero_client.get('Contacts')

    if result[:success]
      contacts = result[:data]['Contacts'] || []
      Rails.logger.info("Successfully fetched #{contacts.length} contacts from Xero")
      contacts
    else
      raise XeroApiClient::ApiError, "Failed to fetch Xero contacts"
    end
  end

  def process_contacts(xero_contacts, teeem_contacts)
    # Track which contacts have been matched
    matched_teeem_ids = Set.new
    matched_xero_ids = Set.new

    # Build lookup maps for efficient matching
    teeem_by_xero_id = teeem_contacts.select { |c| c.xero_id.present? }
                                       .index_by(&:xero_id)
    teeem_by_tax_number = teeem_contacts.select { |c| c.tax_number.present? }
                                          .group_by(&:tax_number)
    teeem_by_email = teeem_contacts.select { |c| c.email.present? }
                                     .index_by { |c| c.email.downcase.strip }

    # Process each Xero contact
    xero_contacts.each do |xero_contact|
      begin
        teeem_contact = find_matching_teeem_contact(
          xero_contact,
          teeem_by_xero_id,
          teeem_by_tax_number,
          teeem_by_email,
          teeem_contacts - matched_teeem_ids.map { |id| teeem_contacts.find { |c| c.id == id } }.compact
        )

        if teeem_contact
          # Match found - update both systems
          matched_teeem_ids.add(teeem_contact.id)
          matched_xero_ids.add(xero_contact['ContactID'])
          sync_matched_contact(teeem_contact, xero_contact)
          @stats[:matched] += 1
        else
          # No match - create in TEEEM
          create_teeem_contact_from_xero(xero_contact)
          matched_xero_ids.add(xero_contact['ContactID'])
          @stats[:created_in_teeem] += 1
        end

        # Small delay to avoid rate limits
        sleep(RATE_LIMIT_SLEEP / 1000.0)
      rescue StandardError => e
        error_msg = "Error processing Xero contact #{xero_contact['Name']}: #{e.message}"
        Rails.logger.error(error_msg)
        @stats[:errors] << error_msg
      end
    end

    # Process unmatched TEEEM contacts that should sync to Xero
    unmatched_teeem = teeem_contacts.reject { |c| matched_teeem_ids.include?(c.id) }
    unmatched_teeem.select { |c| c.sync_with_xero }.each do |teeem_contact|
      begin
        create_xero_contact_from_teeem(teeem_contact)
        @stats[:created_in_xero] += 1
        sleep(RATE_LIMIT_SLEEP / 1000.0)
      rescue StandardError => e
        error_msg = "Error creating Xero contact for #{teeem_contact.display_name}: #{e.message}"
        Rails.logger.error(error_msg)
        @stats[:errors] << error_msg
      end
    end

    # Count skipped contacts (TEEEM contacts not synced because sync_with_xero is false)
    @stats[:skipped] = unmatched_teeem.reject { |c| c.sync_with_xero }.count
  end

  def find_matching_teeem_contact(xero_contact, by_xero_id, by_tax_number, by_email, remaining_contacts)
    xero_id = xero_contact['ContactID']
    xero_tax = xero_contact['TaxNumber']
    xero_email = extract_xero_email(xero_contact)
    xero_name = xero_contact['Name']

    # Priority 1: Match by xero_id
    if by_xero_id[xero_id]
      Rails.logger.debug("Matched by xero_id: #{xero_name}")
      return by_xero_id[xero_id]
    end

    # Priority 2: Match by tax_number (ABN/ACN)
    if xero_tax.present?
      normalized_tax = normalize_tax_number(xero_tax)
      matches = by_tax_number[normalized_tax]
      if matches && matches.any?
        Rails.logger.debug("Matched by tax_number: #{xero_name}")
        return matches.first
      end
    end

    # Priority 3: Match by exact email
    if xero_email.present?
      normalized_email = xero_email.downcase.strip
      match = by_email[normalized_email]
      if match
        Rails.logger.debug("Matched by email: #{xero_name}")
        return match
      end
    end

    # Priority 4: Match by fuzzy name (>85% similarity)
    if xero_name.present? && remaining_contacts.any?
      match = fuzzy_match_by_name(xero_name, remaining_contacts)
      if match
        Rails.logger.debug("Matched by fuzzy name: #{xero_name} -> #{match.display_name}")
        return match
      end
    end

    nil
  end

  def fuzzy_match_by_name(xero_name, contacts)
    return nil if contacts.empty?

    # Create fuzzy matcher with contact names
    contact_names = contacts.map { |c| [c.display_name, c] }.to_h
    matcher = FuzzyMatch.new(contact_names.keys)

    # Find best match
    matched_name = matcher.find(xero_name, threshold: SIMILARITY_THRESHOLD)

    matched_name ? contact_names[matched_name] : nil
  end

  def sync_matched_contact(teeem_contact, xero_contact)
    Rails.logger.info("Syncing matched contact: TEEEM ##{teeem_contact.id} <-> Xero #{xero_contact['Name']}")

    # Determine which system has newer data (or if we should update both)
    # For simplicity, we'll update TEEEM with Xero data and mark as synced
    # In production, you might want more sophisticated conflict resolution

    update_teeem_from_xero(teeem_contact, xero_contact)

    # If the data differs significantly, we might also want to update Xero
    # For now, we'll just ensure the link is established
  end

  def update_teeem_from_xero(teeem_contact, xero_contact)
    updates = {
      xero_id: xero_contact['ContactID'],
      last_synced_at: @sync_timestamp,
      xero_sync_error: nil
    }

    # Update fields if Xero has data and TEEEM doesn't, or if explicitly syncing
    updates[:full_name] = xero_contact['Name'] if xero_contact['Name'].present?
    updates[:first_name] = xero_contact['FirstName'] if xero_contact['FirstName'].present?
    updates[:last_name] = xero_contact['LastName'] if xero_contact['LastName'].present?
    updates[:tax_number] = normalize_tax_number(xero_contact['TaxNumber']) if xero_contact['TaxNumber'].present?

    # Extract email from Xero contact
    xero_email = extract_xero_email(xero_contact)
    updates[:email] = xero_email if xero_email.present?

    # Extract phone numbers
    if xero_contact['Phones'].present?
      xero_contact['Phones'].each do |phone|
        case phone['PhoneType']
        when 'MOBILE'
          updates[:mobile_phone] = phone['PhoneNumber'] if phone['PhoneNumber'].present?
        when 'DEFAULT', 'DDI'
          updates[:office_phone] = phone['PhoneNumber'] if phone['PhoneNumber'].present?
        end
      end
    end

    # Extract bank account details
    if xero_contact['BankAccountDetails'].present?
      # BankAccountDetails is a string in format "BSB: 123456, Account Number: 98765432, Account Name: Business Account"
      bank_details = xero_contact['BankAccountDetails']

      # Try to parse BSB
      if bank_details.match(/BSB[:\s]+(\d{6})/)
        updates[:bank_bsb] = $1
      end

      # Try to parse account number
      if bank_details.match(/Account Number[:\s]+([\d\s]+)/)
        updates[:bank_account_number] = $1.gsub(/\s/, '')
      end

      # Try to parse account name
      if bank_details.match(/Account Name[:\s]+([^,\n]+)/)
        updates[:bank_account_name] = $1.strip
      end
    end

    # Extract purchase account and payment terms
    if xero_contact['PurchaseDetails'].present? && xero_contact['PurchaseDetails']['AccountCode'].present?
      updates[:default_purchase_account] = xero_contact['PurchaseDetails']['AccountCode']
    end

    if xero_contact['PaymentTerms'].present? && xero_contact['PaymentTerms']['Bills'].present?
      bills = xero_contact['PaymentTerms']['Bills']
      updates[:bill_due_day] = bills['Day'] if bills['Day'].present?
      updates[:bill_due_type] = bills['Type'] if bills['Type'].present?
    end

    # Track changes for activity logging
    changed_fields = updates.keys - [:xero_id, :last_synced_at, :xero_sync_error]
    changes_made = changed_fields.each_with_object({}) do |field, hash|
      old_value = teeem_contact.send(field)
      new_value = updates[field]
      hash[field] = { from: old_value, to: new_value } if old_value != new_value
    end

    teeem_contact.update!(updates)
    @stats[:updated] += 1
    Rails.logger.info("Updated TEEEM contact ##{teeem_contact.id}")

    # Log activity if there were changes
    if changes_made.any?
      ContactActivity.log_xero_sync(
        contact: teeem_contact,
        action: 'updated',
        changes: changes_made,
        xero_data: xero_contact
      )
    end
  rescue StandardError => e
    error_msg = "Failed to update TEEEM contact: #{e.message}"
    teeem_contact.update(xero_sync_error: error_msg)
    raise
  end

  def create_teeem_contact_from_xero(xero_contact)
    Rails.logger.info("Creating TEEEM contact from Xero: #{xero_contact['Name']}")

    contact_data = {
      xero_id: xero_contact['ContactID'],
      full_name: xero_contact['Name'],
      first_name: xero_contact['FirstName'],
      last_name: xero_contact['LastName'],
      tax_number: normalize_tax_number(xero_contact['TaxNumber']),
      email: extract_xero_email(xero_contact),
      sync_with_xero: true,
      last_synced_at: @sync_timestamp
    }

    # Extract phone numbers
    if xero_contact['Phones'].present?
      xero_contact['Phones'].each do |phone|
        case phone['PhoneType']
        when 'MOBILE'
          contact_data[:mobile_phone] = phone['PhoneNumber']
        when 'DEFAULT', 'DDI'
          contact_data[:office_phone] = phone['PhoneNumber']
        end
      end
    end

    new_contact = Contact.create!(contact_data.compact)
    Rails.logger.info("Created TEEEM contact from Xero: #{xero_contact['Name']}")

    # Log activity for new contact creation
    ContactActivity.log_xero_sync(
      contact: new_contact,
      action: 'created',
      changes: {},
      xero_data: xero_contact
    )
  rescue StandardError => e
    error_msg = "Failed to create TEEEM contact from Xero: #{e.message}"
    Rails.logger.error(error_msg)
    raise
  end

  def create_xero_contact_from_teeem(teeem_contact)
    Rails.logger.info("Creating Xero contact from TEEEM: #{teeem_contact.display_name}")

    # Build Xero contact payload
    xero_payload = {
      Contacts: [
        build_xero_contact_payload(teeem_contact)
      ]
    }

    result = @xero_client.post('Contacts', xero_payload)

    if result[:success]
      created_contact = result[:data]['Contacts']&.first
      if created_contact
        teeem_contact.update!(
          xero_id: created_contact['ContactID'],
          last_synced_at: @sync_timestamp,
          xero_sync_error: nil
        )
        Rails.logger.info("Created Xero contact: #{created_contact['ContactID']}")
      end
    else
      raise XeroApiClient::ApiError, "Failed to create contact in Xero"
    end
  rescue StandardError => e
    error_msg = "Failed to create Xero contact: #{e.message}"
    teeem_contact.update(xero_sync_error: error_msg)
    raise
  end

  def build_xero_contact_payload(teeem_contact)
    payload = {
      Name: teeem_contact.full_name || "#{teeem_contact.first_name} #{teeem_contact.last_name}".strip
    }

    payload[:FirstName] = teeem_contact.first_name if teeem_contact.first_name.present?
    payload[:LastName] = teeem_contact.last_name if teeem_contact.last_name.present?
    payload[:EmailAddress] = teeem_contact.email if teeem_contact.email.present?
    payload[:TaxNumber] = teeem_contact.tax_number if teeem_contact.tax_number.present?

    # Add phone numbers
    phones = []
    if teeem_contact.mobile_phone.present?
      phones << {
        PhoneType: 'MOBILE',
        PhoneNumber: teeem_contact.mobile_phone
      }
    end
    if teeem_contact.office_phone.present?
      phones << {
        PhoneType: 'DEFAULT',
        PhoneNumber: teeem_contact.office_phone
      }
    end
    payload[:Phones] = phones if phones.any?

    payload
  end

  def extract_xero_email(xero_contact)
    # Xero can have email in EmailAddress field or in Addresses array
    return xero_contact['EmailAddress'] if xero_contact['EmailAddress'].present?

    # Check addresses for email
    if xero_contact['Addresses'].present?
      xero_contact['Addresses'].each do |address|
        return address['EmailAddress'] if address['EmailAddress'].present?
      end
    end

    nil
  end

  def normalize_tax_number(tax_number)
    return nil if tax_number.blank?
    # Remove spaces, dashes, and other formatting
    tax_number.to_s.gsub(/[\s\-]/, '').upcase
  end

  # Helper to set sync timestamp (useful for job)
  def set_sync_timestamp(timestamp)
    @sync_timestamp = timestamp
  end
end
