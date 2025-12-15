# AbrApiService - Australian Business Register ABN Validation
#
# Uses the free ABR XML Search API to validate ABNs
# API Documentation: https://abr.business.gov.au/Documentation/WebServiceResponse
#
# To use this service, you need a GUID from ABR:
# 1. Register at https://abr.business.gov.au/RegisterAgreement.aspx
# 2. Get your GUID
# 3. Set ABR_GUID environment variable
#
class AbrApiService
  ABR_BASE_URL = "https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx".freeze
  ABR_JSON_URL = "https://abr.business.gov.au/json".freeze

  class AbrError < StandardError; end
  class InvalidAbnFormat < AbrError; end
  class AbnNotFound < AbrError; end
  class ApiError < AbrError; end

  def initialize
    @guid = ENV["ABR_GUID"]
  end

  # Validate and lookup an ABN
  # Returns a hash with ABN details or raises an error
  def lookup(abn)
    # Clean and validate format first
    clean_abn = clean_abn(abn)
    validate_format!(clean_abn)

    # Make API request
    response = make_request(clean_abn)
    parse_response(response, clean_abn)
  end

  # Validate ABN format only (no API call)
  # Returns true/false
  def self.valid_format?(abn)
    clean = abn.to_s.gsub(/\D/, "")
    return false unless clean.length == 11
    return false unless valid_checksum?(clean)
    true
  end

  # Format ABN as XX XXX XXX XXX
  def self.format(abn)
    digits = abn.to_s.gsub(/\D/, "")
    return abn if digits.length != 11
    "#{digits[0..1]} #{digits[2..4]} #{digits[5..7]} #{digits[8..10]}"
  end

  # Validate ABN checksum using the official algorithm
  # https://abr.business.gov.au/Help/AbnFormat
  def self.valid_checksum?(abn)
    digits = abn.to_s.gsub(/\D/, "")
    return false unless digits.length == 11

    # Weights for each position
    weights = [ 10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19 ]

    # Subtract 1 from the first digit
    digits_array = digits.chars.map(&:to_i)
    digits_array[0] -= 1

    # Multiply each digit by its weight and sum
    sum = digits_array.zip(weights).map { |d, w| d * w }.sum

    # Valid if divisible by 89
    (sum % 89).zero?
  end

  # Search for ABN by company name
  # Returns an array of matching businesses (could be multiple matches)
  def search_by_name(name, state: nil, postcode: nil)
    unless @guid.present?
      raise ApiError, "ABR_GUID environment variable not set. Register at https://abr.business.gov.au"
    end

    # Use JSON API for name search (more reliable than XML SOAP)
    uri = URI("#{ABR_JSON_URL}/MatchingNames.aspx")
    params = {
      name: name,
      guid: @guid,
      maxResults: 20
    }
    uri.query = URI.encode_www_form(params)

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    request = Net::HTTP::Get.new(uri.request_uri)
    request["Accept"] = "application/json"

    response = http.request(request)

    unless response.is_a?(Net::HTTPSuccess)
      raise ApiError, "ABR API returned #{response.code}: #{response.message}"
    end

    parse_json_name_search_response(response.body)
  rescue Net::OpenTimeout, Net::ReadTimeout => e
    raise ApiError, "ABR API timeout: #{e.message}"
  rescue SocketError => e
    raise ApiError, "ABR API connection error: #{e.message}"
  end

  # Bulk validate ABNs (for batch processing)
  def bulk_lookup(abns, batch_size: 10, delay: 0.5)
    results = {}

    abns.each_slice(batch_size).with_index do |batch, batch_index|
      batch.each do |abn|
        begin
          results[abn] = lookup(abn)
        rescue AbrError => e
          results[abn] = { error: e.message, valid: false }
        end
        sleep(delay) # Rate limiting
      end
    end

    results
  end

  private

  def clean_abn(abn)
    abn.to_s.gsub(/\D/, "")
  end

  def validate_format!(abn)
    unless abn.length == 11
      raise InvalidAbnFormat, "ABN must be 11 digits (got #{abn.length})"
    end

    unless self.class.valid_checksum?(abn)
      raise InvalidAbnFormat, "ABN checksum is invalid"
    end
  end

  def make_request(abn)
    unless @guid.present?
      raise ApiError, "ABR_GUID environment variable not set. Register at https://abr.business.gov.au"
    end

    uri = URI("#{ABR_BASE_URL}/SearchByABNv202001")
    params = {
      searchString: abn,
      includeHistoricalDetails: "N",
      authenticationGuid: @guid
    }
    uri.query = URI.encode_www_form(params)

    response = Net::HTTP.get_response(uri)

    unless response.is_a?(Net::HTTPSuccess)
      raise ApiError, "ABR API returned #{response.code}: #{response.message}"
    end

    response.body
  rescue Net::OpenTimeout, Net::ReadTimeout => e
    raise ApiError, "ABR API timeout: #{e.message}"
  rescue SocketError => e
    raise ApiError, "ABR API connection error: #{e.message}"
  end

  def parse_json_name_search_response(json_body)
    # Strip JSONP callback wrapper: callback({...})
    json_content = json_body.sub(/^callback\(/, "").sub(/\)$/, "")
    data = JSON.parse(json_content)

    # Handle empty results
    return [] if data["Names"].nil? || data["Names"].empty?

    # Map results to standardized format
    data["Names"].map do |business|
      abn = business["Abn"]&.gsub(/\s/, "")
      next if abn.nil?

      {
        abn: abn,
        abn_formatted: self.class.format(abn),
        name: business["Name"],
        trading_names: [],
        state: business["State"],
        postcode: business["Postcode"],
        score: business["Score"]&.to_i || 0
      }
    end.compact.sort_by { |b| -b[:score] } # Sort by relevance score descending
  rescue JSON::ParserError => e
    raise ApiError, "Failed to parse ABR JSON response: #{e.message}"
  end

  def parse_name_search_response(xml_body)
    doc = Nokogiri::XML(xml_body)
    doc.remove_namespaces!

    # Check for exception
    exception = doc.at_xpath("//response/exception/exceptionDescription")
    if exception
      raise ApiError, "ABR API error: #{exception.text}"
    end

    # Get all matching businesses
    businesses = doc.xpath("//response/searchResultsList/searchResultsRecord")

    return [] if businesses.empty?

    businesses.map do |business|
      abn_node = business.at_xpath("ABN/identifierValue")
      abn = abn_node&.text&.gsub(/\s/, "")

      name_node = business.at_xpath("mainName/organisationName") ||
                  business.at_xpath("legalName/fullName")
      name = name_node&.text

      trading_names = business.xpath("mainTradingName/organisationName").map(&:text)

      state_node = business.at_xpath("mainBusinessPhysicalAddress/stateCode")
      postcode_node = business.at_xpath("mainBusinessPhysicalAddress/postcode")

      {
        abn: abn,
        abn_formatted: self.class.format(abn),
        name: name,
        trading_names: trading_names,
        state: state_node&.text,
        postcode: postcode_node&.text,
        score: business.at_xpath("score")&.text&.to_i || 0
      }
    end.compact.sort_by { |b| -b[:score] } # Sort by relevance score descending
  rescue Nokogiri::XML::SyntaxError => e
    raise ApiError, "Failed to parse ABR response: #{e.message}"
  end

  def parse_response(xml_body, abn)
    doc = Nokogiri::XML(xml_body)
    doc.remove_namespaces!

    # Check for exception
    exception = doc.at_xpath("//response/exception/exceptionDescription")
    if exception
      raise ApiError, "ABR API error: #{exception.text}"
    end

    # Check if ABN was found
    business_entity = doc.at_xpath("//response/businessEntity202001")
    unless business_entity
      raise AbnNotFound, "ABN #{self.class.format(abn)} not found in ABR"
    end

    # Extract entity details
    abn_node = business_entity.at_xpath("ABN")
    entity_status = business_entity.at_xpath("entityStatus")
    entity_type = business_entity.at_xpath("entityType/entityTypeCode")
    entity_type_desc = business_entity.at_xpath("entityType/entityDescription")
    gst = business_entity.at_xpath("goodsAndServicesTax")

    # Get the main name (could be mainName, mainTradingName, or legalName)
    main_name = business_entity.at_xpath("mainName/organisationName") ||
                business_entity.at_xpath("mainTradingName/organisationName") ||
                business_entity.at_xpath("legalName/fullName")

    # Get individual name if no organisation name
    if main_name.nil?
      given_name = business_entity.at_xpath("legalName/givenName")&.text || ""
      family_name = business_entity.at_xpath("legalName/familyName")&.text || ""
      main_name_text = "#{given_name} #{family_name}".strip
    else
      main_name_text = main_name.text
    end

    # Parse GST registration
    gst_registered = false
    gst_from = nil
    if gst
      gst_status = gst.at_xpath("effectiveTo")&.text
      gst_registered = gst_status.blank? || gst_status == "0001-01-01" # No end date means currently registered
      gst_from = gst.at_xpath("effectiveFrom")&.text
    end

    # Parse entity status
    active = entity_status.at_xpath("effectiveTo")&.text.blank? rescue true

    {
      abn: abn,
      abn_formatted: self.class.format(abn),
      valid: true,
      active: active,
      entity_name: main_name_text,
      entity_type_code: entity_type&.text,
      entity_type_description: entity_type_desc&.text,
      gst_registered: gst_registered,
      gst_effective_from: gst_from,
      status_effective_from: entity_status.at_xpath("effectiveFrom")&.text,
      verified_at: Time.current
    }
  rescue Nokogiri::XML::SyntaxError => e
    raise ApiError, "Failed to parse ABR response: #{e.message}"
  end
end
