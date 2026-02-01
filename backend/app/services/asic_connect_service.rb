require "net/http"
require "nokogiri"
require "json"

class AsicConnectService
  # ASIC Connect portal URL
  ASIC_CONNECT_URL = "https://connectonline.asic.gov.au"

  # ASIC Registry Search (public, no login required)
  ASIC_REGISTRY_URL = "https://connectonline.asic.gov.au/RegistrySearch/faces/landing/SearchRegisters.jspx"

  def initialize(company)
    @company = company
    @corporate_key = company.corporate_key
    @username = company.asic_username
    @password = decrypt_password(company.encrypted_asic_password)
    @recovery_answer = decrypt_password(company.encrypted_recovery_answer) if company.encrypted_recovery_answer
  end

  # Fetch current directors from ASIC Registry Search (public data)
  # This uses the public ASIC registry which doesn't require login
  def fetch_current_directors_public
    return { success: false, error: "ACN is required" } unless @company.acn.present?

    begin
      # Use the public ASIC registry search
      # This is a simplified version - ASIC's public search has limited data
      # For full data, we'd need to scrape the logged-in portal (more complex)

      {
        success: false,
        error: "Public ASIC registry scraping requires Selenium for JavaScript rendering. Use fetch_directors_via_extract instead.",
        suggestion: "Download ASIC extract manually and use rake task to import"
      }
    rescue StandardError => e
      {
        success: false,
        error: "Failed to fetch directors: #{e.message}"
      }
    end
  end

  # Fetch directors from ASIC Connect portal (requires login)
  # NOTE: This requires Selenium WebDriver for full browser automation
  # ASIC Connect uses JavaScript and complex session management
  def fetch_directors_via_portal
    return { success: false, error: "ASIC credentials not configured" } unless credentials_present?

    {
      success: false,
      error: "ASIC Connect portal scraping requires Selenium WebDriver (not yet installed).",
      credentials_ok: credentials_present?,
      corporate_key: @corporate_key,
      username: @username,
      suggestion: "Use manual ASIC extract import instead, or install Selenium"
    }
  end

  # Parse an ASIC extract file (PDF or Excel) and return directors
  # This is the most reliable method - user downloads extract from ASIC
  def parse_asic_extract(file_path)
    return { success: false, error: "File not found" } unless File.exist?(file_path)

    extension = File.extname(file_path).downcase

    case extension
    when ".pdf"
      parse_pdf_extract(file_path)
    when ".xlsx"
      parse_excel_extract(file_path)
    else
      { success: false, error: "Unsupported file type: #{extension}" }
    end
  end

  private

  def credentials_present?
    @corporate_key.present? && @username.present? && @password.present?
  end

  def decrypt_password(encrypted_value)
    return nil if encrypted_value.blank?

    # Use Rails encrypted credentials to decrypt
    # Assuming the encryption format matches what's in the database
    begin
      # This is a placeholder - actual decryption depends on your encryption method
      # Check Corporate model for the encryption method used
      encrypted_value
    rescue StandardError => e
      Rails.logger.error("Failed to decrypt password: #{e.message}")
      nil
    end
  end

  # SSoT: Uses PdfTextExtractionService for all PDF text extraction
  def parse_pdf_extract(file_path)
    result = PdfTextExtractionService.extract(file_path, join_pages: true)

    unless result[:success]
      return {
        success: false,
        error: result[:error] || "Failed to parse PDF"
      }
    end

    directors = extract_directors_from_text(result[:text])

    {
      success: true,
      directors: directors,
      source: "pdf_extract"
    }
  end

  def parse_excel_extract(file_path)
    begin
      xlsx = TeeemXl::SpreadsheetAdapter.open(file_path)
      xlsx.sheet(xlsx.sheets.first) # First sheet

      directors = extract_directors_from_spreadsheet(xlsx)

      {
        success: true,
        directors: directors,
        source: "excel_extract"
      }
    rescue StandardError => e
      {
        success: false,
        error: "Failed to parse Excel: #{e.message}"
      }
    end
  end

  def extract_directors_from_text(text)
    # Parse ASIC PDF extract format
    # This is a simplified parser - actual ASIC format may vary
    directors = []
    current_director = nil

    text.each_line do |line|
      # Look for director name pattern
      if line =~ /^Name\s*:\s*(.+)/
        current_director = { name: $1.strip }
      elsif line =~ /^Position\s*:\s*(.+)/ && current_director
        current_director[:position] = $1.strip
      elsif line =~ /^Appointment Date\s*:\s*(.+)/ && current_director
        current_director[:appointment_date] = parse_date($1.strip)
      elsif line =~ /^Resignation Date\s*:\s*(.+)/ && current_director
        current_director[:resignation_date] = parse_date($1.strip)
        directors << current_director
        current_director = nil
      elsif line =~ /^Status\s*:\s*(.+)/ && current_director
        current_director[:status] = $1.strip
        directors << current_director if line.include?("Current")
        current_director = nil
      end
    end

    directors
  end

  def extract_directors_from_spreadsheet(sheet)
    # Parse ASIC Excel extract format
    directors = []

    # Skip header rows
    (2..sheet.last_row).each do |row_num|
      row = sheet.row(row_num)
      next if row.compact.empty?

      director = {
        name: row[0]&.to_s&.strip,
        position: row[1]&.to_s&.strip,
        appointment_date: parse_date(row[2]),
        resignation_date: parse_date(row[3]),
        status: row[4]&.to_s&.strip
      }

      directors << director if director[:name].present?
    end

    directors
  end

  def parse_date(date_value)
    return nil if date_value.blank?

    if date_value.is_a?(Date) || date_value.is_a?(DateTime)
      date_value.to_date
    elsif date_value.is_a?(String)
      Date.parse(date_value) rescue nil
    else
      nil
    end
  end
end
