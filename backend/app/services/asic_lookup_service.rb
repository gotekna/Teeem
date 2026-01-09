require "net/http"
require "json"

class AsicLookupService
  # ABN Lookup API (Free) - https://abr.business.gov.au/
  ABR_API_URL = "https://abr.business.gov.au/json"

  # GUID is required for ABR API access - obtain from https://abr.business.gov.au/Tools/WebServices
  # Store in environment variable
  def initialize
    @guid = ENV["ABR_GUID"] || Rails.application.credentials.dig(:abr, :guid)
  end

  # Look up a company by ABN
  def lookup_by_abn(abn)
    return { success: false, error: "ABN is required" } if abn.blank?

    # Clean ABN - remove spaces and non-digits
    clean_abn = abn.to_s.gsub(/\D/, "")

    return { success: false, error: "ABN must be 11 digits" } unless clean_abn.length == 11

    begin
      url = URI("#{ABR_API_URL}/AbnDetails.aspx?abn=#{clean_abn}&callback=callback&guid=#{@guid}")
      response = Net::HTTP.get(url)

      # The API returns JSONP, so we need to extract the JSON
      json_str = response.gsub(/^callback\(/, "").gsub(/\)$/, "")
      data = JSON.parse(json_str)

      if data["Message"].present?
        return { success: false, error: data["Message"] }
      end

      parse_abn_response(data)
    rescue JSON::ParserError => e
      { success: false, error: "Failed to parse response: #{e.message}" }
    rescue StandardError => e
      { success: false, error: "Lookup failed: #{e.message}" }
    end
  end

  # Look up a company by ACN
  def lookup_by_acn(acn)
    return { success: false, error: "ACN is required" } if acn.blank?

    # Clean ACN - remove spaces and non-digits
    clean_acn = acn.to_s.gsub(/\D/, "")

    return { success: false, error: "ACN must be 9 digits" } unless clean_acn.length == 9

    begin
      url = URI("#{ABR_API_URL}/AcnDetails.aspx?acn=#{clean_acn}&callback=callback&guid=#{@guid}")
      response = Net::HTTP.get(url)

      # The API returns JSONP, so we need to extract the JSON
      json_str = response.gsub(/^callback\(/, "").gsub(/\)$/, "")
      data = JSON.parse(json_str)

      if data["Message"].present?
        return { success: false, error: data["Message"] }
      end

      parse_abn_response(data)
    rescue JSON::ParserError => e
      { success: false, error: "Failed to parse response: #{e.message}" }
    rescue StandardError => e
      { success: false, error: "Lookup failed: #{e.message}" }
    end
  end

  # Search for companies by name
  def search_by_name(name, state: nil, postcode: nil)
    return { success: false, error: "Name is required" } if name.blank?

    begin
      params = {
        name: URI.encode_www_form_component(name),
        callback: "callback",
        guid: @guid
      }
      params[:state] = state if state.present?
      params[:postcode] = postcode if postcode.present?

      query_string = params.map { |k, v| "#{k}=#{v}" }.join("&")
      url = URI("#{ABR_API_URL}/MatchingAbnRegistrationDetailsForName.aspx?#{query_string}")
      response = Net::HTTP.get(url)

      # The API returns JSONP
      json_str = response.gsub(/^callback\(/, "").gsub(/\)$/, "")
      data = JSON.parse(json_str)

      if data["Message"].present?
        return { success: false, error: data["Message"] }
      end

      parse_name_search_response(data)
    rescue JSON::ParserError => e
      { success: false, error: "Failed to parse response: #{e.message}" }
    rescue StandardError => e
      { success: false, error: "Search failed: #{e.message}" }
    end
  end

  # Validate an ABN (check digit validation)
  def self.valid_abn?(abn)
    clean_abn = abn.to_s.gsub(/\D/, "")
    return false unless clean_abn.length == 11

    # ABN validation algorithm
    weights = [ 10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19 ]
    digits = clean_abn.chars.map(&:to_i)

    # Subtract 1 from first digit
    digits[0] -= 1

    # Calculate weighted sum
    sum = digits.zip(weights).map { |d, w| d * w }.sum

    # Valid if divisible by 89
    (sum % 89).zero?
  end

  # Validate an ACN (check digit validation)
  def self.valid_acn?(acn)
    clean_acn = acn.to_s.gsub(/\D/, "")
    return false unless clean_acn.length == 9

    # ACN validation algorithm
    weights = [ 8, 7, 6, 5, 4, 3, 2, 1 ]
    digits = clean_acn.chars.map(&:to_i)

    # Calculate weighted sum of first 8 digits
    sum = digits[0..7].zip(weights).map { |d, w| d * w }.sum

    # Check digit is (10 - (sum % 10)) % 10
    check_digit = (10 - (sum % 10)) % 10

    digits[8] == check_digit
  end

  # Convert ACN to ABN (ACN + check digits = ABN)
  def self.acn_to_abn(acn)
    clean_acn = acn.to_s.gsub(/\D/, "")
    return nil unless clean_acn.length == 9

    # ABN = ACN + 2 check digits calculated from the ACN
    # The algorithm adds '00' prefix and calculates check digits
    # This is a simplified version - the actual ABN may differ
    nil # ABN cannot be reliably calculated from ACN alone
  end

  private

  def parse_abn_response(data)
    return { success: false, error: "No data returned" } if data.blank?

    # Extract business name
    business_name = extract_business_name(data)

    # Extract entity type
    entity_type = data.dig("EntityType", "EntityDescription")

    # Extract GST status
    gst_status = parse_gst_status(data["Gst"])

    # Extract addresses
    addresses = parse_addresses(data)

    # Extract business names (trading names)
    trading_names = parse_trading_names(data["BusinessName"])

    {
      success: true,
      data: {
        abn: data["Abn"],
        acn: data["Acn"],
        name: business_name,
        entity_type: entity_type,
        entity_type_code: data.dig("EntityType", "EntityTypeCode"),
        status: data.dig("EntityStatus", "EntityStatusCode"),
        status_effective_from: data.dig("EntityStatus", "EffectiveFrom"),
        gst_registered: gst_status[:registered],
        gst_effective_from: gst_status[:effective_from],
        main_business_location: addresses[:main_business],
        registered_address: addresses[:registered],
        trading_names: trading_names,
        abn_status_effective_from: data["AbnStatusEffectiveFrom"],
        record_last_updated: data["RecordLastUpdatedDate"]
      }
    }
  end

  def extract_business_name(data)
    # Priority: Entity Name > Main Name > Trading Name
    if data["EntityName"].present?
      data["EntityName"]
    elsif data["MainName"].present?
      name_data = data["MainName"]
      if name_data.is_a?(Array)
        name_data.first&.dig("OrganisationName") || name_data.first&.dig("Name")
      elsif name_data.is_a?(Hash)
        name_data["OrganisationName"] || name_data["Name"]
      end
    elsif data["MainTradingName"].present?
      name_data = data["MainTradingName"]
      if name_data.is_a?(Array)
        name_data.first&.dig("OrganisationName")
      elsif name_data.is_a?(Hash)
        name_data["OrganisationName"]
      end
    end
  end

  def parse_gst_status(gst_data)
    return { registered: false, effective_from: nil } if gst_data.blank?

    if gst_data.is_a?(Array)
      # Find the current GST registration
      current_gst = gst_data.find { |g| g["EffectiveTo"].blank? }
      if current_gst
        { registered: true, effective_from: current_gst["EffectiveFrom"] }
      else
        { registered: false, effective_from: nil }
      end
    elsif gst_data.is_a?(Hash)
      { registered: gst_data["EffectiveTo"].blank?, effective_from: gst_data["EffectiveFrom"] }
    else
      { registered: false, effective_from: nil }
    end
  end

  def parse_addresses(data)
    addresses = { main_business: nil, registered: nil }

    # Main business location
    if data["MainBusinessPhysicalAddress"].present?
      addr = data["MainBusinessPhysicalAddress"]
      if addr.is_a?(Array)
        addr = addr.first
      end
      addresses[:main_business] = format_address(addr) if addr
    end

    # Try to get registered address from legal name
    if data["LegalName"].present? && data["LegalName"].is_a?(Hash)
      if data["LegalName"]["FullName"].present?
        # Some responses include address in legal name structure
      end
    end

    addresses
  end

  def format_address(addr)
    return nil if addr.blank?

    parts = []
    parts << addr["AddressLine1"] if addr["AddressLine1"].present?
    parts << addr["AddressLine2"] if addr["AddressLine2"].present?

    city_line = [
      addr["Suburb"] || addr["City"],
      addr["State"],
      addr["Postcode"]
    ].compact.join(" ")

    parts << city_line if city_line.present?

    parts.join(", ")
  end

  def parse_trading_names(business_name_data)
    return [] if business_name_data.blank?

    names = business_name_data.is_a?(Array) ? business_name_data : [ business_name_data ]

    names.map do |name|
      {
        name: name["OrganisationName"] || name["Name"],
        effective_from: name["EffectiveFrom"],
        effective_to: name["EffectiveTo"]
      }
    end.compact
  end

  def parse_name_search_response(data)
    return { success: false, error: "No results found" } if data.blank?

    names = data["Names"]
    return { success: true, results: [] } if names.blank?

    results = names.is_a?(Array) ? names : [ names ]

    {
      success: true,
      results: results.map do |result|
        {
          abn: result["Abn"],
          name: result["Name"] || result["OrganisationName"],
          name_type: result["NameType"],
          state: result["State"],
          postcode: result["Postcode"],
          score: result["Score"]
        }
      end
    }
  end
end
