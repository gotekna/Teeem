# frozen_string_literal: true

# Service to import Xero tracking categories as Jobs
# Creates a Job for each tracking option under the "Job" tracking category
class XeroTrackingImportService
  TRACKING_CATEGORY_NAME = "Job"
  RATE_LIMIT_SLEEP = 100 # milliseconds between operations

  attr_reader :stats

  def initialize
    @client = XeroApiClient.new
    @stats = {
      created: 0,
      skipped: 0,
      linked: 0,
      errors: []
    }
  end

  # Import all tracking options as jobs
  def import_all
    Rails.logger.info("Starting Xero tracking category import")

    tracking_options = fetch_tracking_options
    Rails.logger.info("Found #{tracking_options.length} tracking options in Xero")

    tracking_options.each do |option|
      import_tracking_option(option)
      sleep(RATE_LIMIT_SLEEP / 1000.0)
    rescue StandardError => e
      error_msg = "Error importing tracking option '#{option['Name']}': #{e.message}"
      Rails.logger.error(error_msg)
      @stats[:errors] << error_msg
    end

    Rails.logger.info("Xero tracking import completed: #{@stats.inspect}")

    {
      success: true,
      stats: @stats,
      tracking_category: TRACKING_CATEGORY_NAME
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

  # Fetch all tracking options for the "Job" category
  def fetch_tracking_options
    result = @client.get("TrackingCategories")

    return [] unless result[:success]

    categories = result[:data]["TrackingCategories"] || []
    job_category = categories.find { |c| c["Name"] == TRACKING_CATEGORY_NAME }

    return [] unless job_category

    # Return only active options
    job_category["Options"]&.select { |o| o["Status"] == "ACTIVE" } || []
  end

  private

  def import_tracking_option(option)
    tracking_option_id = option["TrackingOptionID"]
    tracking_option_name = option["Name"]

    # Check if job already linked to this tracking option
    existing_linked = Job.find_by(xero_tracking_option_id: tracking_option_id)
    if existing_linked
      Rails.logger.debug("Skipping '#{tracking_option_name}' - already linked to job ##{existing_linked.id}")
      @stats[:skipped] += 1
      return
    end

    # Try to find existing job by fuzzy name match
    existing_job = find_job_by_name(tracking_option_name)

    if existing_job
      # Link existing job to this tracking option
      existing_job.update!(
        xero_tracking_option_id: tracking_option_id,
        xero_tracking_option_name: tracking_option_name
      )
      Rails.logger.info("Linked existing job ##{existing_job.id} '#{existing_job.title}' to tracking option '#{tracking_option_name}'")
      @stats[:linked] += 1
    else
      # Create new job
      job = Job.create!(
        title: tracking_option_name,
        status: "Active",
        xero_tracking_option_id: tracking_option_id,
        xero_tracking_option_name: tracking_option_name
        # site_supervisor_name is optional for Xero imports
      )
      Rails.logger.info("Created new job ##{job.id} '#{tracking_option_name}' from tracking option")
      @stats[:created] += 1
    end
  end

  # Find job by fuzzy name match
  def find_job_by_name(tracking_name)
    # First try exact match
    exact = Job.find_by("LOWER(title) = ?", tracking_name.downcase)
    return exact if exact

    # Try to find by significant words match
    # Extract significant words (3+ chars, not common words)
    common_words = %w[the and for lot street road drive court place avenue close circuit qld nsw vic sa wa nt act tas]
    search_words = tracking_name.downcase.scan(/\b\w{3,}\b/) - common_words

    return nil if search_words.empty?

    # Look for jobs that contain at least 2 of the significant words
    Job.where(xero_tracking_option_id: nil).find_each do |job|
      job_words = job.title.downcase.scan(/\b\w{3,}\b/) - common_words
      matching_words = (search_words & job_words).length

      if matching_words >= 2 || (search_words.length == 1 && matching_words == 1)
        return job
      end
    end

    nil
  end
end
