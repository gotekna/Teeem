# frozen_string_literal: true

# Service to sync jobs with Xero tracking categories
# Creates new tracking options in Xero when jobs are created
class XeroTrackingSyncService
  TRACKING_CATEGORY_NAME = "Job"

  def initialize
    @client = XeroApiClient.new
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

  private

  # Find the "Job" tracking category from Xero
  def find_job_tracking_category
    result = @client.get("TrackingCategories")
    return nil unless result[:success]

    categories = result[:data]["TrackingCategories"] || []
    categories.find { |c| c["Name"] == TRACKING_CATEGORY_NAME }
  end

  # Find an existing option by name (case-insensitive)
  def find_existing_option(tracking_category, option_name)
    options = tracking_category["Options"] || []
    options.find { |o| o["Name"].downcase == option_name.downcase && o["Status"] == "ACTIVE" }
  end

  # Build a tracking option name from the job
  # Uses the job code format (e.g., "J201") as the tracking option name
  def build_tracking_option_name(job)
    "J#{job.id}"
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
    Rails.logger.info("Creating '#{TRACKING_CATEGORY_NAME}' tracking category in Xero")

    result = @client.put(
      "TrackingCategories",
      { Name: TRACKING_CATEGORY_NAME }
    )

    unless result[:success]
      Rails.logger.error("Failed to create Job tracking category in Xero: #{result[:error]}")
      return nil
    end

    # Xero returns the created category - extract it
    # Response can be { "TrackingCategories": [...] } or just the category object
    data = result[:data]
    if data["TrackingCategories"]
      data["TrackingCategories"].find { |c| c["Name"] == TRACKING_CATEGORY_NAME }
    elsif data["Name"] == TRACKING_CATEGORY_NAME
      data
    else
      Rails.logger.error("Unexpected response when creating tracking category: #{data.inspect}")
      nil
    end
  end
end
