# frozen_string_literal: true

# Service to import Xero tracking categories as Jobs
#
# Enhanced features:
# - Configurable tracking category name (SSoT: TenantSetting.xero_tracking_category_name)
# - Address parsing from tracking option names (e.g., "106HAR 106 Harold Street, Holland Park")
# - Variant grouping: "P-106HAR" and "106HAR" both map to the same job
# - Client detection from sales invoices with matching tracking
# - Couple splitting: "Madeleine Childs & Nicholas Childs" → two person contacts
#
class XeroTrackingImportService
  include XeroConstants

  attr_reader :stats

  def initialize(teeem_tenant: nil)
    @client = XeroApiClient.new(teeem_tenant: teeem_tenant || ActsAsTenant.current_tenant)
    @tracking_category_name = XeroConstants.tracking_category_name
    @stats = {
      created: 0,
      skipped: 0,
      linked: 0,
      contacts_split: 0,
      clients_linked: 0,
      errors: []
    }
  end

  # Import all tracking options as jobs
  def import_all
    Rails.logger.info("Starting Xero tracking category import (category: '#{@tracking_category_name}')")

    tracking_options = fetch_tracking_options
    Rails.logger.info("Found #{tracking_options.length} tracking options in Xero")

    # Pre-fetch client map from Xero sales invoices (one batch, reused for all jobs)
    prefetch_client_map

    # Group by base job code to handle variants (e.g., "106HAR" + "P-106HAR" → one job)
    grouped = XeroTrackingAddressParser.group_by_job(tracking_options)
    Rails.logger.info("Grouped into #{grouped.length} unique jobs (#{tracking_options.length} tracking options)")

    grouped.each do |_code, options|
      import_job_group(options)
    rescue StandardError => e
      names = options.map { |o| o["Name"] }.join(", ")
      error_msg = "Error importing tracking options '#{names}': #{e.message}"
      Rails.logger.error(error_msg)
      @stats[:errors] << error_msg
    end

    Rails.logger.info("Xero tracking import completed: #{@stats.inspect}")

    {
      success: true,
      stats: @stats,
      tracking_category: @tracking_category_name
    }
  rescue XeroApiClient::AuthenticationError => e
    error_msg = "Authentication error: #{e.message}"
    Rails.logger.error("Xero tracking import failed: #{error_msg}")
    { success: false, error: error_msg, stats: @stats }
  rescue StandardError => e
    error_msg = "Import failed: #{e.message}"
    Rails.logger.error("Xero tracking import failed: #{error_msg}")
    Rails.logger.error(e.backtrace.join("\n"))
    { success: false, error: error_msg, stats: @stats }
  end

  # Import specific tracking option IDs (called from controller for selective import)
  def import_selected(option_ids)
    Rails.logger.info("Starting selective Xero tracking import for #{option_ids.length} options")

    tracking_options = fetch_tracking_options
    selected = tracking_options.select { |o| option_ids.include?(o["TrackingOptionID"]) }

    Rails.logger.info("Found #{selected.length} matching tracking options")

    prefetch_client_map

    grouped = XeroTrackingAddressParser.group_by_job(selected)

    grouped.each do |_code, options|
      import_job_group(options)
    rescue StandardError => e
      names = options.map { |o| o["Name"] }.join(", ")
      error_msg = "Error importing '#{names}': #{e.message}"
      Rails.logger.error(error_msg)
      @stats[:errors] << error_msg
    end

    {
      success: true,
      stats: @stats,
      tracking_category: @tracking_category_name
    }
  end

  # Preview what would be imported (no database changes)
  def preview
    tracking_options = fetch_tracking_options
    grouped = XeroTrackingAddressParser.group_by_job(tracking_options)

    preview_items = grouped.map do |code, options|
      # P (Production) is SSoT when present; otherwise non-variant
      primary_option = XeroTrackingAddressParser.primary_option(options)
      parsed = primary_option["_parsed"]

      # Check if job already exists
      existing_job = find_existing_job_for_group(options)

      # Find client from sales invoices
      client_info = find_client_for_tracking_options(options)

      {
        code: code,
        tracking_options: options.map { |o|
          {
            id: o["TrackingOptionID"],
            name: o["Name"],
            variant: o["_parsed"][:variant],
            status: o["Status"]
          }
        },
        parsed: {
          job_code: parsed[:code],
          lot_number: parsed[:lot_number],
          street_number: parsed[:street_number],
          street_name: parsed[:street_name],
          street_type: parsed[:street_type],
          suburb: parsed[:suburb],
          title: parsed[:title]
        },
        client: client_info,
        existing_job: existing_job ? { id: existing_job.id, name: existing_job.name, job_code: existing_job.job_code } : nil,
        status: existing_job ? "exists" : "new"
      }
    end

    {
      success: true,
      tracking_category: @tracking_category_name,
      total_options: tracking_options.length,
      total_jobs: grouped.length,
      items: preview_items
    }
  end

  # Re-parse existing jobs that have tracking options but failed address parsing
  # AND link clients from Xero sales invoices for ALL Xero-linked jobs
  def reparse_existing_jobs
    Rails.logger.info("Re-parsing existing Xero-linked jobs with improved parser")

    # Pre-fetch client map for client linking
    prefetch_client_map

    # ALL jobs with tracking links
    all_linked_jobs = Job.joins(:xero_tracking_links).distinct

    fixed = 0
    clients_linked = 0
    all_linked_jobs.find_each do |job|
      primary_link = job.xero_tracking_links.find_by(is_primary: true) || job.xero_tracking_links.first
      next unless primary_link

      # Re-parse address if missing
      if job.street_name.blank?
        parsed = XeroTrackingAddressParser.parse(primary_link.tracking_option_name)
        if parsed[:parsed] && parsed[:street_name].present? && parsed[:suburb].present?
          attrs = {
            street_number: parsed[:street_number],
            street_name: parsed[:street_name],
            street_type: parsed[:street_type],
            suburb: parsed[:suburb],
            state: "QLD"
          }
          attrs[:lot_number] = parsed[:lot_number] if parsed[:lot_number].present?

          # Use job_code from parsed if current is temporary
          if parsed[:code].present? && (job.job_code&.start_with?("XERO-") || job.job_code&.start_with?("J"))
            attrs[:job_code] = parsed[:code] unless Job.where.not(id: job.id).exists?(job_code: parsed[:code])
          end

          job.update!(attrs)
          fixed += 1
          Rails.logger.info("Re-parsed job ##{job.id}: '#{job.name}'")
        end
      end

      # Link client if not already linked (for ALL jobs, not just re-parsed ones)
      if job.job_contacts.where(role: "client").none?
        tracking_options = job.xero_tracking_links.map do |link|
          { "TrackingOptionID" => link.tracking_option_id, "Name" => link.tracking_option_name,
            "_parsed" => XeroTrackingAddressParser.parse(link.tracking_option_name) }
        end
        link_client_to_job(job, tracking_options)
        clients_linked += 1 if job.job_contacts.where(role: "client").any?
      end
    rescue StandardError => e
      Rails.logger.error("Error processing job ##{job.id}: #{e.message}")
      @stats[:errors] << "Error processing job ##{job.id}: #{e.message}"
    end

    Rails.logger.info("Re-parse complete: #{fixed} addresses fixed, #{clients_linked} clients linked (#{all_linked_jobs.count} total jobs)")
    { success: true, fixed: fixed, clients_linked: clients_linked, total_jobs: all_linked_jobs.count, stats: @stats }
  end

  # Fetch all tracking options for the configured category
  def fetch_tracking_options
    result = @client.get("TrackingCategories")

    return [] unless result[:success]

    categories = result[:data]["TrackingCategories"] || []

    # Find matching category (case-insensitive)
    job_category = categories.find { |c| c["Name"].downcase == @tracking_category_name.downcase }

    return [] unless job_category

    # Return only active options
    job_category["Options"]&.select { |o| o["Status"] == "ACTIVE" } || []
  end

  private

  # Import a group of tracking options that all map to the same job
  # e.g., ["106HAR 106 Harold Street, Holland Park", "P-106HAR 106 Harold St, Holland Park"]
  def import_job_group(options)
    # P (Production) is SSoT when present; otherwise non-variant
    primary_option = XeroTrackingAddressParser.primary_option(options)
    parsed = primary_option["_parsed"]

    # Check if ANY option in the group is already linked via join table or legacy column
    options.each do |option|
      existing = XeroJobTrackingLink.job_for(option["TrackingOptionID"]) ||
                 Job.find_by(xero_tracking_option_id: option["TrackingOptionID"])
      if existing
        # Ensure ALL options in the group have link rows
        create_tracking_links(existing, options)
        Rails.logger.debug("Skipping group '#{parsed[:code]}' - already linked to job ##{existing.id}")
        @stats[:skipped] += 1
        return
      end
    end

    # Try to find existing job by code or fuzzy name match
    existing_job = find_existing_job_for_group(options)

    job = if existing_job
      # Link all tracking options to existing job
      create_tracking_links(existing_job, options)
      Rails.logger.info("Linked existing job ##{existing_job.id} '#{existing_job.name}' to #{options.length} tracking option(s)")
      @stats[:linked] += 1
      existing_job
    else
      # Create new job with parsed address fields
      create_job_from_parsed(parsed, options)
    end

    # Find and link client contact from sales invoices
    link_client_to_job(job, options) if job
  end

  def create_job_from_parsed(parsed, options)
    primary_option = XeroTrackingAddressParser.primary_option(options)
    tracking_option_id = primary_option["TrackingOptionID"]
    tracking_option_name = primary_option["Name"]

    # Find or use default job status
    active_status = JobStatus.find_by(name: "Active Job") || JobStatus.first

    attrs = {
      xero_tracking_option_id: tracking_option_id,
      xero_tracking_option_name: tracking_option_name,
      job_status: active_status
    }

    # Set address fields if parsed successfully
    # FRC (Feb 2026): Only set address components if we have enough data for Job validation.
    # Job validates suburb + state when street_name is present (has_address_components?).
    # Parser doesn't extract state from Xero tracking names, so default to QLD.
    if parsed[:parsed] && parsed[:street_name].present? && parsed[:suburb].present?
      attrs[:street_number] = parsed[:street_number]
      attrs[:street_name] = parsed[:street_name]
      attrs[:street_type] = parsed[:street_type]
      attrs[:suburb] = parsed[:suburb]
      attrs[:lot_number] = parsed[:lot_number] if parsed[:lot_number].present?
      attrs[:state] = "QLD"  # Default: all Pilgrim/Tekna jobs are in Queensland
      # name will be auto-generated from address components by Job model callback
    else
      # Not enough address data for validation - use raw name instead
      attrs[:name] = parsed[:title].presence || tracking_option_name
    end

    # Use parsed code as job_code if available
    # FRC (Feb 2026): job_code has a DB-level NOT NULL constraint.
    # If parsed code already exists, generate a unique variation instead of leaving nil.
    if parsed[:code].present?
      if Job.exists?(job_code: parsed[:code])
        # Code exists - append suffix to make unique
        attrs[:job_code] = "#{parsed[:code]}-X"
        # If that also exists, keep trying
        suffix = 2
        while Job.exists?(job_code: attrs[:job_code])
          attrs[:job_code] = "#{parsed[:code]}-X#{suffix}"
          suffix += 1
        end
      else
        attrs[:job_code] = parsed[:code]
      end
    end
    # If no code parsed, after_create callback generates "J#{id}" via generate_job_code_if_blank
    # But job_code is NOT NULL at DB level, so we need a temporary value for the INSERT
    attrs[:job_code] ||= "XERO-#{SecureRandom.hex(4).upcase}"

    job = Job.create!(attrs)

    # Replace temporary job_code with standard format if it was auto-generated
    if attrs[:job_code]&.start_with?("XERO-")
      job.update_column(:job_code, "J#{job.id}")
    end

    # Create tracking link rows for ALL options in the group
    create_tracking_links(job, options)

    Rails.logger.info("Created new job ##{job.id} '#{job.name}' (code: #{job.job_code}) from tracking option '#{tracking_option_name}'")
    @stats[:created] += 1

    job
  end

  # Create XeroJobTrackingLink rows for all tracking options in a group
  # Also maintains backward-compat: writes primary option to job columns
  def create_tracking_links(job, options)
    primary = XeroTrackingAddressParser.primary_option(options)

    options.each do |option|
      tracking_option_id = option["TrackingOptionID"]
      is_primary = (option == primary)
      parsed = option["_parsed"] || {}

      # Find or create the link row (idempotent)
      link = XeroJobTrackingLink.find_or_initialize_by(tracking_option_id: tracking_option_id)
      link.assign_attributes(
        job: job,
        tracking_option_name: option["Name"],
        variant: parsed[:variant],
        is_primary: is_primary,
        tenant_id: job.tenant_id
      )
      link.save!
    end

    # Backward compat: ensure job columns reflect primary option
    if primary && job.xero_tracking_option_id != primary["TrackingOptionID"]
      job.update_columns(
        xero_tracking_option_id: primary["TrackingOptionID"],
        xero_tracking_option_name: primary["Name"]
      )
    end
  end

  # Pre-fetch client map from Xero sales invoices
  # Builds: { tracking_option_id => { contact_name:, xero_contact_id: } }
  def prefetch_client_map
    @xero_client_map = {}

    # Get tracking category ID
    tracking_category_id = fetch_tracking_category_id
    unless tracking_category_id
      Rails.logger.info("No tracking category found - skipping client map prefetch")
      return
    end

    Rails.logger.info("Fetching Xero sales invoices for client detection...")

    # Fetch ACCREC (sales invoices) - paginated
    all_invoices = []
    page = 1

    loop do
      result = @client.get("Invoices", { where: 'Type=="ACCREC"', page: page })
      break unless result[:success]

      invoices = result[:data]["Invoices"] || []
      break if invoices.empty?

      all_invoices.concat(invoices)
      page += 1
      break if invoices.length < 100

      sleep(XERO_PAGE_SLEEP_SEC)
    end

    Rails.logger.info("Found #{all_invoices.length} sales invoices, fetching tracking details...")

    # Fetch details for each invoice to get line item tracking
    all_invoices.each_with_index do |invoice, index|
      Rails.logger.info("Fetching invoice #{index + 1}/#{all_invoices.length}...") if (index + 1) % 50 == 0

      detail_result = @client.get("Invoices/#{invoice['InvoiceID']}")
      sleep(XERO_DETAIL_FETCH_SLEEP_SEC)

      next unless detail_result[:success]

      detail = (detail_result[:data]["Invoices"] || []).first
      next unless detail

      contact_name = detail.dig("Contact", "Name")
      xero_contact_id = detail.dig("Contact", "ContactID")
      next unless contact_name

      # Check line items for tracking options
      (detail["LineItems"] || []).each do |line|
        (line["Tracking"] || []).each do |tracking|
          next unless tracking["TrackingCategoryID"] == tracking_category_id

          option_id = tracking["TrackingOptionID"]
          # First client found wins (most invoices for a job go to the same client)
          @xero_client_map[option_id] ||= {
            contact_name: contact_name,
            xero_contact_id: xero_contact_id
          }
        end
      end
    end

    Rails.logger.info("Client map built: #{@xero_client_map.length} tracking options → clients")
  rescue StandardError => e
    Rails.logger.error("Failed to prefetch client map: #{e.message}")
    @xero_client_map = {}
  end

  # Get tracking category UUID from Xero
  def fetch_tracking_category_id
    result = @client.get("TrackingCategories")
    return nil unless result[:success]

    categories = result[:data]["TrackingCategories"] || []
    job_category = categories.find { |c| c["Name"].downcase == @tracking_category_name.downcase }
    job_category&.dig("TrackingCategoryID")
  end

  # Find existing job for a group of tracking options
  def find_existing_job_for_group(options)
    # First check join table by tracking option ID
    options.each do |option|
      job = XeroJobTrackingLink.job_for(option["TrackingOptionID"])
      return job if job
    end

    # Then check legacy column by tracking option ID
    options.each do |option|
      job = Job.find_by(xero_tracking_option_id: option["TrackingOptionID"])
      return job if job
    end

    # Then try by job code
    options.each do |option|
      parsed = option["_parsed"] || XeroTrackingAddressParser.parse(option["Name"])
      if parsed[:code].present?
        job = Job.find_by(job_code: parsed[:code])
        return job if job
      end
    end

    # Then try fuzzy name match using the Production (SSoT) option
    primary = XeroTrackingAddressParser.primary_option(options)
    find_job_by_name(primary["Name"])
  end

  # Find client contact from sales invoices that reference these tracking options
  # Checks local ExternalInvoice table first, then falls back to pre-fetched Xero data
  def find_client_for_tracking_options(options)
    client_name = nil
    xero_contact_id = nil

    # Strategy 1: Check local ExternalInvoice table
    option_names = options.map { |o| o["Name"] }
    invoices = ExternalInvoice.where(invoice_type: "sales_invoice")
                              .where.not(contact_name: nil)

    option_names.each do |opt_name|
      matching = invoices.where("tracking_data::text ILIKE ?", "%#{opt_name.gsub("'", "''")}%").first
      if matching
        client_name = matching.contact_name
        break
      end
    end

    # Strategy 2: Use pre-fetched Xero client map (from sales invoices API)
    if client_name.nil? && @xero_client_map.present?
      options.each do |option|
        entry = @xero_client_map[option["TrackingOptionID"]]
        if entry
          client_name = entry[:contact_name]
          xero_contact_id = entry[:xero_contact_id]
          break
        end
      end
    end

    return nil unless client_name

    # Analyze if this is a couple
    couple_analysis = XeroContactCoupleSplitter.analyze(client_name)

    {
      name: client_name,
      xero_contact_id: xero_contact_id,
      is_couple: couple_analysis[:is_couple],
      person1: couple_analysis[:is_couple] ? couple_analysis[:person1] : nil,
      person2: couple_analysis[:is_couple] ? couple_analysis[:person2] : nil
    }
  end

  # Link client contact(s) to a job from sales invoices
  def link_client_to_job(job, options)
    client_info = find_client_for_tracking_options(options)
    unless client_info
      Rails.logger.debug("No client found in sales invoices for job ##{job.id} '#{job.name}'")
      return
    end

    if client_info[:is_couple]
      # Split couple and link both as clients
      analysis = XeroContactCoupleSplitter.analyze(client_info[:name])
      contacts = XeroContactCoupleSplitter.create_contacts_from_couple(analysis)

      contacts.each do |contact|
        JobContact.find_or_create_by!(job: job, contact: contact) do |jc|
          jc.role = "client"
        end
        @stats[:clients_linked] += 1
      end

      @stats[:contacts_split] += 1 if contacts.length == 2
      Rails.logger.info("Split couple '#{client_info[:name]}' into #{contacts.length} contacts for job ##{job.id}")
    else
      # Find existing client contact:
      # 1. By Xero contact ID (ContactExternalLink - SSoT for Xero contacts)
      # 2. By display_name or company_name
      contact = nil

      if client_info[:xero_contact_id].present?
        link = ContactExternalLink.xero.find_by(external_contact_id: client_info[:xero_contact_id])
        contact = link&.contact
      end

      contact ||= Contact.find_by("LOWER(display_name) = ?", client_info[:name].downcase)
      contact ||= Contact.find_by("LOWER(company_name) = ?", client_info[:name].downcase)

      if contact
        JobContact.find_or_create_by!(job: job, contact: contact) do |jc|
          jc.role = "client"
        end
        @stats[:clients_linked] += 1
        Rails.logger.info("Linked client '#{contact.display_name}' to job ##{job.id}")
      else
        Rails.logger.info("Client '#{client_info[:name]}' found in sales invoices but no matching Contact record for job ##{job.id}")
      end
    end
  end

  # Find job by fuzzy name match
  def find_job_by_name(tracking_name)
    # First try exact match
    exact = Job.find_by("LOWER(name) = ?", tracking_name.downcase)
    return exact if exact

    # Try to find by significant words match
    common_words = %w[the and for lot street road drive court place avenue close circuit qld nsw vic sa wa nt act tas]
    search_words = tracking_name.downcase.scan(/\b\w{3,}\b/) - common_words

    return nil if search_words.empty?

    # Look for jobs that contain at least 2 of the significant words
    Job.where(xero_tracking_option_id: nil).find_each do |job|
      job_words = job.name.to_s.downcase.scan(/\b\w{3,}\b/) - common_words
      matching_words = (search_words & job_words).length

      if matching_words >= 2 || (search_words.length == 1 && matching_words == 1)
        return job
      end
    end

    nil
  end
end
