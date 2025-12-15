require "fuzzy_match"

class XeroContactSyncService
  attr_reader :stats

  SIMILARITY_THRESHOLD = 0.85
  RATE_LIMIT_SLEEP = 1200 # milliseconds between API calls (1.2s) to avoid Xero rate limits (60 requests per minute)

  def initialize(tenant_id: nil)
    @xero_client = XeroApiClient.new
    @tenant_id = tenant_id
    @sync_config = tenant_id ? SyncConfiguration.find_by(xero_tenant_id: tenant_id) : nil
    @stats = {
      matched: 0,
      created_in_teeem: 0,
      created_in_xero: 0,
      updated: 0,
      contact_persons_synced: 0,
      deleted_from_teeem: 0,
      links_created: 0,
      links_updated: 0,
      errors: [],
      validation_errors: [],
      skipped: 0,
      skipped_by_rule: {}
    }
    @sync_timestamp = Time.current
  end

  # Main sync method - syncs a specific tenant or all tenants
  def sync
    if @tenant_id
      sync_tenant(@tenant_id)
    else
      sync_all_tenants
    end
  end

  # Sync all connected Xero tenants
  def sync_all_tenants
    Rails.logger.info("Starting multi-tenant Xero contact sync at #{@sync_timestamp}")

    results = []
    SyncConfiguration.where(sync_enabled: true).find_each do |config|
      begin
        Rails.logger.info("Syncing tenant: #{config.xero_tenant_name} (#{config.xero_tenant_id})")
        result = sync_tenant(config.xero_tenant_id)
        results << result
      rescue StandardError => e
        error_msg = "Failed to sync tenant #{config.xero_tenant_name}: #{e.message}"
        Rails.logger.error(error_msg)
        @stats[:errors] << error_msg
      end
    end

    {
      success: @stats[:errors].empty?,
      stats: @stats,
      tenant_results: results,
      synced_at: @sync_timestamp
    }
  end

  # Sync a specific tenant
  def sync_tenant(tenant_id)
    Rails.logger.info("Starting Xero contact sync for tenant #{tenant_id} at #{@sync_timestamp}")

    @tenant_id = tenant_id
    @sync_config = SyncConfiguration.find_by(xero_tenant_id: tenant_id)

    unless @sync_config
      Rails.logger.warn("No sync configuration found for tenant #{tenant_id}, creating default")
      @sync_config = SyncConfiguration.create!(
        xero_tenant_id: tenant_id,
        xero_tenant_name: "Unknown",
        sync_enabled: true
      )
    end

    # Check if sync is disabled for this tenant
    if @sync_config.sync_disabled?
      Rails.logger.info("Sync is disabled for tenant #{tenant_id}, skipping")
      return {
        success: true,
        tenant_id: tenant_id,
        tenant_name: @sync_config.xero_tenant_name,
        stats: @stats,
        synced_at: @sync_timestamp,
        message: "Sync disabled for this tenant"
      }
    end

    sync_direction = @sync_config.effective_sync_direction
    Rails.logger.info("Sync direction for tenant #{tenant_id}: #{sync_direction}")

    begin
      # Fetch all contacts from Xero for this tenant
      xero_contacts = fetch_xero_contacts(tenant_id)
      teeem_contacts = Contact.all.to_a

      Rails.logger.info("Fetched #{xero_contacts.length} Xero contacts and #{teeem_contacts.length} TEEEM contacts")

      # Process contacts for this tenant
      xero_ids = process_contacts_for_tenant(xero_contacts, teeem_contacts, tenant_id)

      # Clean up links for contacts that no longer exist in Xero
      cleanup_deleted_xero_contacts_for_tenant(xero_ids, tenant_id)

      # Update sync configuration
      @sync_config.update!(last_full_sync_at: @sync_timestamp)

      Rails.logger.info("Xero contact sync for tenant #{tenant_id} completed: #{@stats.inspect}")

      # NOTE: XeroSyncStatus updates are handled by the Job, not the Service
      # Services are pure business logic; Jobs own status tracking

      {
        success: true,
        tenant_id: tenant_id,
        tenant_name: @sync_config.xero_tenant_name,
        stats: @stats,
        synced_at: @sync_timestamp
      }
    rescue XeroApiClient::AuthenticationError => e
      handle_sync_error("Authentication error", e)
    rescue XeroApiClient::RateLimitError => e
      handle_sync_error("Rate limit exceeded", e)
    rescue StandardError => e
      handle_sync_error("Sync failed", e, include_backtrace: true)
    end
  end

  # Sync a single contact to a specific tenant
  def sync_contact_to_tenant(contact, tenant_id)
    link = contact.xero_links.find_by(tenant_id: tenant_id)

    if link&.external_contact_id.present?
      # Update existing Xero contact
      update_xero_contact(contact, link)
    else
      # Create new Xero contact
      create_xero_contact_for_tenant(contact, tenant_id)
    end
  end

  # Sync from Xero to TEEEM for a specific link
  def sync_from_xero(link)
    return unless link.external_contact_id.present?

    xero_contact = fetch_single_xero_contact(link.external_contact_id, link.tenant_id)
    return unless xero_contact

    update_teeem_from_xero(link.contact, xero_contact, link)
    link.mark_synced!

    { success: true, contact: link.contact.reload }
  rescue StandardError => e
    link.update!(sync_error: e.message)
    { success: false, error: e.message }
  end

  # Sync from TEEEM to Xero - push contact changes to Xero
  def sync_to_xero(contact, link)
    return { success: false, error: "No Xero link provided" } unless link&.external_contact_id.present?

    result = update_xero_contact(contact, link)

    if result[:success]
      link.mark_synced!
      { success: true, contact: contact.reload }
    else
      { success: false, error: result[:error] }
    end
  rescue StandardError => e
    error_msg = "Failed to sync to Xero: #{e.message}"
    link.record_error!(error_msg)
    { success: false, error: error_msg }
  end

  # Make methods public for use by XeroContactSyncJob
  def fetch_xero_contacts(tenant_id = nil)
    options = {}
    options[:tenant_id] = tenant_id if tenant_id

    result = @xero_client.get("Contacts", options)

    if result[:success]
      contacts = result[:data]["Contacts"] || []
      Rails.logger.info("Successfully fetched #{contacts.length} contacts from Xero")
      contacts
    else
      raise XeroApiClient::ApiError, "Failed to fetch Xero contacts"
    end
  end

  def fetch_single_xero_contact(contact_id, tenant_id = nil)
    options = {}
    options[:tenant_id] = tenant_id if tenant_id

    result = @xero_client.get("Contacts/#{contact_id}", options)

    if result[:success]
      result[:data]["Contacts"]&.first
    else
      nil
    end
  end

  def process_contacts_for_tenant(xero_contacts, teeem_contacts, tenant_id)
    # Track which contacts have been matched
    matched_teeem_ids = Set.new
    matched_xero_ids = Set.new

    # Get sync direction from config
    import_enabled = @sync_config&.import_enabled? != false
    export_enabled = @sync_config&.export_enabled? == true
    sync_direction = @sync_config&.effective_sync_direction || "import_only"

    Rails.logger.info("Processing contacts with sync direction: #{sync_direction} (import: #{import_enabled}, export: #{export_enabled})")

    # Get existing links for this tenant
    existing_links = ContactExternalLink.xero.where(tenant_id: tenant_id).index_by(&:external_contact_id)

    # Build lookup maps for efficient matching
    teeem_by_xero_link = existing_links.transform_values { |link| Contact.find_by(id: link.contact_id) }
    teeem_by_tax_number = teeem_contacts.select { |c| c.tax_number.present? }
                                          .group_by(&:tax_number)
    teeem_by_email = teeem_contacts.select { |c| c.email.present? }
                                     .index_by { |c| c.email.downcase.strip }

    # Process each Xero contact (import from Xero)
    if import_enabled
      xero_contacts.each do |xero_contact|
        begin
          xero_id = xero_contact["ContactID"]

          # Check if we already have a link for this Xero contact
          if existing_links[xero_id]
            link = existing_links[xero_id]
            teeem_contact = link.contact
            if teeem_contact
              matched_teeem_ids.add(teeem_contact.id)
              matched_xero_ids.add(xero_id)
              sync_matched_contact(teeem_contact, xero_contact, link)
              @stats[:matched] += 1
            end
          else
            # Try cross-tenant matching first (searches ALL TEEEM contacts)
            # This handles cases where a contact exists in TEEEM from a different Xero org
            cross_match = detect_cross_tenant_match(xero_contact)

            if cross_match
              # Cross-tenant match found - link to existing contact
              teeem_contact = cross_match[:contact]
              matched_teeem_ids.add(teeem_contact.id)
              matched_xero_ids.add(xero_id)

              link = create_or_update_xero_link(
                teeem_contact,
                xero_contact,
                tenant_id,
                match_type: cross_match[:match_type],
                match_confidence: cross_match[:match_confidence],
                needs_review: cross_match[:needs_review]
              )

              # Only sync data if not needing review
              unless cross_match[:needs_review]
                sync_matched_contact(teeem_contact, xero_contact, link)
              end

              @stats[:matched] += 1
            else
              # Try local matching (within this sync batch)
              teeem_contact = find_matching_teeem_contact(
                xero_contact,
                {},  # No xero_id lookup for new matches
                teeem_by_tax_number,
                teeem_by_email,
                teeem_contacts - matched_teeem_ids.map { |id| teeem_contacts.find { |c| c.id == id } }.compact
              )

              if teeem_contact
                # Match found - create link and update
                matched_teeem_ids.add(teeem_contact.id)
                matched_xero_ids.add(xero_id)
                link = create_or_update_xero_link(teeem_contact, xero_contact, tenant_id, match_type: "exact_abn")
                sync_matched_contact(teeem_contact, xero_contact, link)
                @stats[:matched] += 1
              else
                # No match - create in TEEEM with link
                new_contact = create_teeem_contact_from_xero(xero_contact, tenant_id)
                matched_xero_ids.add(xero_id)
                @stats[:created_in_teeem] += 1
              end
            end
          end

          # Small delay to avoid rate limits
          sleep(RATE_LIMIT_SLEEP / 1000.0)
        rescue StandardError => e
          error_msg = "Error processing Xero contact #{xero_contact['Name']}: #{e.message}"
          Rails.logger.error(error_msg)
          @stats[:errors] << error_msg
        end
      end
    else
      Rails.logger.info("Import disabled - skipping Xero contact processing")
    end

    # Process unmatched TEEEM contacts (export to Xero)
    unmatched_teeem = teeem_contacts.reject { |c| matched_teeem_ids.include?(c.id) }

    if export_enabled
      Rails.logger.info("Export enabled - pushing #{unmatched_teeem.count} unmatched TEEEM contacts to Xero")
      unmatched_teeem.each do |teeem_contact|
        begin
          # Only export contacts that are marked for sync
          next unless teeem_contact.sync_with_xero

          # Apply validation rules (skip employees, default suppliers, etc.)
          unless @sync_config&.should_sync_contact?(teeem_contact)
            skip_reason = @sync_config.skip_reason(teeem_contact)
            Rails.logger.info("Skipping contact #{teeem_contact.display_name} - rule: #{skip_reason}")

            @stats[:skipped_by_rule][skip_reason] ||= 0
            @stats[:skipped_by_rule][skip_reason] += 1
            @stats[:skipped] += 1
            next
          end

          result = create_xero_contact_for_tenant(teeem_contact, tenant_id)
          if result[:success]
            matched_teeem_ids.add(teeem_contact.id)
          end

          sleep(RATE_LIMIT_SLEEP / 1000.0)
        rescue StandardError => e
          error_msg = "Error exporting TEEEM contact #{teeem_contact.display_name}: #{e.message}"
          Rails.logger.error(error_msg)
          @stats[:errors] << error_msg
        end
      end
    else
      @stats[:skipped] = unmatched_teeem.count
      Rails.logger.info("Export disabled - #{@stats[:skipped]} TEEEM contacts not pushed to Xero")
    end

    # Return set of all Xero IDs we processed
    matched_xero_ids
  end

  # Legacy method for backwards compatibility
  def process_contacts(xero_contacts, teeem_contacts)
    process_contacts_for_tenant(xero_contacts, teeem_contacts, @tenant_id)
  end

  def find_matching_teeem_contact(xero_contact, by_xero_id, by_tax_number, by_email, remaining_contacts)
    xero_id = xero_contact["ContactID"]
    xero_tax = xero_contact["TaxNumber"]
    xero_email = extract_xero_email(xero_contact)
    xero_name = xero_contact["Name"]

    # Priority 1: Match by xero_id (legacy field)
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
    contact_names = contacts.map { |c| [ c.display_name, c ] }.to_h
    matcher = FuzzyMatch.new(contact_names.keys)

    # Find best match
    matched_name = matcher.find(xero_name, threshold: SIMILARITY_THRESHOLD)

    matched_name ? contact_names[matched_name] : nil
  end

  # Cross-tenant matching with metadata for review flagging
  # Searches ALL TEEEM contacts (not just unmatched) to find existing contacts
  # that may have been imported from a different Xero tenant
  def detect_cross_tenant_match(xero_contact)
    xero_tax = xero_contact["TaxNumber"]
    xero_email = extract_xero_email(xero_contact)
    xero_name = xero_contact["Name"]

    # Priority 1: Exact ABN match (100% confidence, auto-link)
    if xero_tax.present?
      normalized_tax = normalize_tax_number(xero_tax)
      existing_contact = Contact.find_by(tax_number: normalized_tax)
      if existing_contact
        Rails.logger.info("Cross-tenant match by ABN: #{xero_name} -> #{existing_contact.display_name}")
        return {
          contact: existing_contact,
          match_type: "exact_abn",
          match_confidence: 1.0,
          needs_review: false
        }
      end
    end

    # Priority 2: Exact email match (100% confidence, auto-link)
    if xero_email.present?
      existing_contact = Contact.find_by("LOWER(email) = ?", xero_email.downcase.strip)
      if existing_contact
        Rails.logger.info("Cross-tenant match by email: #{xero_name} -> #{existing_contact.display_name}")
        return {
          contact: existing_contact,
          match_type: "exact_email",
          match_confidence: 1.0,
          needs_review: false
        }
      end
    end

    # Priority 3: Fuzzy name match (requires review)
    if xero_name.present?
      contacts_to_check = Contact.where(entity_type: %w[company trust sole_trader])
      result = fuzzy_match_by_name_with_score(xero_name, contacts_to_check)
      if result
        Rails.logger.info("Cross-tenant fuzzy match: #{xero_name} -> #{result[:contact].display_name} (#{(result[:score] * 100).round}%)")
        return {
          contact: result[:contact],
          match_type: "fuzzy_name",
          match_confidence: result[:score],
          needs_review: true  # Flag for manual review
        }
      end
    end

    nil
  end

  # Fuzzy matching that returns both contact and confidence score
  def fuzzy_match_by_name_with_score(xero_name, contacts)
    return nil if contacts.empty?

    # Normalize the Xero name for comparison
    normalized_xero_name = xero_name.downcase.gsub(/\s+/, " ").strip

    best_match = nil
    best_score = 0.0

    contacts.find_each do |contact|
      next unless contact.display_name.present?

      normalized_contact_name = contact.display_name.downcase.gsub(/\s+/, " ").strip

      # Calculate similarity using Levenshtein-based approach
      matcher = FuzzyMatch.new([ normalized_contact_name ])
      score = calculate_name_similarity(normalized_xero_name, normalized_contact_name)

      if score > best_score && score >= SIMILARITY_THRESHOLD
        best_score = score
        best_match = { contact: contact, score: score }
      end
    end

    best_match
  end

  # Calculate similarity between two names (0.0 to 1.0)
  def calculate_name_similarity(name1, name2)
    return 1.0 if name1 == name2

    # Use Levenshtein distance normalized by max length
    distance = levenshtein_distance(name1, name2)
    max_len = [ name1.length, name2.length ].max
    return 0.0 if max_len.zero?

    1.0 - (distance.to_f / max_len)
  end

  # Simple Levenshtein distance implementation
  def levenshtein_distance(s1, s2)
    m = s1.length
    n = s2.length
    return m if n.zero?
    return n if m.zero?

    d = Array.new(m + 1) { Array.new(n + 1) }

    (0..m).each { |i| d[i][0] = i }
    (0..n).each { |j| d[0][j] = j }

    (1..m).each do |i|
      (1..n).each do |j|
        cost = s1[i - 1] == s2[j - 1] ? 0 : 1
        d[i][j] = [ d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost ].min
      end
    end

    d[m][n]
  end

  def create_or_update_xero_link(teeem_contact, xero_contact, tenant_id, match_type: "manual", match_confidence: nil, needs_review: false)
    xero_id = xero_contact["ContactID"]

    link = teeem_contact.xero_links.find_or_initialize_by(
      tenant_id: tenant_id,
      external_contact_id: xero_id
    )

    link.assign_attributes(
      source: "xero",
      tenant_name: @sync_config&.xero_tenant_name || "Unknown",
      sync_enabled: !needs_review,  # Disable sync until reviewed if needed
      sync_direction: "bidirectional",
      last_synced_at: needs_review ? nil : @sync_timestamp,
      external_last_modified_at: parse_xero_date(xero_contact["UpdatedDateUTC"]),
      sync_error: nil,
      match_type: match_type,
      match_confidence: match_confidence,
      needs_review: needs_review
    )

    if link.new_record?
      link.save!
      @stats[:links_created] += 1
      review_note = needs_review ? " (NEEDS REVIEW)" : ""
      Rails.logger.info("Created xero_link for contact ##{teeem_contact.id} -> #{xero_id} [#{match_type}]#{review_note}")
    else
      link.save!
      @stats[:links_updated] += 1
    end

    # Mark link as verified (contact exists and is active in Xero)
    link.mark_verified! unless needs_review

    link
  end

  def sync_matched_contact(teeem_contact, xero_contact, link = nil)
    Rails.logger.info("Syncing matched contact: TEEEM ##{teeem_contact.id} <-> Xero #{xero_contact['Name']}")

    # Update TEEEM with Xero data
    update_teeem_from_xero(teeem_contact, xero_contact, link)

    # Update link sync status
    link&.mark_synced!
  end

  def update_teeem_from_xero(teeem_contact, xero_contact, link = nil)
    updates = {}

    # DEPRECATED: Legacy xero_id field - use WarehouseContact.xero_id instead
    # Keeping for backwards compatibility during migration period
    # TODO: Remove after Phase 5 migration is verified complete
    updates[:xero_id] = xero_contact["ContactID"] if teeem_contact.xero_id.blank?

    # Get field mappings from sync config
    field_mappings = @sync_config&.field_mappings || SyncConfiguration::DEFAULT_FIELD_MAPPINGS

    # Only import fields where direction is 'import' or 'bidirectional'
    importable_fields = field_mappings.select { |_, dir| [ "import", "bidirectional" ].include?(dir) }.keys

    # Extract Xero contact types (Customer/Supplier) - can be both!
    # NOTE: Do NOT set roles field - "customer"/"supplier" are NOT valid TEEEM roles
    # TEEEM roles are for internal contacts only (Employee, Director, etc.)
    # Use xero_contact_types field instead for Xero customer/supplier tracking
    xero_contact_types = []
    xero_contact_types << "Customer" if xero_contact["IsCustomer"] == true
    xero_contact_types << "Supplier" if xero_contact["IsSupplier"] == true
    updates[:xero_contact_types] = xero_contact_types

    # Determine if this is a company contact
    is_company = xero_contact_is_company?(xero_contact)

    # Apply field mappings
    if importable_fields.include?("name")
      updates[:display_name] = xero_contact["Name"] if xero_contact["Name"].present?
      updates[:entity_type] = is_company ? "company" : "person"

      if is_company
        updates[:first_name] = nil
        updates[:last_name] = nil
        updates[:company_name_or_trust] = xero_contact["Name"]
      else
        updates[:first_name] = xero_contact["FirstName"] if xero_contact["FirstName"].present?
        updates[:last_name] = xero_contact["LastName"] if xero_contact["LastName"].present?
      end
    end

    if importable_fields.include?("email")
      xero_email = extract_xero_email(xero_contact)
      updates[:email] = xero_email if xero_email.present?
    end

    if importable_fields.include?("tax_number")
      updates[:tax_number] = normalize_tax_number(xero_contact["TaxNumber"]) if xero_contact["TaxNumber"].present?
    end

    if importable_fields.include?("mobile_phone") || importable_fields.include?("office_phone")
      if xero_contact["Phones"].present?
        xero_contact["Phones"].each do |phone|
          case phone["PhoneType"]
          when "MOBILE"
            updates[:mobile_phone] = phone["PhoneNumber"] if phone["PhoneNumber"].present? && importable_fields.include?("mobile_phone")
          when "DEFAULT", "DDI"
            updates[:office_phone] = phone["PhoneNumber"] if phone["PhoneNumber"].present? && importable_fields.include?("office_phone")
          when "FAX"
            updates[:fax_phone] = phone["PhoneNumber"] if phone["PhoneNumber"].present?
          end
        end
      end
    end

    # Bank details - parse both business and trust accounts
    # Lawyers/accountants often have both in the BankAccountDetails field
    if importable_fields.include?("bank_bsb") || importable_fields.include?("bank_account_number")
      if xero_contact["BankAccountDetails"].present?
        bank_details = xero_contact["BankAccountDetails"]

        # Check if this contains trust account info (common patterns lawyers use)
        has_trust_info = bank_details.match?(/trust/i)

        if has_trust_info
          # Extract Trust account details
          # Patterns: "Trust BSB: 123456" or "Trust Account BSB: 123456"
          if bank_details.match(/trust[^:]*BSB[:\s]+(\d{3}[-\s]?\d{3})/i)
            updates[:has_trust_account] = true
            updates[:trust_bsb] = $1.gsub(/[-\s]/, "")
          end
          if bank_details.match(/trust[^:]*Account(?:\s*(?:Number|#|No))?[:\s]+([\d\s-]+)/i)
            updates[:trust_account_number] = $1.gsub(/[\s-]/, "")
          end
          if bank_details.match(/trust[^:]*Account\s*Name[:\s]+([^,\n]+)/i)
            updates[:trust_account_name] = $1.strip
          end

          # Extract Business/Operating account (look for non-trust BSB)
          # Pattern: "Business BSB" or "Operating BSB" or just BSB that's not after "Trust"
          if bank_details.match(/(?:business|operating|general)[^:]*BSB[:\s]+(\d{3}[-\s]?\d{3})/i)
            updates[:bank_bsb] = $1.gsub(/[-\s]/, "") if importable_fields.include?("bank_bsb")
          elsif importable_fields.include?("bank_bsb")
            # Fallback: find BSB that's not part of trust account section
            # Split by lines/sections and find first BSB not in a trust context
            bank_details.scan(/(?:^|[\n,])([^\n,]*BSB[:\s]+(\d{3}[-\s]?\d{3}))/i).each do |match|
              context, bsb = match
              unless context =~ /trust/i
                updates[:bank_bsb] = bsb.gsub(/[-\s]/, "")
                break
              end
            end
          end
          if bank_details.match(/(?:business|operating|general)[^:]*Account(?:\s*(?:Number|#|No))?[:\s]+([\d\s-]+)/i)
            updates[:bank_account_number] = $1.gsub(/[\s-]/, "") if importable_fields.include?("bank_account_number")
          end
        else
          # Standard single account extraction
          if bank_details.match(/BSB[:\s]+(\d{3}[-\s]?\d{3})/) && importable_fields.include?("bank_bsb")
            updates[:bank_bsb] = $1.gsub(/[-\s]/, "")
          end
          if bank_details.match(/Account\s*(?:Number|#|No)?[:\s]+([\d\s-]+)/) && importable_fields.include?("bank_account_number")
            updates[:bank_account_number] = $1.gsub(/[\s-]/, "")
          end
          if bank_details.match(/Account\s*Name[:\s]+([^,\n]+)/) && importable_fields.include?("bank_account_name")
            updates[:bank_account_name] = $1.strip
          end
        end
      end
    end

    # Payment terms
    if xero_contact["PaymentTerms"].present?
      if xero_contact["PaymentTerms"]["Bills"].present? && importable_fields.include?("bill_due_day")
        bills = xero_contact["PaymentTerms"]["Bills"]
        updates[:bill_due_day] = bills["Day"] if bills["Day"].present?
        updates[:bill_due_type] = bills["Type"] if bills["Type"].present?

        # Convert to readable payment_terms string (e.g., "Net 30", "7 days", "EOM+30")
        updates[:payment_terms] = format_payment_terms(bills["Type"], bills["Day"])
      end
      if xero_contact["PaymentTerms"]["Sales"].present? && importable_fields.include?("sales_due_day")
        sales = xero_contact["PaymentTerms"]["Sales"]
        updates[:sales_due_day] = sales["Day"] if sales["Day"].present?
        updates[:sales_due_type] = sales["Type"] if sales["Type"].present?
      end
    end

    # Xero-specific fields (always import)
    updates[:xero_contact_status] = xero_contact["ContactStatus"] if xero_contact["ContactStatus"].present?
    updates[:xero_contact_number] = xero_contact["ContactNumber"] if xero_contact["ContactNumber"].present?
    updates[:xero_account_number] = xero_contact["AccountNumber"] if xero_contact["AccountNumber"].present?
    updates[:website] = xero_contact["Website"] if xero_contact["Website"].present?
    updates[:default_discount] = xero_contact["Discount"] if xero_contact["Discount"].present?
    updates[:default_purchase_account] = xero_contact["PurchasesDefaultAccountCode"] if xero_contact["PurchasesDefaultAccountCode"].present?
    updates[:default_sales_account] = xero_contact["SalesDefaultAccountCode"] if xero_contact["SalesDefaultAccountCode"].present?

    # Outstanding balances
    if xero_contact["Balances"].present?
      balances = xero_contact["Balances"]
      if balances["AccountsReceivable"].present?
        updates[:accounts_receivable_outstanding] = balances["AccountsReceivable"]["Outstanding"]
        updates[:accounts_receivable_overdue] = balances["AccountsReceivable"]["Overdue"]
      end
      if balances["AccountsPayable"].present?
        updates[:accounts_payable_outstanding] = balances["AccountsPayable"]["Outstanding"]
        updates[:accounts_payable_overdue] = balances["AccountsPayable"]["Overdue"]
      end
    end

    # Address - sync to both legacy field and contact_addresses table
    if xero_contact["Addresses"].present?
      street_address = xero_contact["Addresses"].find { |a| a["AddressType"] == "STREET" }
      address_to_use = street_address || xero_contact["Addresses"].first

      if address_to_use
        address_parts = [
          address_to_use["AddressLine1"],
          address_to_use["AddressLine2"],
          address_to_use["AddressLine3"],
          address_to_use["AddressLine4"],
          [ address_to_use["City"], address_to_use["Region"], address_to_use["PostalCode"] ].compact.join(" "),
          address_to_use["Country"]
        ].compact.reject(&:blank?)

        updates[:address] = address_parts.join(", ") if address_parts.any?

        # Sync structured address fields
        updates[:city] = address_to_use["City"] if address_to_use["City"].present?
        updates[:state] = address_to_use["Region"] if address_to_use["Region"].present?
        updates[:postcode] = address_to_use["PostalCode"] if address_to_use["PostalCode"].present?
      end

      # Sync to contact_addresses table (two-way sync - TEEEM is source of truth)
      sync_addresses_from_xero(teeem_contact, xero_contact["Addresses"])
    end

    # Track changes for activity logging
    changed_fields = updates.keys - [ :xero_id ]
    changes_made = changed_fields.each_with_object({}) do |field, hash|
      old_value = teeem_contact.send(field) rescue nil
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
        action: "updated",
        changes: changes_made,
        xero_data: xero_contact
      )
    end
  rescue StandardError => e
    error_msg = "Failed to update TEEEM contact: #{e.message}"
    link&.record_error!(error_msg)
    raise
  end

  def create_teeem_contact_from_xero(xero_contact, tenant_id)
    Rails.logger.info("Creating TEEEM contact from Xero: #{xero_contact['Name']}")

    # Extract roles from Xero IsCustomer/IsSupplier flags
    roles = []
    roles << "customer" if xero_contact["IsCustomer"] == true
    roles << "supplier" if xero_contact["IsSupplier"] == true

    # Extract Xero contact types (Customer/Supplier) - can be both!
    xero_contact_types = []
    xero_contact_types << "Customer" if xero_contact["IsCustomer"] == true
    xero_contact_types << "Supplier" if xero_contact["IsSupplier"] == true

    is_company = xero_contact_is_company?(xero_contact)

    contact_data = {
      xero_id: xero_contact["ContactID"],  # Legacy field
      display_name: xero_contact["Name"],
      first_name: is_company ? nil : xero_contact["FirstName"],
      last_name: is_company ? nil : xero_contact["LastName"],
      company_name_or_trust: is_company ? xero_contact["Name"] : nil,
      entity_type: is_company ? "company" : "person",
      tax_number: normalize_tax_number(xero_contact["TaxNumber"]),
      email: extract_xero_email(xero_contact),
      roles: roles.any? ? roles : nil,
      xero_contact_types: xero_contact_types,
      sync_with_xero: true,
      xero_contact_status: xero_contact["ContactStatus"],
      xero_contact_number: xero_contact["ContactNumber"],
      xero_account_number: xero_contact["AccountNumber"],
      website: xero_contact["Website"],
      default_discount: xero_contact["Discount"],
      default_purchase_account: xero_contact["PurchasesDefaultAccountCode"],
      default_sales_account: xero_contact["SalesDefaultAccountCode"]
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

    # Extract address
    if xero_contact["Addresses"].present?
      street_address = xero_contact["Addresses"].find { |a| a["AddressType"] == "STREET" }
      address_to_use = street_address || xero_contact["Addresses"].first

      if address_to_use
        address_parts = [
          address_to_use["AddressLine1"],
          address_to_use["AddressLine2"],
          address_to_use["AddressLine3"],
          address_to_use["AddressLine4"],
          [ address_to_use["City"], address_to_use["Region"], address_to_use["PostalCode"] ].compact.join(" "),
          address_to_use["Country"]
        ].compact.reject(&:blank?)

        contact_data[:address] = address_parts.join(", ") if address_parts.any?

        # Extract structured address fields
        contact_data[:city] = address_to_use["City"] if address_to_use["City"].present?
        contact_data[:state] = address_to_use["Region"] if address_to_use["Region"].present?
        contact_data[:postcode] = address_to_use["PostalCode"] if address_to_use["PostalCode"].present?
      end
    end

    # Extract payment terms
    if xero_contact["PaymentTerms"].present?
      if xero_contact["PaymentTerms"]["Bills"].present?
        bills = xero_contact["PaymentTerms"]["Bills"]
        contact_data[:bill_due_day] = bills["Day"] if bills["Day"].present?
        contact_data[:bill_due_type] = bills["Type"] if bills["Type"].present?
      end
      if xero_contact["PaymentTerms"]["Sales"].present?
        sales = xero_contact["PaymentTerms"]["Sales"]
        contact_data[:sales_due_day] = sales["Day"] if sales["Day"].present?
        contact_data[:sales_due_type] = sales["Type"] if sales["Type"].present?
      end
    end

    # Extract balances
    if xero_contact["Balances"].present?
      balances = xero_contact["Balances"]
      if balances["AccountsReceivable"].present?
        contact_data[:accounts_receivable_outstanding] = balances["AccountsReceivable"]["Outstanding"]
        contact_data[:accounts_receivable_overdue] = balances["AccountsReceivable"]["Overdue"]
      end
      if balances["AccountsPayable"].present?
        contact_data[:accounts_payable_outstanding] = balances["AccountsPayable"]["Outstanding"]
        contact_data[:accounts_payable_overdue] = balances["AccountsPayable"]["Overdue"]
      end
    end

    new_contact = Contact.create!(contact_data.compact)
    Rails.logger.info("Created TEEEM contact from Xero: #{xero_contact['Name']}")

    # Create the xero link
    create_or_update_xero_link(new_contact, xero_contact, tenant_id)

    # Sync contact persons from Xero
    sync_contact_persons(new_contact, xero_contact)

    # Log activity for new contact creation
    ContactActivity.log_xero_sync(
      contact: new_contact,
      action: "created",
      changes: {},
      xero_data: xero_contact
    )

    new_contact
  rescue StandardError => e
    error_msg = "Failed to create TEEEM contact from Xero: #{e.message}"
    Rails.logger.error(error_msg)
    raise
  end

  def create_xero_contact_for_tenant(teeem_contact, tenant_id)
    Rails.logger.info("Creating Xero contact from TEEEM: #{teeem_contact.display_name} in tenant #{tenant_id}")

    # Check validation rules
    unless @sync_config&.should_sync_contact?(teeem_contact)
      skip_reason = @sync_config.skip_reason(teeem_contact)
      return {
        success: false,
        error: "Contact skipped by validation rule: #{skip_reason}",
        skipped: true
      }
    end

    # Validate contact data before syncing to Xero
    validator = XeroContactValidator.new(teeem_contact)
    unless validator.valid?
      error_msg = "Contact validation failed: #{validator.error_messages}"
      Rails.logger.warn("#{error_msg} for contact #{teeem_contact.display_name} (ID: #{teeem_contact.id})")
      @stats[:validation_errors] ||= []
      @stats[:validation_errors] << {
        contact_id: teeem_contact.id,
        contact_name: teeem_contact.display_name,
        errors: validator.errors
      }
      return {
        success: false,
        error: error_msg,
        validation_failed: true
      }
    end

    xero_payload = {
      Contacts: [
        build_xero_contact_payload(teeem_contact)
      ]
    }

    result = @xero_client.post("Contacts", xero_payload, tenant_id: tenant_id)

    if result[:success]
      created_contact = result[:data]["Contacts"]&.first
      if created_contact
        # Create the link
        link = teeem_contact.xero_links.create!(
          source: "xero",
          tenant_id: tenant_id,
          tenant_name: @sync_config&.xero_tenant_name || "Unknown",
          external_contact_id: created_contact["ContactID"],
          sync_enabled: true,
          sync_direction: "bidirectional",
          last_synced_at: @sync_timestamp
        )

        # DEPRECATED: Legacy xero_id field - use WarehouseContact.xero_id instead
        # Keeping for backwards compatibility during migration period
        # TODO: Remove after Phase 5 migration is verified complete
        if teeem_contact.xero_id.blank?
          teeem_contact.update!(xero_id: created_contact["ContactID"])
        end

        @stats[:created_in_xero] += 1
        @stats[:links_created] += 1
        Rails.logger.info("Created Xero contact: #{created_contact['ContactID']}")

        { success: true, link: link }
      end
    else
      raise XeroApiClient::ApiError, "Failed to create contact in Xero"
    end
  rescue StandardError => e
    error_msg = "Failed to create Xero contact: #{e.message}"
    Rails.logger.error(error_msg)
    { success: false, error: error_msg }
  end

  def update_xero_contact(teeem_contact, link)
    Rails.logger.info("Updating Xero contact: #{link.external_contact_id}")

    # Validate contact data before syncing to Xero
    validator = XeroContactValidator.new(teeem_contact)
    unless validator.valid?
      error_msg = "Contact validation failed: #{validator.error_messages}"
      Rails.logger.warn("#{error_msg} for contact #{teeem_contact.display_name} (ID: #{teeem_contact.id})")
      link.update!(sync_error: error_msg)
      @stats[:validation_errors] ||= []
      @stats[:validation_errors] << {
        contact_id: teeem_contact.id,
        contact_name: teeem_contact.display_name,
        errors: validator.errors
      }
      return {
        success: false,
        error: error_msg,
        validation_failed: true
      }
    end

    xero_payload = {
      Contacts: [
        build_xero_contact_payload(teeem_contact).merge(ContactID: link.external_contact_id)
      ]
    }

    Rails.logger.info("Xero payload: #{xero_payload.to_json}")

    result = @xero_client.post("Contacts", xero_payload, tenant_id: link.tenant_id)

    Rails.logger.info("Xero result: #{result.inspect}")

    if result[:success]
      link.mark_synced!
      @stats[:updated] += 1
      { success: true, link: link }
    else
      error_msg = result[:error] || "Failed to update contact in Xero"
      Rails.logger.error("Xero update failed: #{error_msg}")
      link.update!(sync_error: error_msg)
      { success: false, error: error_msg }
    end
  rescue StandardError => e
    error_msg = "Failed to update Xero contact: #{e.message}"
    Rails.logger.error("Xero update exception: #{error_msg}\n#{e.backtrace.first(5).join("\n")}")
    link.update!(sync_error: error_msg)
    { success: false, error: error_msg }
  end

  def build_xero_contact_payload(teeem_contact)
    payload = {
      Name: teeem_contact.display_name || "#{teeem_contact.first_name} #{teeem_contact.last_name}".strip
    }

    payload[:FirstName] = teeem_contact.first_name if teeem_contact.first_name.present?
    payload[:LastName] = teeem_contact.last_name if teeem_contact.last_name.present?
    payload[:EmailAddress] = teeem_contact.email if teeem_contact.email.present?
    payload[:TaxNumber] = teeem_contact.tax_number if teeem_contact.tax_number.present?

    # Add phone numbers
    phones = []
    if teeem_contact.mobile_phone.present?
      phones << { PhoneType: "MOBILE", PhoneNumber: teeem_contact.mobile_phone }
    end
    if teeem_contact.office_phone.present?
      phones << { PhoneType: "DEFAULT", PhoneNumber: teeem_contact.office_phone }
    end
    payload[:Phones] = phones if phones.any?

    # Bank details
    if teeem_contact.bank_bsb.present? || teeem_contact.bank_account_number.present?
      bank_parts = []
      bank_parts << "BSB: #{teeem_contact.bank_bsb}" if teeem_contact.bank_bsb.present?
      bank_parts << "Account Number: #{teeem_contact.bank_account_number}" if teeem_contact.bank_account_number.present?
      bank_parts << "Account Name: #{teeem_contact.bank_account_name}" if teeem_contact.bank_account_name.present?
      payload[:BankAccountDetails] = bank_parts.join(", ")
    end

    # Addresses - sync from contact_addresses table (SSoT)
    addresses = build_xero_addresses(teeem_contact)
    payload[:Addresses] = addresses if addresses.any?

    payload
  end

  # Build Xero Addresses array from contact_addresses table
  def build_xero_addresses(teeem_contact)
    addresses = []

    teeem_contact.contact_addresses.each do |addr|
      next unless addr.address_type.present?

      xero_addr = {
        AddressType: addr.address_type
      }

      # Only include non-blank fields
      xero_addr[:AddressLine1] = addr.line1 if addr.line1.present?
      xero_addr[:AddressLine2] = addr.line2 if addr.line2.present?
      xero_addr[:AddressLine3] = addr.line3 if addr.line3.present?
      xero_addr[:AddressLine4] = addr.line4 if addr.line4.present?
      xero_addr[:City] = addr.city if addr.city.present?
      xero_addr[:Region] = addr.region if addr.region.present?
      xero_addr[:PostalCode] = addr.postal_code if addr.postal_code.present?
      xero_addr[:Country] = addr.country if addr.country.present?

      addresses << xero_addr
    end

    addresses
  end

  def extract_xero_email(xero_contact)
    return xero_contact["EmailAddress"] if xero_contact["EmailAddress"].present?

    if xero_contact["Addresses"].present?
      xero_contact["Addresses"].each do |address|
        return address["EmailAddress"] if address["EmailAddress"].present?
      end
    end

    nil
  end

  def normalize_tax_number(tax_number)
    return nil if tax_number.blank?
    tax_number.to_s.gsub(/[\s\-]/, "").upcase
  end

  # Convert Xero payment terms to readable string
  # Xero Types: DAYSAFTERBILLDATE, DAYSAFTERBILLMONTH, OFCURRENTMONTH, OFFOLLOWINGMONTH
  def format_payment_terms(type, day)
    return nil if type.blank?

    case type
    when "DAYSAFTERBILLDATE"
      day.to_i == 0 ? "Due on receipt" : "Net #{day}"
    when "DAYSAFTERBILLMONTH"
      "#{day} days after EOM"
    when "OFCURRENTMONTH"
      "#{day}th of month"
    when "OFFOLLOWINGMONTH"
      day.to_i == 0 ? "EOM" : "EOM+#{day}"
    else
      "Net #{day || 30}"
    end
  end

  def parse_xero_date(date_string)
    return nil if date_string.blank?
    # Xero dates are in format /Date(1234567890000+0000)/
    if date_string.match?(/\/Date\((\d+)/)
      ms = date_string.match(/\/Date\((\d+)/)[1].to_i
      Time.at(ms / 1000)
    else
      Time.parse(date_string) rescue nil
    end
  end

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
    /\bco\.?\b/i,
    /\bcompany\b/i,
    /\bassociates?\b/i,
    /\benterprise[s]?\b/i,
    /\bsolutions?\b/i,
    /\bservices?\b/i,
    /\bsuperannuation\b/i,
    /\bsuper\s+fund\b/i,
    /\bfund\b/i,
    /\baccount\b/i
  ].freeze

  def xero_contact_is_company?(xero_contact)
    name = xero_contact["Name"].to_s
    first_name = xero_contact["FirstName"].to_s.strip

    return true if name.present? && first_name.blank?
    COMPANY_INDICATORS.any? { |pattern| name.match?(pattern) }
  end

  # Check if a person name matches or is too similar to the company name
  # This prevents creating duplicate person contacts when Xero has company name in FirstName field
  def person_name_matches_company?(person_name, company_name)
    return false if person_name.blank? || company_name.blank?

    person_normalized = person_name.downcase.gsub(/[^a-z0-9]/, "")
    company_normalized = company_name.downcase.gsub(/[^a-z0-9]/, "")

    # Exact match after normalization
    return true if person_normalized == company_normalized

    # Check if person name contains the company name or vice versa
    return true if person_normalized.include?(company_normalized) && company_normalized.length > 5
    return true if company_normalized.include?(person_normalized) && person_normalized.length > 5

    # Check if person name looks like a company name (has company indicators)
    COMPANY_INDICATORS.any? { |pattern| person_name.match?(pattern) }
  end

  def sync_contact_persons(teeem_contact, xero_contact)
    is_company = xero_contact_is_company?(xero_contact)
    main_first_name = xero_contact["FirstName"].to_s.strip
    main_last_name = xero_contact["LastName"].to_s.strip
    main_email = xero_contact["EmailAddress"].to_s.strip

    xero_persons = xero_contact["ContactPersons"] || []

    primary_person_contact = nil
    if is_company && main_first_name.present?
      # Skip creating person contact if the person name looks like the company name
      # This prevents duplicates when Xero has company name in the FirstName field
      person_full_name = "#{main_first_name} #{main_last_name}".strip
      company_name = teeem_contact.display_name.to_s.strip

      if person_name_matches_company?(person_full_name, company_name)
        Rails.logger.info("Skipping person contact creation for #{teeem_contact.display_name} - person name '#{person_full_name}' matches company name")
      else
        main_person = {
          "FirstName" => main_first_name,
          "LastName" => main_last_name,
          "EmailAddress" => main_email,
          "IncludeInEmails" => true
        }
        Rails.logger.info("Creating primary person contact #{main_first_name} #{main_last_name} for company #{teeem_contact.display_name}")
        primary_person_contact = create_or_update_contact_person_as_contact(teeem_contact, main_person, true)
      end

      # director_id column was removed - primary person is tracked via primary_company_id on the person contact
    end

    return if xero_persons.empty?

    Rails.logger.info("Syncing #{xero_persons.length} additional contact persons for #{teeem_contact.display_name}")

    existing_persons = teeem_contact.contact_persons.to_a

    xero_persons.each_with_index do |xero_person, index|
      first_name = xero_person["FirstName"]
      last_name = xero_person["LastName"]
      email = xero_person["EmailAddress"]
      include_in_emails = xero_person["IncludeInEmails"] != false

      if first_name.present?
        array_person_is_primary = (index == 0) && primary_person_contact.nil?
        create_or_update_contact_person_as_contact(teeem_contact, xero_person, array_person_is_primary)
      end

      existing = existing_persons.find do |ep|
        (email.present? && ep.email&.downcase == email&.downcase) ||
          (ep.first_name&.downcase == first_name&.downcase && ep.last_name&.downcase == last_name&.downcase)
      end

      legacy_is_primary = (index == 0) && main_first_name.blank?

      if existing
        existing.update!(
          first_name: first_name,
          last_name: last_name,
          email: email,
          include_in_emails: include_in_emails,
          is_primary: legacy_is_primary
        )
        @stats[:contact_persons_synced] += 1
      else
        teeem_contact.contact_persons.create!(
          first_name: first_name,
          last_name: last_name,
          email: email,
          include_in_emails: include_in_emails,
          is_primary: legacy_is_primary
        )
        @stats[:contact_persons_synced] += 1
      end
    end
  rescue StandardError => e
    Rails.logger.error("Error syncing contact persons for #{teeem_contact.display_name}: #{e.message}")
  end

  def create_or_update_contact_person_as_contact(company_contact, xero_person, is_primary = false)
    first_name = xero_person["FirstName"].to_s.strip
    last_name = xero_person["LastName"].to_s.strip
    email = xero_person["EmailAddress"].to_s.strip.downcase
    display_name = "#{first_name} #{last_name}".strip

    return if display_name.blank?

    person_contact = nil

    if email.present?
      person_contact = Contact.find_by("LOWER(email) = ?", email)
    end

    if person_contact.nil?
      person_contact = Contact.find_by(
        primary_company_id: company_contact.id,
        first_name: first_name,
        last_name: last_name
      )
    end

    if person_contact
      person_contact.update!(
        first_name: first_name,
        last_name: last_name,
        display_name: display_name,
        email: email.presence,
        primary_company_id: company_contact.id,
        entity_type: "person"
      )
      Rails.logger.info("Updated person contact: #{display_name} (linked to #{company_contact.display_name})")
    else
      person_contact = Contact.create!(
        first_name: first_name,
        last_name: last_name,
        display_name: display_name,
        email: email.presence,
        primary_company_id: company_contact.id,
        entity_type: "person",
        sync_with_xero: false
      )
      Rails.logger.info("Created person contact: #{display_name} (linked to #{company_contact.display_name})")
      @stats[:created_in_teeem] += 1
    end

    # director_id column was removed - primary person is tracked via primary_company_id on the person contact

    person_contact
  rescue StandardError => e
    Rails.logger.error("Error creating person contact for #{display_name}: #{e.message}")
    nil
  end

  def set_sync_timestamp(timestamp)
    @sync_timestamp = timestamp
  end

  def cleanup_deleted_xero_contacts_for_tenant(active_xero_ids, tenant_id)
    # Find links for this tenant that are no longer in Xero
    orphaned_links = ContactExternalLink.xero.where(tenant_id: tenant_id)
                                     .where.not(external_contact_id: active_xero_ids.to_a)

    count = orphaned_links.count
    return if count == 0

    Rails.logger.info("Found #{count} orphaned xero_links for tenant #{tenant_id}")

    # Mark all orphaned links as not_found (SSoT: track stale links instead of immediate deletion)
    orphaned_links.find_each do |link|
      begin
        contact = link.contact
        Rails.logger.info("Marking as stale: #{contact&.display_name} (xero_id: #{link.external_contact_id})")
        link.mark_stale!('not_found')
        link.update!(sync_error: "Contact no longer exists in Xero")
        @stats[:deleted_from_teeem] += 1
      rescue StandardError => e
        error_msg = "Failed to mark orphaned link #{link.id} as stale: #{e.message}"
        Rails.logger.error(error_msg)
        @stats[:errors] << error_msg
      end
    end

    # Note: Actual cleanup/deletion is handled by CleanupStaleXeroLinksJob
    # This allows links to be marked as stale without immediate deletion
  end

  # Legacy method for backwards compatibility
  def cleanup_deleted_xero_contacts(active_xero_ids)
    cleanup_deleted_xero_contacts_for_tenant(active_xero_ids, @tenant_id) if @tenant_id
  end

  # Sync addresses from Xero to contact_addresses table (two-way sync)
  # TEEEM is source of truth - only create/update if TEEEM doesn't have the address type
  def sync_addresses_from_xero(teeem_contact, xero_addresses)
    return unless xero_addresses.is_a?(Array)

    xero_addresses.each do |xero_addr|
      address_type = xero_addr["AddressType"]
      next unless address_type.present? && ContactAddress::ADDRESS_TYPES.include?(address_type)

      # Check if TEEEM already has this address type
      existing = teeem_contact.contact_addresses.find_by(address_type: address_type)

      if existing
        # TEEEM has this address - only update if TEEEM address is empty
        if existing.line1.blank? && existing.city.blank?
          existing.update!(
            line1: xero_addr["AddressLine1"],
            line2: xero_addr["AddressLine2"],
            line3: xero_addr["AddressLine3"],
            line4: xero_addr["AddressLine4"],
            city: xero_addr["City"],
            region: xero_addr["Region"],
            postal_code: xero_addr["PostalCode"],
            country: xero_addr["Country"]
          )
          Rails.logger.info("Updated empty #{address_type} address for contact #{teeem_contact.id} from Xero")
        end
      else
        # TEEEM doesn't have this address type - create it from Xero
        # Only create if Xero has actual address data
        if xero_addr["AddressLine1"].present? || xero_addr["City"].present?
          teeem_contact.contact_addresses.create!(
            address_type: address_type,
            line1: xero_addr["AddressLine1"],
            line2: xero_addr["AddressLine2"],
            line3: xero_addr["AddressLine3"],
            line4: xero_addr["AddressLine4"],
            city: xero_addr["City"],
            region: xero_addr["Region"],
            postal_code: xero_addr["PostalCode"],
            country: xero_addr["Country"]
          )
          Rails.logger.info("Created #{address_type} address for contact #{teeem_contact.id} from Xero")
        end
      end
    end
  rescue StandardError => e
    Rails.logger.error("Error syncing addresses for contact #{teeem_contact.id}: #{e.message}")
  end

  private

  def handle_sync_error(prefix, error, include_backtrace: false)
    error_msg = "#{prefix}: #{error.message}"
    Rails.logger.error("Xero sync failed: #{error_msg}")
    Rails.logger.error(error.backtrace.join("\n")) if include_backtrace
    @stats[:errors] << error_msg
    { success: false, error: error_msg, stats: @stats }
  end
end
