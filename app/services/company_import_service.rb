class CompanyImportService
  def initialize(file_path)
    @file_path = file_path
    @errors = []
  end

  def import
    companies_count = 0
    directors_count = 0
    bank_accounts_count = 0

    begin
      workbook = Creek::Book.new(@file_path)

      # Import companies
      if companies_sheet = workbook.sheets.find { |s| s.name == 'Companies' }
        companies_count = import_companies(companies_sheet)
      end

      # Import directors
      if directors_sheet = workbook.sheets.find { |s| s.name == 'Directors' }
        directors_count = import_directors(directors_sheet)
      end

      # Import bank accounts
      if bank_accounts_sheet = workbook.sheets.find { |s| s.name == 'Bank Accounts' }
        bank_accounts_count = import_bank_accounts(bank_accounts_sheet)
      end

      {
        success: true,
        message: "Import completed successfully",
        companies_count: companies_count,
        directors_count: directors_count,
        bank_accounts_count: bank_accounts_count,
        errors: @errors
      }
    rescue StandardError => e
      {
        success: false,
        message: "Import failed: #{e.message}",
        errors: @errors
      }
    end
  end

  private

  def import_companies(sheet)
    count = 0
    headers = nil

    sheet.rows.each_with_index do |row, index|
      if index == 0
        headers = row.values.map(&:downcase)
        next
      end

      row_data = Hash[headers.zip(row.values)]

      company = Company.create(
        name: row_data['name'],
        company_group: row_data['group'],
        acn: row_data['acn'],
        abn: row_data['abn'],
        tfn: row_data['tfn'],
        status: row_data['status'] || 'active',
        date_incorporated: parse_date(row_data['date_incorporated']),
        registered_office_address: row_data['registered_office_address'],
        principal_place_of_business: row_data['principal_place_of_business'],
        is_trustee: row_data['is_trustee'] == 'Yes',
        trust_name: row_data['trust_name'],
        gst_registration_status: row_data['gst_status'] || 'not_registered'
      )

      if company.persisted?
        count += 1
      else
        @errors << "Row #{index + 1}: #{company.errors.full_messages.join(', ')}"
      end
    end

    count
  end

  def import_directors(sheet)
    count = 0
    headers = nil

    sheet.rows.each_with_index do |row, index|
      if index == 0
        headers = row.values.map(&:downcase)
        next
      end

      row_data = Hash[headers.zip(row.values)]

      # Find or create contact
      contact = Contact.find_or_create_by(email: row_data['email']) do |c|
        c.first_name = row_data['first_name']
        c.last_name = row_data['last_name']
        c.is_director = true
        c.director_tfn = row_data['tfn']
        c.director_date_of_birth = parse_date(row_data['date_of_birth'])
      end

      # Find company by name or ACN
      company = Company.find_by(name: row_data['company_name']) ||
                Company.find_by(acn: row_data['company_acn'])

      next unless company

      # Create director relationship
      director = CompanyDirector.create(
        company: company,
        contact: contact,
        position: row_data['position'] || 'Director',
        appointment_date: parse_date(row_data['appointment_date']),
        resignation_date: parse_date(row_data['resignation_date']),
        is_current: row_data['resignation_date'].blank?
      )

      if director.persisted?
        count += 1
      else
        @errors << "Row #{index + 1}: #{director.errors.full_messages.join(', ')}"
      end
    end

    count
  end

  def import_bank_accounts(sheet)
    count = 0
    headers = nil

    sheet.rows.each_with_index do |row, index|
      if index == 0
        headers = row.values.map(&:downcase)
        next
      end

      row_data = Hash[headers.zip(row.values)]

      # Find company
      company = Company.find_by(name: row_data['company_name']) ||
                Company.find_by(acn: row_data['company_acn'])

      next unless company

      bank_account = BankAccount.create(
        company: company,
        account_name: row_data['account_name'],
        bank_name: row_data['bank_name'],
        bsb: row_data['bsb'],
        account_number: row_data['account_number'],
        account_type: row_data['account_type'],
        is_primary: row_data['is_primary'] == 'Yes'
      )

      if bank_account.persisted?
        count += 1
      else
        @errors << "Row #{index + 1}: #{bank_account.errors.full_messages.join(', ')}"
      end
    end

    count
  end

  def parse_date(date_value)
    return nil if date_value.blank?

    case date_value
    when Date, DateTime, Time
      date_value.to_date
    when String
      Date.parse(date_value) rescue nil
    when Numeric
      # Excel serial date (days since 1900-01-01)
      Date.new(1899, 12, 30) + date_value.to_i
    else
      nil
    end
  end
end
