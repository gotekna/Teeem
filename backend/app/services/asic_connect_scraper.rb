require 'selenium-webdriver'

class AsicConnectScraper
  ASIC_CONNECT_URL = 'https://connectonline.asic.gov.au'
  LOGIN_TIMEOUT = 30 # seconds
  PAGE_LOAD_TIMEOUT = 60 # seconds

  def initialize(company, headless: true)
    @company = company
    @corporate_key = company.corporate_key
    @username = company.asic_username
    @password = company.encrypted_asic_password # Rails auto-decrypts
    @recovery_answer = company.encrypted_recovery_answer
    @headless = headless
    @driver = nil
  end

  # Main method: Fetch current directors from ASIC Connect
  def fetch_current_directors
    return error_result("Missing ASIC credentials") unless credentials_valid?

    begin
      setup_driver
      login_to_asic
      navigate_to_officers_page
      directors = scrape_officers_data

      success_result(directors)
    rescue StandardError => e
      Rails.logger.error("ASIC scraping failed for #{@company.name}: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      error_result("Scraping failed: #{e.message}")
    ensure
      cleanup_driver
    end
  end

  private

  def credentials_valid?
    @corporate_key.present? && @username.present? && @password.present?
  end

  def setup_driver
    options = Selenium::WebDriver::Chrome::Options.new

    if @headless
      options.add_argument('--headless=new')
      options.add_argument('--disable-gpu')
    end

    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')

    @driver = Selenium::WebDriver.for :chrome, options: options
    @driver.manage.timeouts.implicit_wait = 10
    @driver.manage.timeouts.page_load = PAGE_LOAD_TIMEOUT

    Rails.logger.info("Selenium driver initialized for #{@company.name}")
  end

  def login_to_asic
    Rails.logger.info("Navigating to ASIC Connect...")
    @driver.get(ASIC_CONNECT_URL)

    # Wait for login page to load
    wait = Selenium::WebDriver::Wait.new(timeout: LOGIN_TIMEOUT)

    # Find and fill corporate key field
    Rails.logger.info("Entering corporate key...")
    corporate_key_field = wait.until {
      @driver.find_element(css: "input[name='corporateKey'], input[id*='corporateKey'], input[type='text']")
    }
    corporate_key_field.clear
    corporate_key_field.send_keys(@corporate_key)

    # Find and fill username field
    Rails.logger.info("Entering username...")
    username_field = @driver.find_element(css: "input[name='username'], input[id*='username'], input[type='email']")
    username_field.clear
    username_field.send_keys(@username)

    # Find and fill password field
    Rails.logger.info("Entering password...")
    password_field = @driver.find_element(css: "input[name='password'], input[id*='password'], input[type='password']")
    password_field.clear
    password_field.send_keys(@password)

    # Submit login form
    Rails.logger.info("Submitting login...")
    submit_button = @driver.find_element(css: "button[type='submit'], input[type='submit'], button:contains('Log in')")
    submit_button.click

    # Wait for dashboard/home page or security question
    sleep 3

    # Check if security question appears
    if page_has_security_question?
      Rails.logger.info("Security question detected...")
      answer_security_question
    end

    # Verify login success
    wait.until {
      @driver.current_url.include?('home') ||
      @driver.current_url.include?('dashboard') ||
      @driver.page_source.include?('Company Details') ||
      @driver.page_source.include?('Officers')
    }

    Rails.logger.info("Login successful!")
  rescue Selenium::WebDriver::Error::TimeoutError => e
    take_screenshot('login_timeout')
    raise "Login timeout - check credentials or ASIC Connect may be down"
  rescue Selenium::WebDriver::Error::NoSuchElementError => e
    take_screenshot('login_element_not_found')
    raise "Login form elements not found - ASIC Connect HTML may have changed"
  end

  def page_has_security_question?
    begin
      @driver.find_element(css: "input[id*='security'], input[id*='recovery'], input[id*='challenge']")
      true
    rescue Selenium::WebDriver::Error::NoSuchElementError
      false
    end
  end

  def answer_security_question
    return unless @recovery_answer.present?

    Rails.logger.info("Answering security question...")
    answer_field = @driver.find_element(css: "input[id*='security'], input[id*='recovery'], input[id*='challenge']")
    answer_field.clear
    answer_field.send_keys(@recovery_answer)

    submit_button = @driver.find_element(css: "button[type='submit'], input[type='submit']")
    submit_button.click

    sleep 2
  end

  def navigate_to_officers_page
    Rails.logger.info("Navigating to Officers page...")
    wait = Selenium::WebDriver::Wait.new(timeout: 30)

    # Look for Company Details or Officers link
    officers_link = wait.until {
      @driver.find_element(css: "a:contains('Officers'), a:contains('Company Details'), a[href*='officer']")
    }
    officers_link.click

    sleep 2
    Rails.logger.info("Officers page loaded")
  rescue Selenium::WebDriver::Error::NoSuchElementError
    # Try alternative navigation methods
    Rails.logger.warn("Could not find Officers link - trying alternative navigation...")

    # Try clicking through menu
    begin
      menu_item = @driver.find_element(css: ".menu, .navigation, .sidebar")
      menu_item.click
      sleep 1

      officers_link = @driver.find_element(css: "a:contains('Officers')")
      officers_link.click
      sleep 2
    rescue
      take_screenshot('navigation_failed')
      raise "Could not navigate to Officers page - HTML structure may have changed"
    end
  end

  def scrape_officers_data
    Rails.logger.info("Scraping officers data...")
    directors = []

    # Wait for officer table/list to load
    wait = Selenium::WebDriver::Wait.new(timeout: 30)
    wait.until {
      @driver.find_element(css: "table, .officer-list, .directors-list, [class*='officer']")
    }

    # Try to find officer rows (adjust selectors based on actual ASIC HTML)
    officer_rows = @driver.find_elements(css: "tr.officer, .officer-row, [class*='director']")

    if officer_rows.empty?
      # Try alternative selectors
      officer_rows = @driver.find_elements(css: "table tbody tr")
    end

    Rails.logger.info("Found #{officer_rows.count} officer rows")

    officer_rows.each do |row|
      begin
        cells = row.find_elements(css: "td")
        next if cells.empty?

        director = extract_director_from_row(cells)
        directors << director if director[:name].present?
      rescue => e
        Rails.logger.warn("Failed to parse officer row: #{e.message}")
        next
      end
    end

    # If no structured data found, try parsing text content
    if directors.empty?
      Rails.logger.warn("No structured officer data found - trying text parsing...")
      page_text = @driver.page_source
      directors = extract_directors_from_page_text(page_text)
    end

    Rails.logger.info("Scraped #{directors.count} directors")
    directors
  end

  def extract_director_from_row(cells)
    # Common ASIC officer table structure:
    # Column 0: Name
    # Column 1: Position
    # Column 2: Appointment Date
    # Column 3: Resignation Date (if any)
    # Column 4: Status

    {
      name: cells[0]&.text&.strip,
      position: cells[1]&.text&.strip,
      appointment_date: parse_date_from_text(cells[2]&.text),
      resignation_date: parse_date_from_text(cells[3]&.text),
      status: cells[4]&.text&.strip || 'Current'
    }
  end

  def extract_directors_from_page_text(html)
    # Fallback parser for when table structure is different
    # This is a basic implementation - may need adjustment based on actual HTML
    directors = []

    doc = Nokogiri::HTML(html)

    # Look for director names (usually in specific patterns)
    doc.css('.officer, .director, [class*="person"]').each do |element|
      name = element.css('.name, .person-name').text.strip
      position = element.css('.position, .role').text.strip

      next if name.blank?

      directors << {
        name: name,
        position: position,
        appointment_date: nil,
        resignation_date: nil,
        status: 'Current'
      }
    end

    directors
  end

  def parse_date_from_text(text)
    return nil if text.blank? || text.strip == '-' || text.strip.downcase == 'n/a'

    Date.parse(text.strip)
  rescue ArgumentError
    nil
  end

  def take_screenshot(name)
    return unless @driver

    screenshot_dir = Rails.root.join('tmp', 'asic_screenshots')
    FileUtils.mkdir_p(screenshot_dir)

    filename = "#{@company.id}_#{name}_#{Time.now.to_i}.png"
    filepath = screenshot_dir.join(filename)

    @driver.save_screenshot(filepath.to_s)
    Rails.logger.info("Screenshot saved: #{filepath}")
  rescue => e
    Rails.logger.error("Failed to save screenshot: #{e.message}")
  end

  def cleanup_driver
    @driver&.quit
    Rails.logger.info("Selenium driver closed")
  rescue => e
    Rails.logger.error("Error closing driver: #{e.message}")
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
