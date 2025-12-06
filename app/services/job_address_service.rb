# Service to extract addresses from job titles and geocode them using Mapbox
# Also standardizes job titles to a consistent format
class JobAddressService
  MAPBOX_BASE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places"
  BRISBANE_PROXIMITY = "153.0251,-27.4698" # Brisbane CBD coordinates for biasing results

  attr_reader :stats

  def initialize
    @stats = {
      jobs_processed: 0,
      geocoded: 0,
      already_geocoded: 0,
      skipped_no_address: 0,
      geocode_failed: 0,
      errors: []
    }
    @mapbox_token = ENV["MAPBOX_ACCESS_TOKEN"]
  end

  # Process all jobs
  def process_all_jobs(preview: false)
    Job.find_each do |job|
      process_job(job, preview: preview)
    end
    @stats
  end

  # Process a single job
  def process_job(job, preview: false)
    @stats[:jobs_processed] += 1

    # Skip if already has coordinates (unless forcing reprocess)
    if job.latitude.present? && job.longitude.present?
      @stats[:already_geocoded] += 1
      return { status: :already_geocoded, job: job }
    end

    # Parse the title
    parsed = parse_job_title(job.title)

    unless parsed[:address].present?
      @stats[:skipped_no_address] += 1
      return { status: :skipped, reason: "No address found in title", job: job }
    end

    # Geocode the address
    geocode_result = geocode_address(parsed[:address])

    unless geocode_result
      @stats[:geocode_failed] += 1
      return { status: :geocode_failed, job: job, parsed: parsed }
    end

    # Build standardized title
    new_title = build_standardized_title(parsed, geocode_result)

    result = {
      status: :success,
      job: job,
      original_title: job.title,
      new_title: new_title,
      location: geocode_result[:formatted_address],
      latitude: geocode_result[:latitude],
      longitude: geocode_result[:longitude],
      parsed: parsed,
      geocode: geocode_result
    }

    unless preview
      job.update!(
        title: new_title,
        location: geocode_result[:formatted_address],
        latitude: geocode_result[:latitude],
        longitude: geocode_result[:longitude]
      )
      @stats[:geocoded] += 1
    end

    result
  rescue StandardError => e
    error_msg = "Error processing job #{job.id}: #{e.message}"
    @stats[:errors] << error_msg
    Rails.logger.error error_msg
    { status: :error, job: job, error: e.message }
  end

  # Parse a job title to extract components
  # Patterns:
  #   "XC 15-16 Esther" -> prefix: XC, job_number: 15, house_number: 16, address: Esther
  #   "101-7 Wategos Street" -> prefix: nil, job_number: 101, house_number: 7, address: Wategos Street
  #   "XC KIT 06/25 - 89 - 464 Chelsea Road" -> prefix: XC KIT 06/25, job_number: 89, house_number: 464, address: Chelsea Road
  def parse_job_title(title)
    return { address: nil } if title.blank?

    # Skip titles that don't look like addresses
    skip_patterns = [
      /^KIT\s*-?\s*(Complete|LIVE)$/i,
      /^Kitchen\s+LIVE$/i
    ]
    return { address: nil } if skip_patterns.any? { |p| title.match?(p) }

    result = {
      original: title,
      prefix: nil,
      job_number: nil,
      house_number: nil,
      address: nil
    }

    # Pattern 1: "XC KIT 06/25 - 89 - 464 Chelsea Road" (complex prefix with multiple dashes)
    if title.match?(/^XC\s+KIT\s+\d+\/\d+/)
      match = title.match(/^(XC\s+KIT\s+\d+\/\d+)\s*-\s*(\d+)\s*-\s*(.+)$/)
      if match
        result[:prefix] = match[1].strip
        result[:job_number] = match[2]
        address_part = match[3].strip
        # Extract house number from start of address
        if address_part.match?(/^(\d+[a-zA-Z]?)\s+(.+)/)
          addr_match = address_part.match(/^(\d+[a-zA-Z]?)\s+(.+)/)
          result[:house_number] = addr_match[1]
          result[:address] = "#{addr_match[1]} #{addr_match[2]}"
        else
          result[:address] = address_part
        end
        return result
      end
    end

    # Pattern 2: "XC 15-16 Esther" (prefix number-house street)
    if title.match?(/^XC\s+\d+-/)
      match = title.match(/^(XC)\s+(\d+)-(\d+[a-zA-Z]?)\s+(.+)$/)
      if match
        result[:prefix] = match[1]
        result[:job_number] = match[2]
        result[:house_number] = match[3]
        result[:address] = "#{match[3]} #{match[4]}"
        return result
      end
    end

    # Pattern 3: "XC XX-NN Street" where XX is job number, NN is house number (e.g., "XC 7-6 Patrick King Drive")
    if title.match?(/^XC\s+\d+-\d+/)
      match = title.match(/^(XC)\s+(\d+)-(\d+[a-zA-Z]?)\s+(.+)$/)
      if match
        result[:prefix] = match[1]
        result[:job_number] = match[2]
        result[:house_number] = match[3]
        result[:address] = "#{match[3]} #{match[4]}"
        return result
      end
    end

    # Pattern 4: "100-KIT 146 Balmoral Road" (number-KIT house street)
    if title.match?(/^\d+-KIT\s+/)
      match = title.match(/^(\d+)-KIT\s+(\d+[a-zA-Z]?)\s+(.+)$/)
      if match
        result[:prefix] = "KIT"
        result[:job_number] = match[1]
        result[:house_number] = match[2]
        result[:address] = "#{match[2]} #{match[3]}"
        return result
      end
    end

    # Pattern 5: "101-7 Wategos Street" (job-house street - no prefix)
    if title.match?(/^\d+-\d+[a-zA-Z]?\s+\w/)
      match = title.match(/^(\d+)-(\d+[a-zA-Z]?)\s+(.+)$/)
      if match
        result[:job_number] = match[1]
        result[:house_number] = match[2]
        result[:address] = "#{match[2]} #{match[3]}"
        return result
      end
    end

    # Pattern 6: "50 - L513 Hickory" (job - lotNumber street)
    if title.match?(/^\d+\s+-\s+L?\d+/)
      match = title.match(/^(\d+)\s+-\s+(L?\d+[a-zA-Z]?)\s+(.+)$/)
      if match
        result[:job_number] = match[1]
        result[:house_number] = match[2]
        result[:address] = "#{match[2]} #{match[3]}"
        return result
      end
    end

    # Pattern 7: Generic - try to find a street address pattern anywhere
    # Look for number followed by street-like words
    street_match = title.match(/(\d+[a-zA-Z]?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Parade|Terrace|Close|Circuit|Crescent|Boulevard))?)/i)
    if street_match
      # Try to extract job number from beginning
      job_num_match = title.match(/^(?:XC\s+)?(?:KIT\s+)?(\d+)/)
      result[:job_number] = job_num_match[1] if job_num_match
      result[:house_number] = street_match[1]
      result[:address] = "#{street_match[1]} #{street_match[2]}"
      return result
    end

    # Couldn't parse
    result
  end

  # Geocode an address using Mapbox
  def geocode_address(address)
    return nil unless @mapbox_token.present?
    return nil unless address.present?

    # Add QLD Australia to improve accuracy
    search_query = "#{address}, QLD, Australia"

    params = {
      access_token: @mapbox_token,
      country: "au",
      limit: 1,
      types: "address,place",
      proximity: BRISBANE_PROXIMITY
    }

    url = "#{MAPBOX_BASE_URL}/#{URI.encode_www_form_component(search_query)}.json?#{params.to_query}"

    response = HTTParty.get(url, timeout: 10)

    return nil unless response.success?

    # Parse JSON response - HTTParty may not auto-parse depending on content-type header
    data = response.parsed_response
    data = JSON.parse(data) if data.is_a?(String)

    feature = data.dig("features", 0)

    return nil unless feature

    # Parse address components from context
    address_components = parse_mapbox_context(feature)

    {
      formatted_address: feature["place_name"],
      latitude: feature.dig("center", 1),
      longitude: feature.dig("center", 0),
      street: address_components[:street],
      suburb: address_components[:suburb],
      state: address_components[:state],
      postcode: address_components[:postcode],
      house_number: feature["address"]
    }
  rescue StandardError => e
    Rails.logger.error "Mapbox geocoding error: #{e.message}"
    nil
  end

  # Build standardized title
  # Format: "{PREFIX}-{JOB#} | {HOUSE#} {STREET}, {SUBURB} {STATE}"
  def build_standardized_title(parsed, geocode_result)
    parts = []

    # Build prefix part
    if parsed[:prefix].present? && parsed[:job_number].present?
      # Normalize prefix (remove spaces, use hyphen)
      prefix = parsed[:prefix].gsub(/\s+/, " ").strip
      parts << "#{prefix}-#{parsed[:job_number]}"
    elsif parsed[:job_number].present?
      parts << parsed[:job_number]
    end

    # Build address part from geocode result
    address_parts = []

    if geocode_result[:house_number].present?
      address_parts << geocode_result[:house_number]
    elsif parsed[:house_number].present?
      address_parts << parsed[:house_number]
    end

    if geocode_result[:street].present?
      address_parts << geocode_result[:street]
    end

    if geocode_result[:suburb].present?
      address_parts << geocode_result[:suburb]
    end

    if geocode_result[:state].present?
      address_parts << geocode_result[:state]
    end

    if address_parts.any?
      if parts.any?
        parts << " | "
        parts << address_parts.join(" ")
      else
        parts << address_parts.join(" ")
      end
    end

    parts.join
  end

  private

  # Parse Mapbox context array to extract address components
  def parse_mapbox_context(feature)
    result = {
      street: nil,
      suburb: nil,
      state: nil,
      postcode: nil
    }

    # Street name is in the main text
    result[:street] = feature["text"] if feature["text"].present?

    # Parse context for other components
    Array(feature["context"]).each do |ctx|
      type = ctx["id"].to_s.split(".").first

      case type
      when "postcode"
        result[:postcode] = ctx["text"]
      when "place", "locality"
        result[:suburb] ||= ctx["text"]
      when "region"
        # Convert full state name to abbreviation
        result[:state] = abbreviate_state(ctx["text"])
      end
    end

    result
  end

  def abbreviate_state(state_name)
    abbreviations = {
      "Queensland" => "QLD",
      "New South Wales" => "NSW",
      "Victoria" => "VIC",
      "South Australia" => "SA",
      "Western Australia" => "WA",
      "Tasmania" => "TAS",
      "Northern Territory" => "NT",
      "Australian Capital Territory" => "ACT"
    }
    abbreviations[state_name] || state_name
  end
end
