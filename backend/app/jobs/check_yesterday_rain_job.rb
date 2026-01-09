class CheckYesterdayRainJob < ApplicationJob
  queue_as :default

  # Check yesterday's weather for all active jobs
  # Auto-creates rain log entries if rainfall detected
  def perform(job_id: nil, date: nil)
    target_date = date || Date.yesterday

    # If specific job_id provided, only check that job
    if job_id
      job = Job.find(job_id)
      return check_rain_for_job(job, target_date)
    end

    # Otherwise check all active jobs
    weather_client = WeatherApiClient.new

    Rails.logger.info("Checking rain for all active jobs (#{target_date})")

    active_jobs_checked = 0
    rain_logs_created = 0
    errors = []

    Job.where(status: "Active").find_each do |job|
      active_jobs_checked += 1

      # Get location from job
      location = extract_location(job)

      unless location
        Rails.logger.warn("No location found for job #{job.id} - #{job.title}")
        errors << { job_id: job.id, error: "No location" }
        next
      end

      begin
        # Fetch weather data
        weather_data = weather_client.fetch_historical(location, target_date)

        # Skip if no rainfall
        rainfall_mm = weather_data[:rainfall_mm]
        next if rainfall_mm.nil? || rainfall_mm.zero?

        # Check if log already exists for this date
        existing_log = job.rain_logs.find_by(date: target_date)
        if existing_log
          Rails.logger.info("Rain log already exists for #{job.title} on #{target_date}")
          next
        end

        # Create rain log entry
        rain_log = job.rain_logs.create!(
          date: target_date,
          rainfall_mm: rainfall_mm,
          severity: RainLog.calculate_severity(rainfall_mm),
          source: "automatic",
          weather_api_response: weather_data[:raw_response],
          notes: "Auto-detected: #{weather_data[:condition]} at #{weather_data[:location]}"
        )

        rain_logs_created += 1
        Rails.logger.info("Created rain log for #{job.title}: #{rainfall_mm}mm on #{target_date}")

      rescue WeatherApiClient::Error => e
        Rails.logger.error("Weather API error for #{job.title}: #{e.message}")
        errors << { job_id: job.id, error: e.message }
      rescue StandardError => e
        Rails.logger.error("Failed to create rain log for #{job.title}: #{e.message}")
        errors << { job_id: job.id, error: e.message }
      end
    end

    # Log summary
    Rails.logger.info(
      "Rain check complete: #{active_jobs_checked} jobs checked, " \
      "#{rain_logs_created} rain logs created, #{errors.count} errors"
    )

    # Return summary
    {
      date: target_date,
      active_jobs_checked: active_jobs_checked,
      rain_logs_created: rain_logs_created,
      errors: errors
    }
  end

  # Check rain for a single job - can be called from API
  def check_rain_for_job(job, target_date = Date.yesterday)
    weather_client = WeatherApiClient.new
    location = extract_location(job)

    raise ArgumentError, "No location found for job #{job.id}" unless location

    weather_data = weather_client.fetch_historical(location, target_date)

    {
      job_id: job.id,
      date: target_date,
      location: location,
      weather_data: weather_data,
      rainfall_mm: weather_data[:rainfall_mm],
      condition: weather_data[:condition]
    }
  end

  private

  # Extract location from job record
  # Priority: location field, lat/lng coordinates, then parse from title
  def extract_location(job)
    # First check if job has a location field
    return job.location if job.location.present?

    # Try lat/lng coordinates
    if job.latitude.present? && job.longitude.present?
      return "#{job.latitude},#{job.longitude}"
    end

    # Fallback: try to extract from job title
    # (e.g., "XC KIT 06/25 72 - 32 Mcilwraith" => try address part)
    if job.title.include?("-")
      potential_location = job.title.split("-").last.strip
      return potential_location if potential_location.present?
    end

    nil
  end
end
