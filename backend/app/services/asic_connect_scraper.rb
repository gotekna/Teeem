require "net/http"
require "nokogiri"
require "uri"
require "cgi"

class AsicConnectScraper
  ASIC_CONNECT_URL = "https://www.edge.asic.gov.au/004/compportal/get/ServicesLogin"
  REQUEST_TIMEOUT = 30 # seconds

  def initialize(company, headless: true) # headless param kept for backwards compatibility
    @company = company
    @acn = company.acn&.gsub(/\s+/, "") # Remove spaces from ACN
    @username = company.asic_username
    @password = company.encrypted_asic_password # Rails auto-decrypts
    @recovery_answer = company.encrypted_recovery_answer
    @cookies = {}
  end

  # Main method: Fetch current directors from ASIC Connect
  def fetch_current_directors
    return error_result("Missing ASIC credentials") unless credentials_valid?

    begin
      session = login_to_asic
      officers_html = navigate_to_officers_page(session)
      directors = scrape_officers_data(officers_html)

      success_result(directors)
    rescue StandardError => e
      Rails.logger.error("ASIC scraping failed for #{@company.name}: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      error_result("Scraping failed: #{e.message}")
    end
  end

  private

  def credentials_valid?
    @acn.present? && @username.present? && @password.present?
  end

  # Returns a Net::HTTP session with cookies and auth set up
  def login_to_asic
    Rails.logger.info("Navigating to ASIC Connect...")

    # STEP 1: GET the login page to get session cookies
    login_uri = URI.parse(ASIC_CONNECT_URL)
    response = http_get(login_uri)
    store_cookies(response)

    # Parse the login form to find the correct field names and action URL
    doc = Nokogiri::HTML(response.body)

    # STEP 2: Submit ACN
    Rails.logger.info("Step 1: Submitting ACN (#{@acn})...")
    form_data = {
      "Portal-1-COMPServicesLogin-1-ACN-1" => @acn
    }

    # Find the form action URL (may be relative)
    form = doc.at_css("form")
    action_url = form ? form["action"] : ASIC_CONNECT_URL

    post_uri = resolve_uri(login_uri, action_url)
    response = http_post(post_uri, form_data)
    store_cookies(response)

    # STEP 3: Handle HTTP Basic Auth
    # After ACN submission, ASIC redirects to a page requiring HTTP Basic Auth
    Rails.logger.info("Step 2: Handling HTTP Basic Authentication...")

    # Follow redirects, applying Basic Auth
    redirect_limit = 5
    while response.is_a?(Net::HTTPRedirection) && redirect_limit > 0
      redirect_uri = resolve_uri(post_uri, response["location"])
      response = http_get(redirect_uri, basic_auth: true)
      store_cookies(response)
      redirect_limit -= 1
    end

    # If we got a 401, retry with Basic Auth
    if response.is_a?(Net::HTTPUnauthorized)
      response = http_get(URI.parse(response.uri.to_s), basic_auth: true)
      store_cookies(response)
    end

    unless response.is_a?(Net::HTTPSuccess) || response.is_a?(Net::HTTPRedirection)
      raise "Login failed with HTTP #{response.code}: #{response.message}"
    end

    # Check for security question
    page_doc = Nokogiri::HTML(response.body)
    if has_security_question?(page_doc)
      Rails.logger.info("Security question detected...")
      response = answer_security_question(page_doc, URI.parse(response.uri.to_s))
    end

    # Verify login success
    body = response.body
    unless body.include?("Forms manager") || body.include?("Company") || body.include?("compportal")
      raise "Login verification failed - unexpected page content after authentication"
    end

    Rails.logger.info("Login successful!")
    { last_response: response, last_uri: URI.parse(response.uri.to_s) }
  end

  def navigate_to_officers_page(session)
    Rails.logger.info("Navigating to Officers page...")
    doc = Nokogiri::HTML(session[:last_response].body)

    # Find the Officers or Company Details link
    officers_link = doc.at_css('a[href*="officer" i], a[href*="Officer"]') ||
                    doc.css("a").find { |a| a.text =~ /officers|company details/i }

    if officers_link
      href = officers_link["href"]
      officers_uri = resolve_uri(session[:last_uri], href)
      response = http_get(officers_uri, basic_auth: true)
      store_cookies(response)

      # Follow redirects
      redirect_limit = 3
      while response.is_a?(Net::HTTPRedirection) && redirect_limit > 0
        redirect_uri = resolve_uri(officers_uri, response["location"])
        response = http_get(redirect_uri, basic_auth: true)
        store_cookies(response)
        redirect_limit -= 1
      end

      response.body
    else
      # If no link found, the officers data might be on the current page
      Rails.logger.warn("Could not find Officers link - parsing current page")
      session[:last_response].body
    end
  end

  def scrape_officers_data(html)
    Rails.logger.info("Scraping officers data...")
    directors = []

    doc = Nokogiri::HTML(html)

    # Try to find officer rows in tables
    officer_rows = doc.css("tr.officer, .officer-row, [class*='director']")

    if officer_rows.empty?
      officer_rows = doc.css("table tbody tr")
    end

    Rails.logger.info("Found #{officer_rows.count} officer rows")

    officer_rows.each do |row|
      cells = row.css("td")
      next if cells.empty?

      director = extract_director_from_row(cells)
      directors << director if director[:name].present?
    end

    # If no structured data found, try parsing text content
    if directors.empty?
      Rails.logger.warn("No structured officer data found - trying text parsing...")
      directors = extract_directors_from_page(doc)
    end

    Rails.logger.info("Scraped #{directors.count} directors")
    directors
  end

  def extract_director_from_row(cells)
    {
      name: cells[0]&.text&.strip,
      position: cells[1]&.text&.strip,
      appointment_date: parse_date_from_text(cells[2]&.text),
      resignation_date: parse_date_from_text(cells[3]&.text),
      status: cells[4]&.text&.strip || "Current"
    }
  end

  def extract_directors_from_page(doc)
    directors = []

    doc.css('.officer, .director, [class*="person"]').each do |element|
      name = element.css(".name, .person-name").text.strip
      position = element.css(".position, .role").text.strip

      next if name.blank?

      directors << {
        name: name,
        position: position,
        appointment_date: nil,
        resignation_date: nil,
        status: "Current"
      }
    end

    directors
  end

  def parse_date_from_text(text)
    return nil if text.blank? || text.strip == "-" || text.strip.downcase == "n/a"

    Date.parse(text.strip)
  rescue ArgumentError
    nil
  end

  def has_security_question?(doc)
    doc.at_css('input[id*="security"], input[id*="recovery"], input[id*="challenge"]').present?
  end

  def answer_security_question(doc, current_uri)
    return http_get(current_uri, basic_auth: true) unless @recovery_answer.present?

    Rails.logger.info("Answering security question...")
    answer_field = doc.at_css('input[id*="security"], input[id*="recovery"], input[id*="challenge"]')
    return http_get(current_uri, basic_auth: true) unless answer_field

    form = answer_field.ancestors("form").first
    action_url = form ? form["action"] : current_uri.to_s

    form_data = {}
    # Collect all hidden fields
    form&.css('input[type="hidden"]')&.each do |hidden|
      form_data[hidden["name"]] = hidden["value"] if hidden["name"]
    end
    form_data[answer_field["name"]] = @recovery_answer

    post_uri = resolve_uri(current_uri, action_url)
    response = http_post(post_uri, form_data, basic_auth: true)
    store_cookies(response)
    response
  end

  # HTTP helpers

  def http_get(uri, basic_auth: false)
    http = build_http(uri)
    request = Net::HTTP::Get.new(uri)
    request["Cookie"] = cookie_header
    request["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    request.basic_auth(@username, @password) if basic_auth

    http.request(request)
  end

  def http_post(uri, form_data, basic_auth: false)
    http = build_http(uri)
    request = Net::HTTP::Post.new(uri)
    request["Cookie"] = cookie_header
    request["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    request.set_form_data(form_data)
    request.basic_auth(@username, @password) if basic_auth

    http.request(request)
  end

  def build_http(uri)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.open_timeout = REQUEST_TIMEOUT
    http.read_timeout = REQUEST_TIMEOUT
    http
  end

  def store_cookies(response)
    Array(response.get_fields("set-cookie")).each do |cookie_str|
      name, value = cookie_str.split(";").first.split("=", 2)
      @cookies[name.strip] = value&.strip
    end
  end

  def cookie_header
    @cookies.map { |k, v| "#{k}=#{v}" }.join("; ")
  end

  def resolve_uri(base_uri, relative_url)
    return base_uri if relative_url.blank?

    if relative_url.start_with?("http")
      URI.parse(relative_url)
    else
      URI.join(base_uri, relative_url)
    end
  end

  def success_result(directors)
    {
      success: true,
      directors: directors,
      count: directors.count,
      company_name: @company.name,
      scraped_at: Time.current
    }
  end

  def error_result(message)
    {
      success: false,
      error: message,
      company_name: @company.name
    }
  end
end
