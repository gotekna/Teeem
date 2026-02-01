class CompanyImportService
  # Individual company sheets that have detailed data
  COMPANY_SHEETS = [
    "Co Invest Homes", "Co Invest Capital", "W2G", "THSI", "Team Harder Family Trust",
    "Prov1322", "Gen2612", "Team Harder Super Fund", "Team Harder", "Tekna Homes",
    "Tekna Drafting", "Tekna Admin", "Tekna", "The Promise Family Trust", "The Promise QLD PTY LTD"
  ].freeze

  def initialize(file_path)
    @file_path = file_path
    @spreadsheet = TeeemXl::SpreadsheetAdapter.open(file_path)
    @import_log = []
    @errors = []
  end

  # Import all data from Corporate_File.xlsx
  def import_all
    result = {
      companies_imported: 0,
      directors_imported: 0,
      bank_accounts_imported: 0,
      shareholdings_imported: 0,
      errors: []
    }

    ActiveRecord::Base.transaction do
      # Import companies from All Companies sheet
      result[:companies_imported] = import_companies

      # Import directors
      result[:directors_imported] = import_directors

      # Import bank accounts
      result[:bank_accounts_imported] = import_bank_accounts

      # Import shareholdings (if data available)
      result[:shareholdings_imported] = import_shareholdings

      # Enrich companies from individual sheets
      enrich_from_company_sheets

      result[:errors] = @errors
    end

    result
  rescue StandardError => e
    Rails.logger.error("Import failed: #{e.message}")
    result[:errors] << "Import failed: #{e.message}"
    result
  end

  # Reload all company data from spreadsheet (update existing records)
  def reload_all
    result = {
      companies_updated: 0,
      directors_updated: 0,
      bank_accounts_updated: 0,
      shareholdings_updated: 0,
      errors: []
    }

    # Reload from All Companies sheet
    result[:companies_updated] = reload_companies

    # Reload directors
    result[:directors_updated] = reload_directors

    # Reload from individual company sheets
    enrich_from_company_sheets

    # Reload bank accounts
    result[:bank_accounts_updated] = reload_bank_accounts

    result[:errors] = @errors
    result
  rescue StandardError => e
    Rails.logger.error("Reload failed: #{e.message}")
    result[:errors] << "Reload failed: #{e.message}"
    result
  end

  # Calculate health for a single company (reusable helper)
  def self.calculate_company_health(company)
    issues = []
    warnings = []

    # Critical issues
    issues << "Missing ACN" if company.acn.blank?
    issues << "Missing ABN" if company.abn.blank?
    issues << "No current directors" if company.corporate_directors.current.empty?
    issues << "Missing registered office address" if company.registered_office_address.blank?

    # Warnings
    warnings << "Missing TFN" if company.tfn.blank?
    warnings << "No bank accounts" if company.bank_accounts.empty?
    warnings << "No shareholders recorded" if company.corporate_shareholdings.empty?
    warnings << "Missing date of incorporation" if company.date_incorporated.blank?
    warnings << "No secretary appointed" unless company.corporate_directors.current.any? { |d| d.position&.include?("secretary") }
    warnings << "No public officer appointed" unless company.corporate_directors.current.any? { |d| d.position&.include?("public_officer") }
    warnings << "Missing corporate key" if company.corporate_key.blank?
    warnings << "Missing ASIC credentials" if company.asic_username.blank?
    warnings << "Review date overdue" if company.review_date.present? && company.review_date < Date.today
    warnings << "Missing principal place of business" if company.principal_place_of_business.blank?

    # Compliance warnings
    overdue = company.corporate_compliance_items.where("due_date < ? AND completed = ?", Date.today, false).count
    warnings << "#{overdue} overdue compliance items" if overdue > 0

    upcoming = company.corporate_compliance_items.where("due_date BETWEEN ? AND ?", Date.today, 30.days.from_now).where(completed: false).count
    warnings << "#{upcoming} compliance items due within 30 days" if upcoming > 0

    # Calculate health score
    total_checks = 15
    passed = total_checks - issues.count - (warnings.count * 0.5)
    health_score = [ (passed / total_checks * 100).round, 0 ].max

    health_status = case health_score
    when 90..100 then "excellent"
    when 70..89 then "good"
    when 50..69 then "needs_attention"
    else "critical"
    end

    {
      id: company.id,
      name: company.name,
      group: company.group_name,
      status: company.status,
      health_score: health_score,
      health_status: health_status,
      issues: issues,
      warnings: warnings,
      director_count: company.corporate_directors.current.count,
      bank_account_count: company.bank_accounts.where(status: "active").count,
      shareholder_count: company.corporate_shareholdings.count,
      has_acn: company.acn.present?,
      has_abn: company.abn.present?,
      has_tfn: company.tfn.present?,
      has_registered_office: company.registered_office_address.present?,
      has_corporate_key: company.corporate_key.present?,
      review_date: company.review_date,
      review_overdue: company.review_date.present? && company.review_date < Date.today
    }
  end

  # Get health for a single company by ID (fast endpoint)
  def self.company_health(company_id)
    company = Corporate
      .includes(:corporate_directors, :bank_accounts, :corporate_shareholdings, :corporate_compliance_items)
      .find_by(id: company_id)

    return nil unless company

    calculate_company_health(company)
  end

  # Generate health report for all companies
  def self.health_report
    companies = Corporate.includes(:corporate_directors, :bank_accounts, :corporate_shareholdings, :corporate_compliance_items).all

    companies.map { |company| calculate_company_health(company) }.sort_by { |h| h[:health_score] }
  end

  # Enrich company data from individual sheets
  def enrich_from_company_sheets
    COMPANY_SHEETS.each do |sheet_name|
      next unless @spreadsheet.sheets.include?(sheet_name)

      begin
        enrich_company_from_sheet(sheet_name)
      rescue StandardError => e
        @errors << "Failed to enrich #{sheet_name}: #{e.message}"
      end
    end
  end

  private

  def reload_companies
    count = 0
    sheet = @spreadsheet.sheet("All Companies")
    return 0 unless sheet.present?

    (2..sheet.last_row).each do |row_num|
      row = sheet.row(row_num)
      next if row[1].blank? # Skip if company name is blank

      company_name = row[1].to_s.strip
      company = Corporate.find_by("LOWER(name) LIKE ?", "%#{company_name.downcase.gsub(/\s+pty\s+ltd.*$/i, '').strip}%")

      next unless company

      updates = {}
      updates[:review_date] = parse_date(row[2]) if row[2].present?
      updates[:acn] = clean_acn(row[3]) if row[3].present? && company.acn.blank?
      updates[:abn] = clean_abn(row[4]) if row[4].present? && company.abn.blank?
      updates[:tfn] = row[5].to_s.gsub(/\s/, "") if row[5].present? && company.tfn.blank?
      updates[:date_incorporated] = parse_date(row[7]) if row[7].present? && company.date_incorporated.blank?
      updates[:corporate_key] = row[8].to_s if row[8].present? && company.corporate_key.blank?
      updates[:asic_username] = row[9].to_s if row[9].present? && company.asic_username.blank?
      updates[:encrypted_asic_password] = row[10].to_s if row[10].present? && company.encrypted_asic_password.blank?
      updates[:recovery_question] = row[11].to_s if row[11].present? && company.recovery_question.blank?
      updates[:encrypted_recovery_answer] = row[12].to_s if row[12].present? && company.encrypted_recovery_answer.blank?

      if updates.any?
        company.update!(updates)
        count += 1
        @import_log << "Updated company: #{company.name}"
      end
    rescue StandardError => e
      @errors << "Row #{row_num}: Failed to reload company - #{e.message}"
    end

    count
  end

  def reload_directors
    count = 0
    sheet = @spreadsheet.sheet("Director Details (2)")
    return 0 unless sheet.present?

    (2..sheet.last_row).each do |row_num|
      row = sheet.row(row_num)
      next if row[0].blank? # Skip if given name is blank

      contact = Contact.find_or_initialize_by(
        first_name: row[0].to_s.strip,
        last_name: row[1].to_s.strip
      )

      # Columns: Given Names, Family Name, Director Number, Date Of Birth, Place of Birth, State, Country, Residential Address, TFN, Directors ID
      # Indices: 0            1            2                3               4               5      6        7                    8    10 (column K)
      updates = {
        display_name: "#{row[0]} #{row[1]}".strip,
        date_of_birth: parse_date(row[3]),
        place_of_birth: row[4].to_s,
        birth_state: row[5].to_s,
        birth_country: row[6].to_s,
        residential_address: row[7].to_s,
        tfn: row[8].to_s.gsub(/\s/, ""),
        director_id: row[10].to_s.gsub(/\s/, "") # Column K (index 10)
      }

      contact.assign_attributes(updates.compact_blank)
      if contact.new_record? || contact.changed?
        contact.save!
        count += 1
      end
    rescue StandardError => e
      @errors << "Director row #{row_num}: #{e.message}"
    end

    count
  end

  def reload_bank_accounts
    count = 0
    sheet = @spreadsheet.sheet("Bank Accounts ")
    return 0 unless sheet.present?

    (3..sheet.last_row).each do |row_num|
      row = sheet.row(row_num)
      next if row[1].blank? # Skip if entity name is blank

      entity_name = row[1].to_s.strip
      company = Corporate.find_by("LOWER(name) LIKE ?", "%#{entity_name.downcase}%")
      next unless company

      bsb = clean_bsb(row[3])
      account_number = row[4].to_s.strip

      next if bsb.blank? || account_number.blank?

      bank_account = company.bank_accounts.find_or_initialize_by(
        bsb: bsb,
        account_number: account_number
      )

      bank_account.assign_attributes(
        institution_name: row[2].to_s.strip,
        date_opened: parse_date(row[5]),
        date_closed: parse_date(row[6]),
        status: row[6].present? ? "closed" : "active"
      )

      if bank_account.new_record? || bank_account.changed?
        bank_account.save!
        count += 1
      end
    rescue StandardError => e
      @errors << "Bank account row #{row_num}: #{e.message}"
    end

    count
  end

  def enrich_company_from_sheet(sheet_name)
    sheet = @spreadsheet.sheet(sheet_name)
    return unless sheet.present?

    # Find company name in row 3
    company_name = nil
    (1..10).each do |row_num|
      row = sheet.row(row_num)
      if row[0].to_s.match?(/pty\s+ltd|trust|fund/i)
        company_name = row[0].to_s.strip
        break
      end
    end

    return unless company_name.present?

    # Find company by partial name match
    search_name = company_name.gsub(/\s+pty\s+ltd.*$/i, "").strip
    company = Corporate.find_by("LOWER(name) LIKE ?", "%#{search_name.downcase}%")

    return unless company

    # Parse the sheet for additional data
    updates = {}
    directors_data = []
    shareholdings_data = []
    bank_accounts_data = []

    (1..50).each do |row_num|
      break if row_num > sheet.last_row
      row = sheet.row(row_num)
      next if row.compact.empty?

      label = row[0].to_s.strip.downcase

      case label
      when "acn:"
        updates[:acn] = clean_acn(row[1]) if row[1].present? && company.acn.blank?
        # TFN is often in column 5 of this row
        updates[:tfn] = row[5].to_s.gsub(/\s/, "") if row[5].present? && company.tfn.blank?
      when "abn:"
        # ABN is in column after ACN
      when "tfn:"
        updates[:tfn] = row[1].to_s.gsub(/\s/, "") if row[1].present? && company.tfn.blank?
      when "date incorporated"
        updates[:date_incorporated] = parse_date(row[1]) if row[1].present? && company.date_incorporated.blank?
        # Shares on issue is often in column 3-4 of this row
        updates[:shares_on_issue] = row[3].to_i if row[3].present? && row[2].to_s.downcase.include?("shares")
      when "shares on issue"
        updates[:shares_on_issue] = row[1].to_i if row[1].present?
      when "purpose:"
        updates[:purpose] = row[1].to_s if row[1].present? && company.purpose.blank?
        # Check if it's a trustee (column 2 often has "Is it a Trustee")
        if row[1].to_s.downcase.include?("trustee") || row[2].to_s.downcase.include?("trustee")
          updates[:is_trustee] = true
        end
      when "trust name / trustee"
        updates[:is_trustee] = true
        updates[:trust_name] = row[1].to_s if row[1].present? && company.trust_name.blank?
      when "registered office"
        updates[:registered_office_address] = row[1].to_s if row[1].present? && company.registered_office_address.blank?
        # Principal place of business is often in column 3-4 of this row
        if row[2].to_s.downcase.include?("principal")
          updates[:principal_place_of_business] = row[3].to_s if row[3].present? && company.principal_place_of_business.blank?
        end
      when "principal place of business"
        # Principal place is in a different column
        updates[:principal_place_of_business] = row[5].to_s if row[5].present? && company.principal_place_of_business.blank?
      when "folder storage"
        # Code is often in column 3-4 of this row
        if row[2].to_s.downcase.include?("abbreviation")
          updates[:code] = row[3].to_s if row[3].present? && company.code.blank?
        end
      when "current director"
        directors_data << { name: row[1].to_s, position: "director", date: parse_date(row[2]) }
      when "current secretary"
        directors_data << { name: row[1].to_s, position: "secretary", date: parse_date(row[2]) }
      when "current shareholdings"
        if row[1].present?
          # Row format: Current Shareholdings, Shareholder Name, [blank], Shares, Beneficially Held
          shareholdings_data << {
            name: row[1].to_s,
            shares: row[2].to_i.positive? ? row[2].to_i : row[3].to_i,
            beneficially_held: row[3].to_s.downcase == "yes" || row[4].to_s.downcase == "yes"
          }
        end
      end

      # Check for bank account rows
      if row[1].to_s.match?(/westpac|nab|cba|anz|bank/i)
        bank_accounts_data << {
          institution: row[1].to_s,
          bsb: row[2].to_s,
          account: row[3].to_s,
          opened: parse_date(row[4])
        }
      end
    end

    # Apply updates
    company.update!(updates) if updates.any?

    # Link directors
    directors_data.each do |dir_data|
      next if dir_data[:name].blank?

      names = dir_data[:name].split(" ")
      contact = Contact.find_by("LOWER(display_name) LIKE ?", "%#{dir_data[:name].downcase}%")

      next unless contact

      existing = company.corporate_directors.find_by(contact: contact, is_current: true)
      next if existing

      company.corporate_directors.find_or_create_by!(
        contact: contact,
        position: dir_data[:position],
        appointment_date: dir_data[:date] || company.date_incorporated,
        is_current: true
      )
    end

    # Link shareholdings
    shareholdings_data.each do |share_data|
      next if share_data[:name].blank? || share_data[:shares].to_i.zero?

      # Try to find shareholder as a company first, then as a contact
      shareholder = Corporate.find_by("LOWER(name) LIKE ?", "%#{share_data[:name].downcase}%")
      shareholder ||= Contact.find_by("LOWER(display_name) LIKE ?", "%#{share_data[:name].downcase}%")

      next unless shareholder

      existing = company.corporate_shareholdings.find_by(shareholder: shareholder)
      next if existing

      company.corporate_shareholdings.create!(
        shareholder: shareholder,
        number_of_shares: share_data[:shares],
        share_class: "ordinary",
        acquired_date: company.date_incorporated,
        beneficially_held: share_data[:beneficially_held] || false
      )
    end

    @import_log << "Enriched company: #{company.name}"
  end

  def import_companies
    count = 0
    sheet = @spreadsheet.sheet("All Companies")

    return 0 unless sheet.present?

    # Skip header row
    (2..sheet.last_row).each do |row_num|
      row = sheet.row(row_num)

      next if row[0].blank? # Skip if company name is blank

      company_data = {
        name: row[0],
        company_group: map_group(row[1]),
        acn: clean_acn(row[2]),
        abn: clean_abn(row[3]),
        tfn: row[4],
        date_incorporated: parse_date(row[5]),
        registered_office_address: row[6],
        principal_place_of_business: row[7],
        is_trustee: parse_boolean(row[8]),
        trust_name: row[9],
        gst_registration_status: row[10],
        accounting_method: row[11],
        shares_on_issue: row[12]&.to_i,
        status: "active"
      }

      company = Corporate.create!(company_data)
      count += 1

      @import_log << "Imported company: #{company.name}"
    rescue StandardError => e
      @errors << "Row #{row_num}: Failed to import company - #{e.message}"
    end

    count
  end

  def import_directors
    count = 0
    sheet = @spreadsheet.sheet("Director Details")

    return 0 unless sheet.present?

    # Skip header row
    (2..sheet.last_row).each do |row_num|
      row = sheet.row(row_num)

      next if row[0].blank? # Skip if name is blank

      # Find or create contact
      contact = Contact.find_or_initialize_by(
        first_name: row[0],
        last_name: row[1]
      )

      contact.assign_attributes(
        display_name: "#{row[0]} #{row[1]}",
        email: row[2],
        mobile_phone: row[3],
        date_of_birth: parse_date(row[4]),
        # Note: place_of_birth, birth_state, birth_country, current_residential_address,
        # passport_number, drivers_license_number columns were removed as unused
        director_id: row[9]
      )

      contact.save!
      count += 1

      @import_log << "Imported director: #{contact.display_name}"
    rescue StandardError => e
      @errors << "Row #{row_num}: Failed to import director - #{e.message}"
    end

    count
  end

  def import_bank_accounts
    count = 0
    sheet = @spreadsheet.sheet("Bank Accounts")

    return 0 unless sheet.present?

    # Skip header row
    (2..sheet.last_row).each do |row_num|
      row = sheet.row(row_num)

      next if row[0].blank? # Skip if company name is blank

      # Find company by name
      company = Corporate.find_by(name: row[0])

      unless company
        @errors << "Row #{row_num}: Company not found - #{row[0]}"
        next
      end

      account_data = {
        company: company,
        institution_name: row[1],
        bsb: clean_bsb(row[2]),
        account_number: row[3]&.to_s,
        account_name: row[4],
        description: row[5],
        date_opened: parse_date(row[6]),
        date_closed: parse_date(row[7]),
        status: row[7].present? ? "closed" : "active"
      }

      BankAccount.create!(account_data)
      count += 1

      @import_log << "Imported bank account for #{company.name}"
    rescue StandardError => e
      @errors << "Row #{row_num}: Failed to import bank account - #{e.message}"
    end

    count
  end

  def import_shareholdings
    count = 0

    # This would import from individual company sheets
    # For now, return 0 as this requires more complex logic
    # to iterate through individual company sheets

    count
  end

  # Helper methods

  def clean_acn(value)
    return nil if value.blank?
    value.to_s.gsub(/[^0-9]/, "")
  end

  def clean_abn(value)
    return nil if value.blank?
    value.to_s.gsub(/[^0-9]/, "")
  end

  def clean_bsb(value)
    return nil if value.blank?
    value.to_s.gsub(/[^0-9]/, "")
  end

  def parse_date(value)
    return nil if value.blank?

    if value.is_a?(Date)
      value
    elsif value.is_a?(String)
      Date.parse(value) rescue nil
    else
      nil
    end
  end

  def parse_boolean(value)
    return false if value.blank?

    case value.to_s.downcase
    when "yes", "true", "1", "y"
      true
    else
      false
    end
  end

  def map_group(value)
    return nil if value.blank?

    # Map Excel group names to database values
    case value.to_s.downcase
    when "tekna"
      "tekna"
    when "team harder"
      "team_harder"
    when "promise"
      "promise"
    when "charity"
      "charity"
    else
      "other"
    end
  end
end
