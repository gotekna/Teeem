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
      contact_persons_synced: 0,
      deleted_from_teeem: 0,
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
      xero_ids = process_contacts(xero_contacts, teeem_contacts)

      # Clean up TEEEM contacts that no longer exist in Xero
      cleanup_deleted_xero_contacts(xero_ids)

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

    # ONE-WAY SYNC: Xero → TEEEM only (disabled TEEEM → Xero push)
    # This prevents changes in TEEEM from affecting Xero data
    # To re-enable two-way sync, uncomment the code below
    #
    # Process unmatched TEEEM contacts that should sync to Xero
    # unmatched_teeem = teeem_contacts.reject { |c| matched_teeem_ids.include?(c.id) }
    # unmatched_teeem.select { |c| c.sync_with_xero }.each do |teeem_contact|
    #   begin
    #     create_xero_contact_from_teeem(teeem_contact)
    #     @stats[:created_in_xero] += 1
    #     sleep(RATE_LIMIT_SLEEP / 1000.0)
    #   rescue StandardError => e
    #     error_msg = "Error creating Xero contact for #{teeem_contact.display_name}: #{e.message}"
    #     Rails.logger.error(error_msg)
    #     @stats[:errors] << error_msg
    #   end
    # end
    #
    # # Count skipped contacts (TEEEM contacts not synced because sync_with_xero is false)
    # @stats[:skipped] = unmatched_teeem.reject { |c| c.sync_with_xero }.count

    # Count TEEEM-only contacts that won't be pushed to Xero
    unmatched_teeem = teeem_contacts.reject { |c| matched_teeem_ids.include?(c.id) }
    @stats[:skipped] = unmatched_teeem.count
    Rails.logger.info("ONE-WAY SYNC MODE: #{@stats[:skipped]} TEEEM contacts not pushed to Xero")

    # Return set of all Xero IDs we processed
    matched_xero_ids
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

    # Extract contact types from Xero IsCustomer/IsSupplier flags
    contact_types = []
    contact_types << 'customer' if xero_contact['IsCustomer'] == true
    contact_types << 'supplier' if xero_contact['IsSupplier'] == true
    updates[:contact_types] = contact_types if contact_types.any?

    # Determine if this is a company contact
    is_company = xero_contact_is_company?(xero_contact)

    # Update fields if Xero has data
    updates[:full_name] = xero_contact['Name'] if xero_contact['Name'].present?
    updates[:entity_type] = is_company ? 'company' : 'person'

    # For companies: clear first_name/last_name and set company_name_or_trust
    # The person whose name was in FirstName/LastName should be created as a linked Contact
    if is_company
      updates[:first_name] = nil
      updates[:last_name] = nil
      updates[:company_name_or_trust] = xero_contact['Name']
    else
      updates[:first_name] = xero_contact['FirstName'] if xero_contact['FirstName'].present?
      updates[:last_name] = xero_contact['LastName'] if xero_contact['LastName'].present?
    end
    updates[:tax_number] = normalize_tax_number(xero_contact['TaxNumber']) if xero_contact['TaxNumber'].present?

    # Xero contact status and identifiers
    updates[:xero_contact_status] = xero_contact['ContactStatus'] if xero_contact['ContactStatus'].present?
    updates[:xero_contact_number] = xero_contact['ContactNumber'] if xero_contact['ContactNumber'].present?
    updates[:xero_account_number] = xero_contact['AccountNumber'] if xero_contact['AccountNumber'].present?

    # Website
    updates[:website] = xero_contact['Website'] if xero_contact['Website'].present?

    # Discount
    updates[:default_discount] = xero_contact['Discount'] if xero_contact['Discount'].present?

    # Outstanding balances from Xero
    if xero_contact['Balances'].present?
      balances = xero_contact['Balances']
      if balances['AccountsReceivable'].present?
        updates[:accounts_receivable_outstanding] = balances['AccountsReceivable']['Outstanding']
        updates[:accounts_receivable_overdue] = balances['AccountsReceivable']['Overdue']
      end
      if balances['AccountsPayable'].present?
        updates[:accounts_payable_outstanding] = balances['AccountsPayable']['Outstanding']
        updates[:accounts_payable_overdue] = balances['AccountsPayable']['Overdue']
      end
    end

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
        when 'FAX'
          updates[:fax_phone] = phone['PhoneNumber'] if phone['PhoneNumber'].present?
        end
      end
    end

    # Extract address from Xero (prefer STREET type)
    if xero_contact['Addresses'].present?
      street_address = xero_contact['Addresses'].find { |a| a['AddressType'] == 'STREET' }
      address_to_use = street_address || xero_contact['Addresses'].first

      if address_to_use
        address_parts = [
          address_to_use['AddressLine1'],
          address_to_use['AddressLine2'],
          address_to_use['AddressLine3'],
          address_to_use['AddressLine4'],
          [address_to_use['City'], address_to_use['Region'], address_to_use['PostalCode']].compact.join(' '),
          address_to_use['Country']
        ].compact.reject(&:blank?)

        updates[:address] = address_parts.join(', ') if address_parts.any?
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

    # Extract purchase/sales account codes and payment terms
    if xero_contact['DefaultCurrency'].present?
      # Store default currency if needed in future
    end

    if xero_contact['PurchasesDefaultAccountCode'].present?
      updates[:default_purchase_account] = xero_contact['PurchasesDefaultAccountCode']
    end

    if xero_contact['SalesDefaultAccountCode'].present?
      updates[:default_sales_account] = xero_contact['SalesDefaultAccountCode']
    end

    if xero_contact['PaymentTerms'].present?
      if xero_contact['PaymentTerms']['Bills'].present?
        bills = xero_contact['PaymentTerms']['Bills']
        updates[:bill_due_day] = bills['Day'] if bills['Day'].present?
        updates[:bill_due_type] = bills['Type'] if bills['Type'].present?
      end
      if xero_contact['PaymentTerms']['Sales'].present?
        sales = xero_contact['PaymentTerms']['Sales']
        updates[:sales_due_day] = sales['Day'] if sales['Day'].present?
        updates[:sales_due_type] = sales['Type'] if sales['Type'].present?
      end
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

    # Sync contact persons from Xero
    sync_contact_persons(teeem_contact, xero_contact)

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

    # Extract contact types from Xero IsCustomer/IsSupplier flags
    contact_types = []
    contact_types << 'customer' if xero_contact['IsCustomer'] == true
    contact_types << 'supplier' if xero_contact['IsSupplier'] == true

    # Determine if this is a company contact
    # A contact is a company if:
    # 1. It has a Name containing company indicators (Pty Ltd, Ltd, Inc, etc.), OR
    # 2. It has a Name but no FirstName
    # When a company has FirstName/LastName, those represent the primary contact person
    is_company = xero_contact_is_company?(xero_contact)

    # For companies: don't put person's name in first_name/last_name fields
    # The person should be created as a separate linked Contact
    contact_data = {
      xero_id: xero_contact['ContactID'],
      full_name: xero_contact['Name'],
      first_name: is_company ? nil : xero_contact['FirstName'],
      last_name: is_company ? nil : xero_contact['LastName'],
      company_name_or_trust: is_company ? xero_contact['Name'] : nil,
      entity_type: is_company ? 'company' : 'person',
      tax_number: normalize_tax_number(xero_contact['TaxNumber']),
      email: extract_xero_email(xero_contact),
      contact_types: contact_types.any? ? contact_types : nil,
      sync_with_xero: true,
      last_synced_at: @sync_timestamp,
      # Xero identifiers
      xero_contact_status: xero_contact['ContactStatus'],
      xero_contact_number: xero_contact['ContactNumber'],
      xero_account_number: xero_contact['AccountNumber'],
      # Additional fields
      website: xero_contact['Website'],
      default_discount: xero_contact['Discount'],
      default_purchase_account: xero_contact['PurchasesDefaultAccountCode'],
      default_sales_account: xero_contact['SalesDefaultAccountCode']
    }

    # Extract outstanding balances
    if xero_contact['Balances'].present?
      balances = xero_contact['Balances']
      if balances['AccountsReceivable'].present?
        contact_data[:accounts_receivable_outstanding] = balances['AccountsReceivable']['Outstanding']
        contact_data[:accounts_receivable_overdue] = balances['AccountsReceivable']['Overdue']
      end
      if balances['AccountsPayable'].present?
        contact_data[:accounts_payable_outstanding] = balances['AccountsPayable']['Outstanding']
        contact_data[:accounts_payable_overdue] = balances['AccountsPayable']['Overdue']
      end
    end

    # Extract phone numbers
    if xero_contact['Phones'].present?
      xero_contact['Phones'].each do |phone|
        case phone['PhoneType']
        when 'MOBILE'
          contact_data[:mobile_phone] = phone['PhoneNumber']
        when 'DEFAULT', 'DDI'
          contact_data[:office_phone] = phone['PhoneNumber']
        when 'FAX'
          contact_data[:fax_phone] = phone['PhoneNumber']
        end
      end
    end

    # Extract address from Xero (prefer STREET type)
    if xero_contact['Addresses'].present?
      street_address = xero_contact['Addresses'].find { |a| a['AddressType'] == 'STREET' }
      address_to_use = street_address || xero_contact['Addresses'].first

      if address_to_use
        address_parts = [
          address_to_use['AddressLine1'],
          address_to_use['AddressLine2'],
          address_to_use['AddressLine3'],
          address_to_use['AddressLine4'],
          [address_to_use['City'], address_to_use['Region'], address_to_use['PostalCode']].compact.join(' '),
          address_to_use['Country']
        ].compact.reject(&:blank?)

        contact_data[:address] = address_parts.join(', ') if address_parts.any?
      end
    end

    # Extract payment terms
    if xero_contact['PaymentTerms'].present?
      if xero_contact['PaymentTerms']['Bills'].present?
        bills = xero_contact['PaymentTerms']['Bills']
        contact_data[:bill_due_day] = bills['Day'] if bills['Day'].present?
        contact_data[:bill_due_type] = bills['Type'] if bills['Type'].present?
      end
      if xero_contact['PaymentTerms']['Sales'].present?
        sales = xero_contact['PaymentTerms']['Sales']
        contact_data[:sales_due_day] = sales['Day'] if sales['Day'].present?
        contact_data[:sales_due_type] = sales['Type'] if sales['Type'].present?
      end
    end

    new_contact = Contact.create!(contact_data.compact)
    Rails.logger.info("Created TEEEM contact from Xero: #{xero_contact['Name']}")

    # Sync contact persons from Xero
    sync_contact_persons(new_contact, xero_contact)

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

  # Determine if a Xero contact represents a company (vs. an individual person)
  # Company indicators in the Name field:
  # - Pty Ltd, Pty. Ltd., PTY LTD
  # - Ltd, Ltd., Limited
  # - Inc, Inc., Incorporated
  # - Corp, Corp., Corporation
  # - LLC, L.L.C.
  # - Trust (e.g., "Smith Family Trust")
  # - Group, Holdings
  # Also: if Name is present but FirstName is blank, it's likely a company
  COMPANY_INDICATORS = [
    /\bpty\.?\s*ltd\.?\b/i,
    /\bltd\.?\b/i,
    /\blimited\b/i,
    /\binc\.?\b/i,
    /\bincorporated\b/i,
    /\bcorp\.?\b/i,
    /\bcorporation\b/i,
    /\bllc\b/i,
    /\bl\.l\.c\.?\b/i,
    /\btrust\b/i,
    /\bgroup\b/i,
    /\bholdings\b/i,
    /\bpartners\b/i,
    /\bpartnership\b/i,
    /\bco\.?\b/i,            # Co. or Company
    /\bcompany\b/i,
    /\bassociates?\b/i,
    /\benterprise[s]?\b/i,
    /\bsolutions?\b/i,
    /\bservices?\b/i,
    /\bsuperannuation\b/i,
    /\bsuper\s+fund\b/i,
    /\bfund\b/i,
    /\baccount\b/i           # Often used in trust/super fund names
  ].freeze

  def xero_contact_is_company?(xero_contact)
    name = xero_contact['Name'].to_s
    first_name = xero_contact['FirstName'].to_s.strip

    # If Name is present but FirstName is blank, it's likely a company
    return true if name.present? && first_name.blank?

    # Check for company indicators in the name
    COMPANY_INDICATORS.any? { |pattern| name.match?(pattern) }
  end

  # Sync contact persons from Xero to TEEEM
  # Xero ContactPersons structure:
  # [{"FirstName": "Michael", "LastName": "Lyell", "EmailAddress": "michael@example.com", "IncludeInEmails": true}]
  #
  # BEHAVIOR: ALL contact persons are created as separate Contact records
  # linked to the company via primary_company_id. This allows each person to be a separate
  # searchable contact with their own details, while being associated with their company.
  #
  # IMPORTANT: For company contacts, Xero stores the primary contact person in the
  # main contact's FirstName/LastName/EmailAddress fields (not in ContactPersons array).
  # We need to create a Contact for this person AS WELL AS any in the ContactPersons array.
  def sync_contact_persons(teeem_contact, xero_contact)
    # Check if this is a company with a primary person in FirstName/LastName fields
    is_company = xero_contact_is_company?(xero_contact)
    main_first_name = xero_contact['FirstName'].to_s.strip
    main_last_name = xero_contact['LastName'].to_s.strip
    main_email = xero_contact['EmailAddress'].to_s.strip

    xero_persons = xero_contact['ContactPersons'] || []

    # For companies: First, create a Contact for the person in the main FirstName/LastName fields
    # This person is typically the PRIMARY contact for the company
    primary_person_contact = nil
    if is_company && main_first_name.present?
      main_person = {
        'FirstName' => main_first_name,
        'LastName' => main_last_name,
        'EmailAddress' => main_email,
        'IncludeInEmails' => true
      }
      Rails.logger.info("Creating primary person contact #{main_first_name} #{main_last_name} for company #{teeem_contact.display_name}")
      primary_person_contact = create_or_update_contact_person_as_contact(teeem_contact, main_person, true)

      # Set director_id to this primary person
      if primary_person_contact && teeem_contact.director_id != primary_person_contact.id
        teeem_contact.update!(director_id: primary_person_contact.id)
      end
    end

    # If there are no additional contact persons in the array, we're done
    return if xero_persons.empty?

    Rails.logger.info("Syncing #{xero_persons.length} additional contact persons for #{teeem_contact.display_name}")

    # Get existing contact persons for this contact (legacy ContactPerson records)
    existing_persons = teeem_contact.contact_persons.to_a

    xero_persons.each_with_index do |xero_person, index|
      first_name = xero_person['FirstName']
      last_name = xero_person['LastName']
      email = xero_person['EmailAddress']
      include_in_emails = xero_person['IncludeInEmails'] != false # Default to true

      # Create ALL contact persons as separate Contact records linked to company
      # If we already created a primary person from main FirstName/LastName, these are NOT primary
      if first_name.present?
        array_person_is_primary = (index == 0) && primary_person_contact.nil?
        create_or_update_contact_person_as_contact(teeem_contact, xero_person, array_person_is_primary)
      end

      # Also maintain the legacy ContactPerson record for backwards compatibility
      existing = existing_persons.find do |ep|
        (email.present? && ep.email&.downcase == email&.downcase) ||
          (ep.first_name&.downcase == first_name&.downcase && ep.last_name&.downcase == last_name&.downcase)
      end

      # For legacy ContactPerson records, first in array is primary only if no main person exists
      legacy_is_primary = (index == 0) && main_first_name.blank?

      if existing
        # Update existing contact person
        existing.update!(
          first_name: first_name,
          last_name: last_name,
          email: email,
          include_in_emails: include_in_emails,
          is_primary: legacy_is_primary
        )
        Rails.logger.debug("Updated contact person: #{first_name} #{last_name}")
        @stats[:contact_persons_synced] += 1
      else
        # Create new contact person
        teeem_contact.contact_persons.create!(
          first_name: first_name,
          last_name: last_name,
          email: email,
          include_in_emails: include_in_emails,
          is_primary: legacy_is_primary
        )
        Rails.logger.debug("Created contact person: #{first_name} #{last_name}")
        @stats[:contact_persons_synced] += 1
      end
    end
  rescue StandardError => e
    Rails.logger.error("Error syncing contact persons for #{teeem_contact.display_name}: #{e.message}")
    # Don't raise - contact person sync failure shouldn't fail the whole contact sync
  end

  # Create contact person as a separate Contact record linked to the company
  # This allows searching/viewing the person independently while maintaining the company relationship
  def create_or_update_contact_person_as_contact(company_contact, xero_person, is_primary = false)
    first_name = xero_person['FirstName'].to_s.strip
    last_name = xero_person['LastName'].to_s.strip
    email = xero_person['EmailAddress'].to_s.strip.downcase
    full_name = "#{first_name} #{last_name}".strip

    return if full_name.blank?

    # Try to find existing person contact by email or by company link + name
    person_contact = nil

    # First try by email if present
    if email.present?
      person_contact = Contact.find_by('LOWER(email) = ?', email)
    end

    # If not found, try by company link + name match
    if person_contact.nil?
      person_contact = Contact.find_by(
        primary_company_id: company_contact.id,
        first_name: first_name,
        last_name: last_name
      )
    end

    if person_contact
      # Update existing person contact
      person_contact.update!(
        first_name: first_name,
        last_name: last_name,
        full_name: full_name,
        email: email.presence,
        primary_company_id: company_contact.id,
        entity_type: 'person',
        last_synced_at: @sync_timestamp
      )
      Rails.logger.info("Updated person contact: #{full_name} (linked to #{company_contact.display_name})")
    else
      # Create new person contact
      person_contact = Contact.create!(
        first_name: first_name,
        last_name: last_name,
        full_name: full_name,
        email: email.presence,
        primary_company_id: company_contact.id,
        entity_type: 'person',
        sync_with_xero: false, # Don't sync person back to Xero (they're part of company contact)
        last_synced_at: @sync_timestamp
      )
      Rails.logger.info("Created person contact: #{full_name} (linked to #{company_contact.display_name})")
      @stats[:created_in_teeem] += 1
    end

    # Link company back to this person as their director/primary contact (only for primary person)
    if is_primary && company_contact.director_id != person_contact.id
      company_contact.update!(director_id: person_contact.id)
    end

    person_contact
  rescue StandardError => e
    Rails.logger.error("Error creating person contact for #{full_name}: #{e.message}")
    nil
  end

  # Helper to set sync timestamp (useful for job)
  def set_sync_timestamp(timestamp)
    @sync_timestamp = timestamp
  end

  # Clean up TEEEM contacts whose xero_id no longer exists in Xero
  # This handles merged/deleted contacts in Xero
  def cleanup_deleted_xero_contacts(active_xero_ids)
    # Find TEEEM contacts with xero_id that are NOT in the active Xero contacts
    orphaned_contacts = Contact.where.not(xero_id: [nil, ''])
                               .where.not(xero_id: active_xero_ids.to_a)

    count = orphaned_contacts.count
    return if count == 0

    Rails.logger.info("Found #{count} TEEEM contacts with xero_ids no longer in Xero - deleting")

    orphaned_contacts.find_each do |contact|
      begin
        Rails.logger.info("Deleting orphaned contact: #{contact.display_name} (xero_id: #{contact.xero_id})")

        # Log activity before deletion
        ContactActivity.create(
          contact_id: contact.id,
          action: 'deleted',
          details: {
            reason: 'xero_id_no_longer_exists',
            xero_id: contact.xero_id,
            name: contact.display_name
          }
        ) rescue nil

        contact.destroy!
        @stats[:deleted_from_teeem] += 1
      rescue StandardError => e
        error_msg = "Failed to delete orphaned contact #{contact.id}: #{e.message}"
        Rails.logger.error(error_msg)
        @stats[:errors] << error_msg
      end
    end

    Rails.logger.info("Deleted #{@stats[:deleted_from_teeem]} orphaned contacts from TEEEM")
  end
end
