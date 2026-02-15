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
    if parsed[:parsed]
      attrs[:street_number] = parsed[:street_number]
      attrs[:street_name] = parsed[:street_name]
      attrs[:street_type] = parsed[:street_type]
      attrs[:suburb] = parsed[:suburb]
      # name will be auto-generated from address components by Job model callback
    else
      # Use raw tracking option name as the job name
      attrs[:name] = parsed[:title].presence || tracking_option_name
    end

    # Use parsed code as job_code if available
    if parsed[:code].present?
      # Check uniqueness
      unless Job.exists?(job_code: parsed[:code])
        attrs[:job_code] = parsed[:code]
      end
    end

    job = Job.create!(attrs)

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
  def find_client_for_tracking_options(options)
    option_names = options.map { |o| o["Name"] }

    # Look for sales invoices with matching tracking data
    invoices = ExternalInvoice.where(invoice_type: "sales_invoice")
                              .where.not(contact_name: nil)

    # Check tracking_data JSONB for matching option names
    client_name = nil
    option_names.each do |opt_name|
      matching = invoices.where("tracking_data::text ILIKE ?", "%#{opt_name.gsub("'", "''")}%").first
      if matching
        client_name = matching.contact_name
        break
      end
    end

    return nil unless client_name

    # Analyze if this is a couple
    couple_analysis = XeroContactCoupleSplitter.analyze(client_name)

    {
      name: client_name,
      is_couple: couple_analysis[:is_couple],
      person1: couple_analysis[:is_couple] ? couple_analysis[:person1] : nil,
      person2: couple_analysis[:is_couple] ? couple_analysis[:person2] : nil
    }
  end

  # Link client contact(s) to a job from sales invoices
  def link_client_to_job(job, options)
    client_info = find_client_for_tracking_options(options)
    return unless client_info

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
      # Find or create single client contact
      contact = Contact.find_by("LOWER(display_name) = ?", client_info[:name].downcase)

      if contact
        JobContact.find_or_create_by!(job: job, contact: contact) do |jc|
          jc.role = "client"
        end
        @stats[:clients_linked] += 1
        Rails.logger.info("Linked client '#{contact.display_name}' to job ##{job.id}")
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
