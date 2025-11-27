class CompanyImportService
  def initialize(file_path)
    @file_path = file_path
    @spreadsheet = Roo::Spreadsheet.open(file_path)
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
      # Import companies
      result[:companies_imported] = import_companies

      # Import directors
      result[:directors_imported] = import_directors

      # Import bank accounts
      result[:bank_accounts_imported] = import_bank_accounts

      # Import shareholdings (if data available)
      result[:shareholdings_imported] = import_shareholdings

      result[:errors] = @errors
    end

    result
  rescue StandardError => e
    Rails.logger.error("Import failed: #{e.message}")
    result[:errors] << "Import failed: #{e.message}"
    result
  end

  private

  def import_companies
    count = 0
    sheet = @spreadsheet.sheet('All Companies')

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
        status: 'active'
      }

      company = Company.create!(company_data)
      count += 1

      @import_log << "Imported company: #{company.name}"
    rescue StandardError => e
      @errors << "Row #{row_num}: Failed to import company - #{e.message}"
    end

    count
  end

  def import_directors
    count = 0
    sheet = @spreadsheet.sheet('Director Details')

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
        full_name: "#{row[0]} #{row[1]}",
        email: row[2],
        mobile_phone: row[3],
        date_of_birth: parse_date(row[4]),
        # Note: place_of_birth, birth_state, birth_country, current_residential_address,
        # passport_number, drivers_license_number columns were removed as unused
        director_id: row[9]
      )

      contact.save!
      count += 1

      @import_log << "Imported director: #{contact.full_name}"
    rescue StandardError => e
      @errors << "Row #{row_num}: Failed to import director - #{e.message}"
    end

    count
  end

  def import_bank_accounts
    count = 0
    sheet = @spreadsheet.sheet('Bank Accounts')

    return 0 unless sheet.present?

    # Skip header row
    (2..sheet.last_row).each do |row_num|
      row = sheet.row(row_num)

      next if row[0].blank? # Skip if company name is blank

      # Find company by name
      company = Company.find_by(name: row[0])

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
        status: row[7].present? ? 'closed' : 'active'
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
    value.to_s.gsub(/[^0-9]/, '')
  end

  def clean_abn(value)
    return nil if value.blank?
    value.to_s.gsub(/[^0-9]/, '')
  end

  def clean_bsb(value)
    return nil if value.blank?
    value.to_s.gsub(/[^0-9]/, '')
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
    when 'yes', 'true', '1', 'y'
      true
    else
      false
    end
  end

  def map_group(value)
    return nil if value.blank?

    # Map Excel group names to database values
    case value.to_s.downcase
    when 'tekna'
      'tekna'
    when 'team harder'
      'team_harder'
    when 'promise'
      'promise'
    when 'charity'
      'charity'
    else
      'other'
    end
  end
end
