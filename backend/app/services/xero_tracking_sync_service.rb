# frozen_string_literal: true

# Service to sync jobs with Xero tracking categories
# Creates new tracking options in Xero when jobs are created
class XeroTrackingSyncService
  include XeroConstants

  def initialize
    @client = XeroApiClient.new
    @tracking_category_name = XeroConstants.tracking_category_name
  end

  # Create a tracking option in Xero for a job and link it
  # Returns { success: true/false, tracking_option_id: "...", tracking_option_name: "..." }
  def create_tracking_option_for_job(job)
    tracking_category = find_or_create_job_tracking_category
    return { success: false, error: "Could not find or create Job tracking category in Xero" } unless tracking_category

    tracking_category_id = tracking_category["TrackingCategoryID"]
    option_name = build_tracking_option_name(job)

    # Check if a tracking option with this name already exists
    existing_option = find_existing_option(tracking_category, option_name)
    if existing_option
      # Link to existing option
      job.update!(
        xero_tracking_option_id: existing_option["TrackingOptionID"],
        xero_tracking_option_name: existing_option["Name"]
      )
      Rails.logger.info("Linked job ##{job.id} to existing Xero tracking option: #{existing_option['Name']}")
      return {
        success: true,
        tracking_option_id: existing_option["TrackingOptionID"],
        tracking_option_name: existing_option["Name"],
        created: false
      }
    end

    # Create new tracking option in Xero
    result = @client.put(
      "TrackingCategories/#{tracking_category_id}/Options",
      { Name: option_name }
    )

    unless result[:success]
      Rails.logger.error("Failed to create Xero tracking option: #{result[:error]}")
      return { success: false, error: result[:error] || "Failed to create tracking option" }
    end

    # Extract the new tracking option from response
    options = result[:data]["Options"] || []
    new_option = options.find { |o| o["Name"] == option_name }

    unless new_option
      Rails.logger.error("Tracking option created but not found in response")
      return { success: false, error: "Tracking option created but not found in response" }
    end

    # Update job with the new tracking option
    job.update!(
      xero_tracking_option_id: new_option["TrackingOptionID"],
      xero_tracking_option_name: new_option["Name"]
    )

    Rails.logger.info("Created Xero tracking option for job ##{job.id}: #{new_option['Name']}")

    {
      success: true,
      tracking_option_id: new_option["TrackingOptionID"],
      tracking_option_name: new_option["Name"],
      created: true
    }
  rescue XeroApiClient::AuthenticationError => e
    Rails.logger.error("Xero auth error creating tracking option: #{e.message}")
    { success: false, error: "Xero authentication error: #{e.message}" }
  rescue StandardError => e
    Rails.logger.error("Error creating Xero tracking option: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    { success: false, error: e.message }
  end

  # Rename all existing tracking options in Xero to match new format
  # Updates both Xero and the local job record
  # dry_run: true = preview only (no Xero API calls), false = actually rename
  def rename_all_tracking_options(dry_run: true)
    jobs = Job.where.not(xero_tracking_option_id: nil)
    results = { updated: 0, skipped: 0, failed: 0, errors: [] }

    # Dry run: compare locally, no Xero API needed
    if dry_run
      jobs.find_each do |job|
        new_name = build_tracking_option_name(job)
        old_name = job.xero_tracking_option_name

        if old_name == new_name
          results[:skipped] += 1
        else
          puts "  #{old_name} → #{new_name}"
          results[:updated] += 1
        end
      end
      return results
    end

    # Real run: need tracking category from Xero
    tracking_category = find_job_tracking_category_with_retry
    unless tracking_category
      return { success: false, error: "Job tracking category not found in Xero" }
    end

    tracking_category_id = tracking_category["TrackingCategoryID"]

    jobs.find_each do |job|
      new_name = build_tracking_option_name(job)
      old_name = job.xero_tracking_option_name

      if old_name == new_name
        results[:skipped] += 1
        next
      end

      # Xero API: POST to rename a tracking option
      result = @client.post(
        "TrackingCategories/#{tracking_category_id}/Options/#{job.xero_tracking_option_id}",
        { Name: new_name }
      )

      if result[:success]
        job.update!(xero_tracking_option_name: new_name)
        puts "  ✅ #{old_name} → #{new_name}"
        results[:updated] += 1
      else
        puts "  ❌ #{old_name}: #{result[:error]}"
        results[:failed] += 1
        results[:errors] << { job_id: job.id, job_code: job.job_code, error: result[:error] }
      end

      sleep 1 # Rate limit: Xero allows ~60 calls/minute, be conservative
    end

    results
  rescue StandardError => e
    Rails.logger.error("Error renaming tracking options: #{e.message}")
    { success: false, error: e.message }
  end

  private

  # Find the "Job" tracking category from Xero
  def find_job_tracking_category
    result = @client.get("TrackingCategories")
    return nil unless result[:success]

    categories = result[:data]["TrackingCategories"] || []
    categories.find { |c| c["Name"] == @tracking_category_name }
  end

  # Find tracking category with retry on rate limit
  def find_job_tracking_category_with_retry(retries: 3)
    retries.times do |i|
      category = find_job_tracking_category
      return category if category

      # May have hit rate limit - wait and retry
      wait = (i + 1) * 10
      Rails.logger.info("Tracking category fetch failed, retrying in #{wait}s (attempt #{i + 1}/#{retries})")
      puts "  ⏳ Xero API rate limited, waiting #{wait}s..."
      sleep wait
    end
    nil
  end

  # Find an existing option by name (case-insensitive)
  def find_existing_option(tracking_category, option_name)
    options = tracking_category["Options"] || []
    options.find { |o| o["Name"].downcase == option_name.downcase && o["Status"] == "ACTIVE" }
  end

  # Build a tracking option name from the job
  # Prefix based on job type: K=Kitchen, H=House, D=Duplex, etc.
  # Format: "K201 - Lot 5 (17) Redruth Rd Alexandra Hills"
  # or:     "H201 - 17 Redruth Rd Alexandra Hills" (no lot)
  # Truncated to 100 chars (Xero tracking option name limit)
  def build_tracking_option_name(job)
    code = job_code_with_type_prefix(job)
    parts = [code]

    address = []
    has_lot = job.lot_number.present?
    has_street_num = job.street_number.present? && job.street_number.to_s.strip != "0"

    if has_lot
      street_display = has_street_num ? job.street_number : "-"
      address << "Lot #{job.lot_number} (#{street_display})"
    elsif has_street_num
      address << job.street_number.to_s
    end

    address << job.street_name if job.street_name.present?
    address << job.street_type if job.street_type.present?
    address << job.suburb if job.suburb.present?

    parts << address.join(" ") if address.any?

    parts.join(" - ").truncate(100)
  end

  # Replace the "J" prefix in job_code with a type-based prefix
  # K=Kitchen, H=House, D=Duplex, T=Townhouse, etc.
  JOB_TYPE_PREFIXES = {
    "Kitchen"          => "K",
    "House"            => "H",
    "Duplex"           => "D",
    "Townhouse"        => "T",
    "Micro Apartment"  => "MA",
    "Co Living"        => "CL",
    "NDIS House"       => "NH",
    "NDIS Units"       => "NU",
    "NDIS Renovation"  => "NR",
    "House Renovation" => "HR",
    "Unit Renovation"  => "UR",
    "Office Fitout"    => "OF",
  }.freeze

  def job_code_with_type_prefix(job)
    type_name = job.job_type&.name
    prefix = JOB_TYPE_PREFIXES[type_name] || "J"
    # Replace leading "J" in job_code (e.g., "J201" → "K201")
    job.job_code&.sub(/\AJ/, prefix) || "J?"
  end

  # Find or create the "Job" tracking category in Xero
  def find_or_create_job_tracking_category
    category = find_job_tracking_category
    return category if category

    # Create the "Job" tracking category in Xero
    create_job_tracking_category
  end

  # Create the "Job" tracking category in Xero
  def create_job_tracking_category
    Rails.logger.info("Creating '#{@tracking_category_name}' tracking category in Xero")

    result = @client.put(
      "TrackingCategories",
      { Name: @tracking_category_name }
    )

    unless result[:success]
      Rails.logger.error("Failed to create Job tracking category in Xero: #{result[:error]}")
      return nil
    end

    # Xero returns the created category - extract it
    # Response can be { "TrackingCategories": [...] } or just the category object
    data = result[:data]
    if data["TrackingCategories"]
      data["TrackingCategories"].find { |c| c["Name"] == @tracking_category_name }
    elsif data["Name"] == @tracking_category_name
      data
    else
      Rails.logger.error("Unexpected response when creating tracking category: #{data.inspect}")
      nil
    end
  end
end
