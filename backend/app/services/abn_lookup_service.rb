class AbnLookupService
  require "net/http"
  require "uri"
  require "rexml/document"

  # ABR Web Services GUID - You need to register at https://abr.business.gov.au/Tools/WebServices
  # For now, using the test GUID. Replace with your production GUID.
  ABR_GUID = ENV["ABR_GUID"] || "00000000-0000-0000-0000-000000000000"

  def self.validate(abn)
    return { valid: false, error: "ABN is required" } if abn.blank?

    # Clean ABN - remove spaces and non-digits
    clean_abn = abn.to_s.gsub(/\s+/, "").gsub(/[^0-9]/, "")

    # Validate ABN format (must be 11 digits)
    return { valid: false, error: "ABN must be 11 digits" } unless clean_abn.length == 11

    # Validate ABN checksum
    unless valid_abn_checksum?(clean_abn)
      return { valid: false, error: "Invalid ABN checksum" }
    end

    # Look up ABN on ABR
    begin
      result = lookup_abn(clean_abn)

      if result[:valid]
        {
          valid: true,
          abn: format_abn(clean_abn),
          entity_name: result[:entity_name],
          entity_type: result[:entity_type],
          gst_registered: result[:gst_registered],
          active: result[:active]
        }
      else
        {
          valid: false,
          error: result[:error] || "ABN not found in ABR"
        }
      end
    rescue => e
      Rails.logger.error "ABN Lookup Error: #{e.message}"
      # Still return valid if checksum passes, but without ABR details
      {
        valid: true,
        abn: format_abn(clean_abn),
        error: "ABR lookup service unavailable",
        checksum_valid: true
      }
    end
  end

  private

  # Validate ABN using the checksum algorithm
  def self.valid_abn_checksum?(abn)
    return false unless abn.length == 11 && abn.match?(/^\d{11}$/)

    weights = [ 10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19 ]
    digits = abn.chars.map(&:to_i)

    # Subtract 1 from the first digit
    digits[0] -= 1

    # Calculate weighted sum
    sum = digits.each_with_index.sum { |digit, index| digit * weights[index] }

    # ABN is valid if sum is divisible by 89
    (sum % 89).zero?
  end

  # Format ABN with spaces (XX XXX XXX XXX)
  def self.format_abn(abn)
    clean = abn.gsub(/\s+/, "")
    "#{clean[0..1]} #{clean[2..4]} #{clean[5..7]} #{clean[8..10]}"
  end

  # Look up ABN on the ABR web service
  def self.lookup_abn(abn)
    uri = URI("https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/ABRSearchByABN")
    uri.query = URI.encode_www_form({
      searchString: abn,
      includeHistoricalDetails: "N",
      authenticationGuid: ABR_GUID
    })

    response = Net::HTTP.get_response(uri)

    unless response.is_a?(Net::HTTPSuccess)
      return { valid: false, error: "ABR service unavailable" }
    end

    # Parse XML response
    doc = REXML::Document.new(response.body)

    # Check for exceptions
    exception = doc.elements["//exception"]
    if exception
      error_msg = exception.elements["exceptionDescription"]&.text || "ABR lookup failed"
      return { valid: false, error: error_msg }
    end

    # Check if ABN is current/active
    abn_status = doc.elements["//ABN"]&.attributes["status"]
    unless abn_status == "Active"
      return { valid: false, error: "ABN is not active" }
    end

    # Extract entity details
    entity_name = doc.elements["//mainName/organisationName"]&.text ||
                  doc.elements["//mainName/personNameDetails/fullName"]&.text ||
                  doc.elements["//mainName/individualName/fullName"]&.text

    entity_type = doc.elements["//entityType/entityDescription"]&.text

    # Check GST registration
    gst_element = doc.elements["//goodsAndServicesTax"]
    gst_registered = gst_element && gst_element.elements["effectiveFrom"] && !gst_element.elements["effectiveTo"]

    {
      valid: true,
      entity_name: entity_name,
      entity_type: entity_type,
      gst_registered: gst_registered,
      active: true
    }
  rescue => e
    Rails.logger.error "ABN Lookup Service Error: #{e.message}\n#{e.backtrace.join("\n")}"
    { valid: false, error: "Failed to lookup ABN" }
  end
end
