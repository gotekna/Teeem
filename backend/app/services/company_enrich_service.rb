# frozen_string_literal: true

# Service to auto-enrich company contacts with website URLs and ABN lookup
# Uses intelligent guessing for obvious company websites
class CompanyEnrichService
  require "net/http"
  require "uri"

  # Well-known Australian companies and their websites
  # This is a fallback for companies with non-obvious domain patterns
  KNOWN_COMPANIES = {
    "harvey norman" => "https://www.harveynorman.com.au",
    "bunnings" => "https://www.bunnings.com.au",
    "woolworths" => "https://www.woolworths.com.au",
    "coles" => "https://www.coles.com.au",
    "kmart" => "https://www.kmart.com.au",
    "target" => "https://www.target.com.au",
    "big w" => "https://www.bigw.com.au",
    "officeworks" => "https://www.officeworks.com.au",
    "jb hi-fi" => "https://www.jbhifi.com.au",
    "jb hifi" => "https://www.jbhifi.com.au",
    "aldi" => "https://www.aldi.com.au",
    "ikea" => "https://www.ikea.com/au",
    "costco" => "https://www.costco.com.au",
    "telstra" => "https://www.telstra.com.au",
    "optus" => "https://www.optus.com.au",
    "vodafone" => "https://www.vodafone.com.au",
    "qantas" => "https://www.qantas.com",
    "virgin australia" => "https://www.virginaustralia.com",
    "jetstar" => "https://www.jetstar.com",
    "commonwealth bank" => "https://www.commbank.com.au",
    "commbank" => "https://www.commbank.com.au",
    "cba" => "https://www.commbank.com.au",
    "westpac" => "https://www.westpac.com.au",
    "anz" => "https://www.anz.com.au",
    "nab" => "https://www.nab.com.au",
    "national australia bank" => "https://www.nab.com.au",
    "macquarie bank" => "https://www.macquarie.com",
    "suncorp" => "https://www.suncorp.com.au",
    "reece" => "https://www.reece.com.au",
    "tradelink" => "https://www.tradelink.com.au",
    "beaumont tiles" => "https://www.beaumont-tiles.com.au",
    "mitre 10" => "https://www.mitre10.com.au",
    "masters" => "https://www.masters.com.au",
    "stratco" => "https://www.stratco.com.au",
    "total tools" => "https://www.totaltools.com.au",
    "supercheap auto" => "https://www.supercheapauto.com.au",
    "autobarn" => "https://www.autobarn.com.au",
    "repco" => "https://www.repco.com.au"
  }.freeze

  def initialize(contact)
    @contact = contact
  end

  # Attempt to find and set website URL for the company
  # Returns { success: true/false, website: url, method: how_found }
  def enrich_website
    return { success: false, error: "Contact is not a company/trust" } unless company_entity?
    return { success: true, website: @contact.website, method: "already_set" } if @contact.website.present?

    company_name = @contact.company_name_or_trust.presence || @contact.display_name
    return { success: false, error: "No company name available" } if company_name.blank?

    # Try to find website
    result = find_website(company_name)

    if result[:success]
      @contact.update(website: result[:website])
      result
    else
      result
    end
  end

  # Look up ABN from ABR by company name
  # Returns { success: true/false, abn: xxx, entity_name: xxx }
  def enrich_abn
    return { success: false, error: "Contact is not a business entity" } unless business_entity?
    return { success: true, abn: @contact.tax_number, method: "already_set" } if @contact.tax_number.present?

    company_name = @contact.company_name_or_trust.presence || @contact.display_name
    return { success: false, error: "No company name available" } if company_name.blank?

    # Look up ABN by name using ABR API
    result = lookup_abn_by_name(company_name)

    if result[:success]
      @contact.update(
        tax_number: result[:abn],
        abn_entity_name: result[:entity_name],
        abn_entity_type: result[:entity_type],
        abn_gst_registered: result[:gst_registered],
        abn_valid: true,
        abn_verified_at: Time.current
      )
      result
    else
      result
    end
  end

  # Enrich both website and ABN
  def enrich_all
    results = {
      website: enrich_website,
      abn: enrich_abn
    }

    {
      success: results[:website][:success] || results[:abn][:success],
      results: results
    }
  end

  private

  def company_entity?
    %w[company trust].include?(@contact.entity_type)
  end

  def business_entity?
    %w[company trust sole_trader].include?(@contact.entity_type)
  end

  def find_website(company_name)
    normalized_name = company_name.downcase.strip

    # 1. Check known companies dictionary
    KNOWN_COMPANIES.each do |known_name, url|
      if normalized_name.include?(known_name) || known_name.include?(normalized_name)
        if url_exists?(url)
          return { success: true, website: url, method: "known_company" }
        end
      end
    end

    # 2. Generate domain guesses from company name
    domain_base = generate_domain_base(company_name)
    domain_guesses = generate_domain_guesses(domain_base)

    domain_guesses.each do |domain|
      url = "https://www.#{domain}"
      if url_exists?(url)
        return { success: true, website: url, method: "domain_guess" }
      end

      # Try without www
      url_no_www = "https://#{domain}"
      if url_exists?(url_no_www)
        return { success: true, website: url_no_www, method: "domain_guess" }
      end
    end

    { success: false, error: "Could not find website" }
  end

  def generate_domain_base(company_name)
    # Remove common suffixes and clean up
    cleaned = company_name.downcase
                          .gsub(/\s*(pty\.?\s*ltd\.?|ltd\.?|limited|inc\.?|incorporated|llc|plc|group|holdings?|australia|aust?\.?)\s*$/i, "")
                          .gsub(/[^a-z0-9\s]/, "") # Remove special chars
                          .gsub(/\s+/, "")          # Remove spaces
                          .strip

    cleaned
  end

  def generate_domain_guesses(domain_base)
    return [] if domain_base.blank?

    # Australian TLDs first (more likely for AU companies)
    [
      "#{domain_base}.com.au",
      "#{domain_base}.com",
      "#{domain_base}.au",
      "#{domain_base}.net.au",
      "#{domain_base}.org.au"
    ]
  end

  def url_exists?(url)
    uri = URI.parse(url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 5
    http.read_timeout = 5

    # Just do a HEAD request to check if site exists
    request = Net::HTTP::Head.new(uri.request_uri)
    request["User-Agent"] = "Mozilla/5.0 (compatible; TeeemBot/1.0)"

    response = http.request(request)

    # Accept 2xx and 3xx responses as "exists"
    response.code.to_i < 400
  rescue StandardError => e
    Rails.logger.debug "URL check failed for #{url}: #{e.message}"
    false
  end

  def lookup_abn_by_name(company_name)
    # Use ABR's name search API
    abr_guid = ENV["ABR_GUID"]
    return { success: false, error: "ABR GUID not configured" } if abr_guid.blank? || abr_guid == "00000000-0000-0000-0000-000000000000"

    uri = URI("https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/ABRSearchByNameSimpleProtocol")
    uri.query = URI.encode_www_form({
      name: company_name,
      postcode: "",
      legalName: "Y",
      tradingName: "Y",
      NSW: "Y",
      SA: "Y",
      ACT: "Y",
      VIC: "Y",
      WA: "Y",
      NT: "Y",
      QLD: "Y",
      TAS: "Y",
      authenticationGuid: abr_guid
    })

    response = Net::HTTP.get_response(uri)

    unless response.is_a?(Net::HTTPSuccess)
      return { success: false, error: "ABR service unavailable" }
    end

    # Parse XML response
    doc = REXML::Document.new(response.body)

    # Get first matching result
    first_record = doc.elements["//searchResultsRecord"]
    return { success: false, error: "No ABN found for company name" } unless first_record

    abn = first_record.elements["ABN/identifierValue"]&.text
    return { success: false, error: "No ABN in response" } if abn.blank?

    # Get entity details
    entity_name = first_record.elements["mainName/organisationName"]&.text ||
                  first_record.elements["mainTradingName/organisationName"]&.text

    entity_type = first_record.elements["entityType/entityDescription"]&.text

    # Check if GST registered (would need separate lookup)

    {
      success: true,
      abn: AbnLookupService.send(:format_abn, abn.gsub(/\s/, "")),
      entity_name: entity_name,
      entity_type: entity_type,
      gst_registered: nil, # Would need separate lookup
      method: "abr_name_search"
    }
  rescue StandardError => e
    Rails.logger.error "ABN name search failed: #{e.message}"
    { success: false, error: "ABN lookup failed: #{e.message}" }
  end
end
