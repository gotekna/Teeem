class XeroContactSyncJob < ApplicationJob
  queue_as :default

  BATCH_SIZE = 10
  RATE_LIMIT_DELAY = 1 # seconds between API calls to stay under 60/min
  MAX_RETRIES = 3
  SIMILARITY_THRESHOLD = 0.85

  # Perform can accept different actions:
  # - No args: Full sync all tenants (legacy behavior)
  # - tenant_id: Sync specific tenant
  # - contact_id + tenant_id + action: Sync specific contact
  # - xero_contact_id + tenant_id + action: Import from Xero
  def perform(options = {})
    options = options.with_indifferent_access if options.is_a?(Hash)

    # Route to appropriate handler based on options
    if options[:action] == "sync_from_xero" && options[:contact_id]
      sync_contact_from_xero(options[:contact_id], options[:tenant_id])
    elsif options[:action] == "import_from_xero" && options[:xero_contact_id]
      import_contact_from_xero(options[:xero_contact_id], options[:tenant_id])
    elsif options[:tenant_id]
      sync_tenant(options[:tenant_id])
    else
      sync_all_tenants
    end
  end

  def sync_all_tenants
    Rails.logger.info("XeroContactSyncJob: Syncing all tenants")

    # Mark sync as in progress
    XeroSyncStatus.start_sync!("contacts")

    begin
      service = XeroContactSyncService.new
      result = service.sync_all_tenants

      # Update SSoT with success
      records_synced = result[:stats][:synced].to_i rescue 0
      XeroSyncStatus.complete_sync!(
        "contacts",
        records_synced: records_synced,
        next_sync_at: 30.minutes.from_now
      )

      result
    rescue StandardError => e
      Rails.logger.error("XeroContactSyncJob failed: #{e.message}")
      XeroSyncStatus.fail_sync!("contacts", error: e.message)
      raise
    end
  end

  def sync_tenant(tenant_id)
    Rails.logger.info("XeroContactSyncJob: Syncing tenant #{tenant_id}")

    # Mark sync as in progress
    XeroSyncStatus.start_sync!("contacts", tenant_id: tenant_id)

    begin
      service = XeroContactSyncService.new(tenant_id: tenant_id)
      result = service.sync

      # Update SSoT with success
      records_synced = result[:stats][:synced].to_i rescue 0
      XeroSyncStatus.complete_sync!(
        "contacts",
        tenant_id: tenant_id,
        records_synced: records_synced,
        next_sync_at: 30.minutes.from_now
      )

      result
    rescue StandardError => e
      Rails.logger.error("XeroContactSyncJob failed for tenant #{tenant_id}: #{e.message}")
      XeroSyncStatus.fail_sync!("contacts", tenant_id: tenant_id, error: e.message)
      raise
    end
  end

  def sync_contact_from_xero(contact_id, tenant_id)
    Rails.logger.info("XeroContactSyncJob: Syncing contact #{contact_id} from Xero tenant #{tenant_id}")
    contact = Contact.find(contact_id)
    link = contact.xero_links.find_by(xero_tenant_id: tenant_id)

    if link
      service = XeroContactSyncService.new(tenant_id: tenant_id)
      service.sync_from_xero(link)
    else
      Rails.logger.warn("No xero_link found for contact #{contact_id} and tenant #{tenant_id}")
    end
  end

  def import_contact_from_xero(xero_contact_id, tenant_id)
    Rails.logger.info("XeroContactSyncJob: Importing Xero contact #{xero_contact_id} from tenant #{tenant_id}")
    service = XeroContactSyncService.new(tenant_id: tenant_id)
    xero_contact = service.fetch_single_xero_contact(xero_contact_id, tenant_id)

    if xero_contact
      service.create_teeem_contact_from_xero(xero_contact, tenant_id)
    else
      Rails.logger.warn("Could not fetch Xero contact #{xero_contact_id} from tenant #{tenant_id}")
    end
  end

  # Legacy full sync method (for backwards compatibility)
  def perform_legacy_sync
    Rails.logger.info("XeroContactSyncJob started at #{Time.current}")

    # Initialize tracking
    @stats = {
      matched: 0,
      created_in_teeem: 0,
      created_in_xero: 0,
      updated: 0,
      errors: [],
      skipped: 0,
      total_processed: 0
    }
    @sync_timestamp = Time.current
    @xero_client = XeroApiClient.new

    begin
      # Fetch all contacts from both systems
      xero_contacts = fetch_xero_contacts
      teeem_contacts = Contact.all.to_a

      total_contacts = xero_contacts.length + teeem_contacts.select(&:sync_with_xero).length
      Rails.logger.info("Processing #{xero_contacts.length} Xero contacts and #{teeem_contacts.length} TEEEM contacts")

      # Update job metadata
      update_job_metadata(status: "processing", total: total_contacts, processed: 0)

      # Process contacts in batches
      process_contacts_in_batches(xero_contacts, teeem_contacts)

      # Mark job as completed
      update_job_metadata(
        status: "completed",
        completed_at: Time.current,
        stats: @stats
      )

      Rails.logger.info("XeroContactSyncJob completed: #{@stats.inspect}")
    rescue XeroApiClient::AuthenticationError => e
      handle_job_error("Authentication error", e)
    rescue XeroApiClient::RateLimitError => e
      handle_job_error("Rate limit exceeded", e)
    rescue StandardError => e
      handle_job_error("Sync failed", e)
    end
  end

  private

  def fetch_xero_contacts
    result = @xero_client.get("Contacts")

    if result[:success]
      contacts = result[:data]["Contacts"] || []
      Rails.logger.info("Successfully fetched #{contacts.length} contacts from Xero")
      contacts
    else
      raise XeroApiClient::ApiError, "Failed to fetch Xero contacts"
    end
  end

  def process_contacts_in_batches(xero_contacts, teeem_contacts)
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

    # Process Xero contacts in batches
    xero_contacts.each_slice(BATCH_SIZE).with_index do |batch, batch_index|
      Rails.logger.info("Processing Xero batch #{batch_index + 1}/#{(xero_contacts.length.to_f / BATCH_SIZE).ceil}")

      batch.each do |xero_contact|
        process_xero_contact(
          xero_contact,
          teeem_contacts,
          teeem_by_xero_id,
          teeem_by_tax_number,
          teeem_by_email,
          matched_teeem_ids,
          matched_xero_ids
        )

        @stats[:total_processed] += 1
        update_progress
      end

      # Sleep between batches to respect rate limits
      sleep(RATE_LIMIT_DELAY) unless batch_index == (xero_contacts.length.to_f / BATCH_SIZE).ceil - 1
    end

    # Process unmatched TEEEM contacts that should sync to Xero
    unmatched_teeem = teeem_contacts.reject { |c| matched_teeem_ids.include?(c.id) }
    contacts_to_sync = unmatched_teeem.select { |c| c.sync_with_xero }

    contacts_to_sync.each_slice(BATCH_SIZE).with_index do |batch, batch_index|
      Rails.logger.info("Processing TEEEM batch #{batch_index + 1}/#{(contacts_to_sync.length.to_f / BATCH_SIZE).ceil}")

      batch.each do |teeem_contact|
        create_xero_contact_from_teeem(teeem_contact)
        @stats[:total_processed] += 1
        update_progress
      end

      # Sleep between batches to respect rate limits
      sleep(RATE_LIMIT_DELAY) unless batch_index == (contacts_to_sync.length.to_f / BATCH_SIZE).ceil - 1
    end

    # Count skipped contacts
    @stats[:skipped] = unmatched_teeem.reject { |c| c.sync_with_xero }.count
  end

  def process_xero_contact(xero_contact, teeem_contacts, by_xero_id, by_tax_number, by_email, matched_teeem_ids, matched_xero_ids)
    retry_count = 0

    begin
      # WAREHOUSE FIRST: Upsert to WarehouseContact (SSoT for Xero contact data)
      tenant_id = @xero_client&.current_tenant_id || XeroCredential.current&.tenant_id
      warehouse_contact = WarehouseContact.upsert_from_xero(xero_contact, tenant_id) if tenant_id.present?

      teeem_contact = find_matching_teeem_contact(
        xero_contact,
        by_xero_id,
        by_tax_number,
        by_email,
        teeem_contacts - matched_teeem_ids.map { |id| teeem_contacts.find { |c| c.id == id } }.compact
      )

      if teeem_contact
        # Match found - update both systems
        matched_teeem_ids.add(teeem_contact.id)
        matched_xero_ids.add(xero_contact["ContactID"])
        update_teeem_from_xero(teeem_contact, xero_contact)

        # Link WarehouseContact to TEEEM Contact (SSoT for linking)
        warehouse_contact&.update!(contact_id: teeem_contact.id) if warehouse_contact && warehouse_contact.contact_id.nil?

        @stats[:matched] += 1
      else
        # No match - create in TEEEM
        new_contact = create_teeem_contact_from_xero(xero_contact)
        matched_xero_ids.add(xero_contact["ContactID"])

        # Link WarehouseContact to newly created TEEEM Contact
        warehouse_contact&.update!(contact_id: new_contact.id) if warehouse_contact && new_contact

        @stats[:created_in_teeem] += 1
      end

      # Small delay between each API call
      sleep(RATE_LIMIT_DELAY)
    rescue XeroApiClient::RateLimitError => e
      # Handle rate limiting with exponential backoff
      if retry_count < MAX_RETRIES
        retry_count += 1
        retry_after = parse_retry_after(e.message)
        Rails.logger.warn("Rate limited. Retry #{retry_count}/#{MAX_RETRIES}. Sleeping for #{retry_after}s")
        sleep(retry_after)
        retry
      else
        error_msg = "Max retries exceeded for Xero contact #{xero_contact['Name']}: #{e.message}"
        Rails.logger.error(error_msg)
        @stats[:errors] << error_msg
      end
    rescue StandardError => e
      error_msg = "Error processing Xero contact #{xero_contact['Name']}: #{e.message}"
      Rails.logger.error(error_msg)
      @stats[:errors] << error_msg
    end
  end

  def create_xero_contact_from_teeem(teeem_contact)
    retry_count = 0

    begin
      # Build Xero contact payload
      xero_payload = {
        Contacts: [
          build_xero_contact_payload(teeem_contact)
        ]
      }

      result = @xero_client.post("Contacts", xero_payload)

      if result[:success]
        created_contact = result[:data]["Contacts"]&.first
        if created_contact
          # DEPRECATED: Contact.xero_id - use WarehouseContact.xero_id instead
          # Keeping for backwards compatibility during migration period
          teeem_contact.update!(
            xero_id: created_contact["ContactID"],
            last_synced_at: @sync_timestamp,
            xero_sync_error: nil
          )
          @stats[:created_in_xero] += 1
          Rails.logger.info("Created Xero contact: #{created_contact['ContactID']}")
        end
      else
        raise XeroApiClient::ApiError, "Failed to create contact in Xero"
      end

      # Small delay between each API call
      sleep(RATE_LIMIT_DELAY)
    rescue XeroApiClient::RateLimitError => e
      # Handle rate limiting with exponential backoff
      if retry_count < MAX_RETRIES
        retry_count += 1
        retry_after = parse_retry_after(e.message)
        Rails.logger.warn("Rate limited. Retry #{retry_count}/#{MAX_RETRIES}. Sleeping for #{retry_after}s")
        sleep(retry_after)
        retry
      else
        error_msg = "Max retries exceeded creating Xero contact for #{teeem_contact.display_name}: #{e.message}"
        Rails.logger.error(error_msg)
        teeem_contact.update(xero_sync_error: error_msg)
        @stats[:errors] << error_msg
      end
    rescue StandardError => e
      error_msg = "Error creating Xero contact for #{teeem_contact.display_name}: #{e.message}"
      Rails.logger.error(error_msg)
      teeem_contact.update(xero_sync_error: error_msg)
      @stats[:errors] << error_msg
    end
  end

  def parse_retry_after(message)
    # Extract retry-after value from error message
    # Message format: "Rate limit exceeded. Retry after 35 seconds"
    match = message.match(/Retry after (\d+) seconds/)
    match ? match[1].to_i : 60
  end

  def update_job_metadata(metadata)
    # Store job metadata in Rails cache for progress tracking
    # Note: Temporarily disabled due to solid_cache setup issues
    # Rails.cache.write("xero_sync_job_#{job_id}", metadata.merge(job_id: job_id), expires_in: 24.hours)
    Rails.logger.info("Job metadata update: #{metadata.inspect}")
  end

  def update_progress
    # Update progress every 10 contacts
    if @stats[:total_processed] % 10 == 0
      update_job_metadata(
        status: "processing",
        processed: @stats[:total_processed],
        stats: @stats
      )
    end
  end

  def handle_job_error(error_type, exception)
    error_msg = "#{error_type}: #{exception.message}"
    Rails.logger.error("XeroContactSyncJob failed: #{error_msg}")
    Rails.logger.error(exception.backtrace.join("\n"))
    @stats[:errors] << error_msg

    update_job_metadata(
      status: "failed",
      error: error_msg,
      stats: @stats,
      failed_at: Time.current
    )
  end

  # Contact matching and processing helper methods
  def find_matching_teeem_contact(xero_contact, by_xero_id, by_tax_number, by_email, remaining_contacts)
    xero_id = xero_contact["ContactID"]
    xero_tax = xero_contact["TaxNumber"]
    xero_email = extract_xero_email(xero_contact)
    xero_name = xero_contact["Name"]

    # Priority 1: Match by xero_id
    return by_xero_id[xero_id] if by_xero_id[xero_id]

    # Priority 2: Match by tax_number (ABN/ACN)
    if xero_tax.present?
      normalized_tax = normalize_tax_number(xero_tax)
      matches = by_tax_number[normalized_tax]
      return matches.first if matches && matches.any?
    end

    # Priority 3: Match by exact email
    if xero_email.present?
      normalized_email = xero_email.downcase.strip
      match = by_email[normalized_email]
      return match if match
    end

    # Priority 4: Match by fuzzy name (>85% similarity)
    if xero_name.present? && remaining_contacts.any?
      return fuzzy_match_by_name(xero_name, remaining_contacts)
    end

    nil
  end

  def fuzzy_match_by_name(xero_name, contacts)
    return nil if contacts.empty?

    # Create fuzzy matcher with contact names
    contact_names = contacts.map { |c| [ c.display_name, c ] }.to_h
    matcher = FuzzyMatch.new(contact_names.keys)

    # Find best match
    matched_name = matcher.find(xero_name, threshold: SIMILARITY_THRESHOLD)

    matched_name ? contact_names[matched_name] : nil
  end

  def update_teeem_from_xero(teeem_contact, xero_contact)
    # DEPRECATED: Contact.xero_id - use WarehouseContact.xero_id instead
    # Keeping for backwards compatibility during migration period
    updates = {
      xero_id: xero_contact["ContactID"],
      last_synced_at: @sync_timestamp,
      xero_sync_error: nil
    }

    # Update fields if Xero has data and TEEEM doesn't, or if explicitly syncing
    updates[:display_name] = xero_contact["Name"] if xero_contact["Name"].present?
    updates[:first_name] = xero_contact["FirstName"] if xero_contact["FirstName"].present?
    updates[:last_name] = xero_contact["LastName"] if xero_contact["LastName"].present?
    updates[:tax_number] = normalize_tax_number(xero_contact["TaxNumber"]) if xero_contact["TaxNumber"].present?

    # Extract email from Xero contact
    xero_email = extract_xero_email(xero_contact)
    updates[:email] = xero_email if xero_email.present?

    # Extract phone numbers
    if xero_contact["Phones"].present?
      xero_contact["Phones"].each do |phone|
        case phone["PhoneType"]
        when "MOBILE"
          updates[:mobile_phone] = phone["PhoneNumber"] if phone["PhoneNumber"].present?
        when "DEFAULT", "DDI"
          updates[:office_phone] = phone["PhoneNumber"] if phone["PhoneNumber"].present?
        when "FAX"
          updates[:fax_phone] = phone["PhoneNumber"] if phone["PhoneNumber"].present?
        end
      end
    end

    # Extract bank account details
    # BankAccountDetails is a string in format "BSB: 123456, Account Number: 98765432, Account Name: Business Account"
    if xero_contact["BankAccountDetails"].present?
      bank_details = xero_contact["BankAccountDetails"]

      # Try to parse BSB
      if bank_details.match(/BSB[:\s]+(\d{6})/)
        updates[:bank_bsb] = $1
      end

      # Try to parse account number
      if bank_details.match(/Account Number[:\s]+([\d\s]+)/)
        updates[:bank_account_number] = $1.gsub(/\s/, "")
      end

      # Try to parse account name
      if bank_details.match(/Account Name[:\s]+([^,\n]+)/)
        updates[:bank_account_name] = $1.strip
      end
    end

    # Extract purchase account
    if xero_contact["PurchaseDetails"].present? && xero_contact["PurchaseDetails"]["AccountCode"].present?
      updates[:default_purchase_account] = xero_contact["PurchaseDetails"]["AccountCode"]
    end

    # Extract sales account
    if xero_contact["SalesDetails"].present? && xero_contact["SalesDetails"]["AccountCode"].present?
      updates[:default_sales_account] = xero_contact["SalesDetails"]["AccountCode"]
    end

    # Extract payment terms - Bills
    if xero_contact["PaymentTerms"].present? && xero_contact["PaymentTerms"]["Bills"].present?
      bills = xero_contact["PaymentTerms"]["Bills"]
      updates[:bill_due_day] = bills["Day"] if bills["Day"].present?
      updates[:bill_due_type] = bills["Type"] if bills["Type"].present?
    end

    # Extract payment terms - Sales
    if xero_contact["PaymentTerms"].present? && xero_contact["PaymentTerms"]["Sales"].present?
      sales = xero_contact["PaymentTerms"]["Sales"]
      updates[:sales_due_day] = sales["Day"] if sales["Day"].present?
      updates[:sales_due_type] = sales["Type"] if sales["Type"].present?
    end

    # Extract additional Xero fields
    updates[:xero_contact_number] = xero_contact["ContactNumber"] if xero_contact["ContactNumber"].present?
    updates[:xero_contact_status] = xero_contact["ContactStatus"] if xero_contact["ContactStatus"].present?
    updates[:xero_account_number] = xero_contact["AccountNumber"] if xero_contact["AccountNumber"].present?
    updates[:company_number] = xero_contact["CompanyNumber"] if xero_contact["CompanyNumber"].present?
    updates[:default_discount] = xero_contact["Discount"] if xero_contact["Discount"].present?

    # Extract balances (read-only)
    if xero_contact["Balances"].present?
      if xero_contact["Balances"]["AccountsReceivable"].present?
        updates[:accounts_receivable_outstanding] = xero_contact["Balances"]["AccountsReceivable"]["Outstanding"]
        updates[:accounts_receivable_overdue] = xero_contact["Balances"]["AccountsReceivable"]["Overdue"]
      end
      if xero_contact["Balances"]["AccountsPayable"].present?
        updates[:accounts_payable_outstanding] = xero_contact["Balances"]["AccountsPayable"]["Outstanding"]
        updates[:accounts_payable_overdue] = xero_contact["Balances"]["AccountsPayable"]["Overdue"]
      end
    end

    teeem_contact.update!(updates)

    # Sync nested structures
    sync_contact_persons_from_xero(teeem_contact, xero_contact)
    sync_contact_addresses_from_xero(teeem_contact, xero_contact)
    sync_contact_groups_from_xero(teeem_contact, xero_contact)

    @stats[:updated] += 1
    Rails.logger.info("Updated TEEEM contact ##{teeem_contact.id}")
  rescue StandardError => e
    error_msg = "Failed to update TEEEM contact: #{e.message}"
    teeem_contact.update(xero_sync_error: error_msg)
    raise
  end

  def create_teeem_contact_from_xero(xero_contact)
    Rails.logger.info("Creating TEEEM contact from Xero: #{xero_contact['Name']}")

    # DEPRECATED: Contact.xero_id - use WarehouseContact.xero_id instead
    # Keeping for backwards compatibility during migration period
    contact_data = {
      xero_id: xero_contact["ContactID"],
      display_name: xero_contact["Name"],
      first_name: xero_contact["FirstName"],
      last_name: xero_contact["LastName"],
      tax_number: normalize_tax_number(xero_contact["TaxNumber"]),
      email: extract_xero_email(xero_contact),
      sync_with_xero: true,
      last_synced_at: @sync_timestamp,
      xero_contact_number: xero_contact["ContactNumber"],
      xero_contact_status: xero_contact["ContactStatus"],
      xero_account_number: xero_contact["AccountNumber"],
      company_number: xero_contact["CompanyNumber"]
    }

    # Extract phone numbers
    if xero_contact["Phones"].present?
      xero_contact["Phones"].each do |phone|
        case phone["PhoneType"]
        when "MOBILE"
          contact_data[:mobile_phone] = phone["PhoneNumber"]
        when "DEFAULT", "DDI"
          contact_data[:office_phone] = phone["PhoneNumber"]
        when "FAX"
          contact_data[:fax_phone] = phone["PhoneNumber"]
        end
      end
    end

    # Extract bank account details
    if xero_contact["BankAccountDetails"].present?
      bank_details = xero_contact["BankAccountDetails"]

      # Try to parse BSB
      if bank_details.match(/BSB[:\s]+(\d{6})/)
        contact_data[:bank_bsb] = $1
      end

      # Try to parse account number
      if bank_details.match(/Account Number[:\s]+([\d\s]+)/)
        contact_data[:bank_account_number] = $1.gsub(/\s/, "")
      end

      # Try to parse account name
      if bank_details.match(/Account Name[:\s]+([^,\n]+)/)
        contact_data[:bank_account_name] = $1.strip
      end
    end

    # Extract purchase account
    if xero_contact["PurchaseDetails"].present? && xero_contact["PurchaseDetails"]["AccountCode"].present?
      contact_data[:default_purchase_account] = xero_contact["PurchaseDetails"]["AccountCode"]
    end

    # Extract sales account
    if xero_contact["SalesDetails"].present? && xero_contact["SalesDetails"]["AccountCode"].present?
      contact_data[:default_sales_account] = xero_contact["SalesDetails"]["AccountCode"]
    end

    # Extract payment terms - Bills
    if xero_contact["PaymentTerms"].present? && xero_contact["PaymentTerms"]["Bills"].present?
      bills = xero_contact["PaymentTerms"]["Bills"]
      contact_data[:bill_due_day] = bills["Day"] if bills["Day"].present?
      contact_data[:bill_due_type] = bills["Type"] if bills["Type"].present?
    end

    # Extract payment terms - Sales
    if xero_contact["PaymentTerms"].present? && xero_contact["PaymentTerms"]["Sales"].present?
      sales = xero_contact["PaymentTerms"]["Sales"]
      contact_data[:sales_due_day] = sales["Day"] if sales["Day"].present?
      contact_data[:sales_due_type] = sales["Type"] if sales["Type"].present?
    end

    contact_data[:default_discount] = xero_contact["Discount"] if xero_contact["Discount"].present?

    # Extract balances (read-only)
    if xero_contact["Balances"].present?
      if xero_contact["Balances"]["AccountsReceivable"].present?
        contact_data[:accounts_receivable_outstanding] = xero_contact["Balances"]["AccountsReceivable"]["Outstanding"]
        contact_data[:accounts_receivable_overdue] = xero_contact["Balances"]["AccountsReceivable"]["Overdue"]
      end
      if xero_contact["Balances"]["AccountsPayable"].present?
        contact_data[:accounts_payable_outstanding] = xero_contact["Balances"]["AccountsPayable"]["Outstanding"]
        contact_data[:accounts_payable_overdue] = xero_contact["Balances"]["AccountsPayable"]["Overdue"]
      end
    end

    teeem_contact = Contact.create!(contact_data.compact)

    # Sync nested structures
    sync_contact_persons_from_xero(teeem_contact, xero_contact)
    sync_contact_addresses_from_xero(teeem_contact, xero_contact)
    sync_contact_groups_from_xero(teeem_contact, xero_contact)

    Rails.logger.info("Created TEEEM contact from Xero: #{xero_contact['Name']}")
    teeem_contact
  rescue StandardError => e
    error_msg = "Failed to create TEEEM contact from Xero: #{e.message}"
    Rails.logger.error(error_msg)
    raise
  end

  def build_xero_contact_payload(teeem_contact)
    payload = {
      Name: teeem_contact.display_name || "#{teeem_contact.first_name} #{teeem_contact.last_name}".strip
    }

    payload[:FirstName] = teeem_contact.first_name if teeem_contact.first_name.present?
    payload[:LastName] = teeem_contact.last_name if teeem_contact.last_name.present?
    payload[:EmailAddress] = teeem_contact.email if teeem_contact.email.present?
    payload[:TaxNumber] = teeem_contact.tax_number if teeem_contact.tax_number.present?
    payload[:ContactNumber] = teeem_contact.xero_contact_number if teeem_contact.xero_contact_number.present?
    payload[:AccountNumber] = teeem_contact.xero_account_number if teeem_contact.xero_account_number.present?
    payload[:CompanyNumber] = teeem_contact.company_number if teeem_contact.company_number.present?

    # Add phone numbers
    phones = []
    if teeem_contact.mobile_phone.present?
      phones << {
        PhoneType: "MOBILE",
        PhoneNumber: teeem_contact.mobile_phone
      }
    end
    if teeem_contact.office_phone.present?
      phones << {
        PhoneType: "DEFAULT",
        PhoneNumber: teeem_contact.office_phone
      }
    end
    if teeem_contact.fax_phone.present?
      phones << {
        PhoneType: "FAX",
        PhoneNumber: teeem_contact.fax_phone
      }
    end
    payload[:Phones] = phones if phones.any?

    # Add addresses
    if teeem_contact.contact_addresses.any?
      addresses = teeem_contact.contact_addresses.map do |address|
        {
          AddressType: address.address_type,
          AddressLine1: address.line1,
          AddressLine2: address.line2,
          AddressLine3: address.line3,
          AddressLine4: address.line4,
          City: address.city,
          Region: address.region,
          PostalCode: address.postal_code,
          Country: address.country,
          AttentionTo: address.attention_to
        }.compact
      end
      payload[:Addresses] = addresses if addresses.any?
    end

    # Add contact persons
    if teeem_contact.contact_persons.any?
      contact_persons = teeem_contact.contact_persons.map do |person|
        cp = {
          FirstName: person.first_name,
          LastName: person.last_name,
          EmailAddress: person.email,
          IncludeInEmails: person.include_in_emails
        }.compact
        cp[:ContactPersonID] = person.xero_contact_person_id if person.xero_contact_person_id.present?
        cp
      end
      payload[:ContactPersons] = contact_persons if contact_persons.any?
    end

    # Add bank account details
    # Format: "BSB: 123456, Account Number: 98765432, Account Name: Business Account"
    if teeem_contact.bank_bsb.present? || teeem_contact.bank_account_number.present? || teeem_contact.bank_account_name.present?
      bank_details = []
      bank_details << "BSB: #{teeem_contact.bank_bsb}" if teeem_contact.bank_bsb.present?
      bank_details << "Account Number: #{teeem_contact.bank_account_number}" if teeem_contact.bank_account_number.present?
      bank_details << "Account Name: #{teeem_contact.bank_account_name}" if teeem_contact.bank_account_name.present?
      payload[:BankAccountDetails] = bank_details.join(", ")
    end

    # Add purchase account
    if teeem_contact.default_purchase_account.present?
      payload[:PurchaseDetails] = {
        AccountCode: teeem_contact.default_purchase_account
      }
    end

    # Add sales account
    if teeem_contact.default_sales_account.present?
      payload[:SalesDetails] = {
        AccountCode: teeem_contact.default_sales_account
      }
    end

    # Add payment terms
    payment_terms = {}
    if teeem_contact.bill_due_day.present? || teeem_contact.bill_due_type.present?
      payment_terms[:Bills] = {}
      payment_terms[:Bills][:Day] = teeem_contact.bill_due_day if teeem_contact.bill_due_day.present?
      payment_terms[:Bills][:Type] = teeem_contact.bill_due_type if teeem_contact.bill_due_type.present?
    end
    if teeem_contact.sales_due_day.present? || teeem_contact.sales_due_type.present?
      payment_terms[:Sales] = {}
      payment_terms[:Sales][:Day] = teeem_contact.sales_due_day if teeem_contact.sales_due_day.present?
      payment_terms[:Sales][:Type] = teeem_contact.sales_due_type if teeem_contact.sales_due_type.present?
    end
    payload[:PaymentTerms] = payment_terms if payment_terms.any?

    # Add discount
    payload[:Discount] = teeem_contact.default_discount if teeem_contact.default_discount.present?

    payload
  end

  def extract_xero_email(xero_contact)
    # Xero can have email in EmailAddress field or in Addresses array
    return xero_contact["EmailAddress"] if xero_contact["EmailAddress"].present?

    # Check addresses for email
    if xero_contact["Addresses"].present?
      xero_contact["Addresses"].each do |address|
        return address["EmailAddress"] if address["EmailAddress"].present?
      end
    end

    nil
  end

  def normalize_tax_number(tax_number)
    return nil if tax_number.blank?
    # Remove spaces, dashes, and other formatting
    tax_number.to_s.gsub(/[\s\-]/, "").upcase
  end

  # Sync ContactPersons from Xero to TEEEM
  def sync_contact_persons_from_xero(teeem_contact, xero_contact)
    return unless xero_contact["ContactPersons"].present?

    xero_persons = xero_contact["ContactPersons"]
    existing_persons = teeem_contact.contact_persons.index_by(&:xero_contact_person_id)

    xero_persons.each do |xero_person|
      person_id = xero_person["ContactPersonID"]

      person_data = {
        first_name: xero_person["FirstName"],
        last_name: xero_person["LastName"],
        email: xero_person["EmailAddress"],
        include_in_emails: xero_person["IncludeInEmails"] != false, # Default true if not specified
        xero_contact_person_id: person_id
      }

      if existing_persons[person_id]
        # Update existing person
        existing_persons[person_id].update!(person_data)
        existing_persons.delete(person_id)
      else
        # Create new person
        teeem_contact.contact_persons.create!(person_data)
      end
    end

    # Delete persons that no longer exist in Xero
    existing_persons.values.each(&:destroy)
  end

  # Sync Addresses from Xero to TEEEM
  def sync_contact_addresses_from_xero(teeem_contact, xero_contact)
    return unless xero_contact["Addresses"].present?

    xero_addresses = xero_contact["Addresses"]
    existing_addresses = teeem_contact.contact_addresses.index_by(&:address_type)

    xero_addresses.each do |xero_address|
      address_type = xero_address["AddressType"] # STREET, POBOX, DELIVERY

      address_data = {
        address_type: address_type,
        line1: xero_address["AddressLine1"],
        line2: xero_address["AddressLine2"],
        line3: xero_address["AddressLine3"],
        line4: xero_address["AddressLine4"],
        city: xero_address["City"],
        region: xero_address["Region"],
        postal_code: xero_address["PostalCode"],
        country: xero_address["Country"],
        attention_to: xero_address["AttentionTo"]
      }

      if existing_addresses[address_type]
        # Update existing address
        existing_addresses[address_type].update!(address_data)
        existing_addresses.delete(address_type)
      else
        # Create new address
        teeem_contact.contact_addresses.create!(address_data)
      end
    end

    # Delete addresses that no longer exist in Xero
    existing_addresses.values.each(&:destroy)

    # Set first address as primary if none set
    if teeem_contact.contact_addresses.any? && !teeem_contact.contact_addresses.primary.any?
      teeem_contact.contact_addresses.first.update!(is_primary: true)
    end
  end

  # Sync ContactGroups from Xero to TEEEM
  def sync_contact_groups_from_xero(teeem_contact, xero_contact)
    return unless xero_contact["ContactGroups"].present?

    xero_groups = xero_contact["ContactGroups"]

    xero_groups.each do |xero_group|
      group_id = xero_group["ContactGroupID"]

      # Find or create contact group
      contact_group = ContactGroup.find_or_initialize_by(xero_contact_group_id: group_id)
      contact_group.name = xero_group["Name"]
      contact_group.status = xero_group["Status"]
      contact_group.save!

      # Create membership if doesn't exist
      unless teeem_contact.contact_groups.include?(contact_group)
        teeem_contact.contact_groups << contact_group
      end
    end

    # Remove memberships for groups not in Xero response
    xero_group_ids = xero_groups.map { |g| g["ContactGroupID"] }
    teeem_contact.contact_group_memberships.joins(:contact_group)
      .where.not(contact_groups: { xero_contact_group_id: xero_group_ids })
      .destroy_all
  end
end
