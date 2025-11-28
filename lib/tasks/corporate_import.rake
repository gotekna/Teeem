require 'roo'

namespace :corporate do
  desc "Import corporate data from Corporate File.xlsx"
  task import: :environment do
    file_path = Rails.root.join('..', 'Corporate File.xlsx')

    unless File.exist?(file_path)
      puts "ERROR: Corporate File.xlsx not found at #{file_path}"
      exit 1
    end

    xlsx = Roo::Excelx.new(file_path.to_s)
    puts "Opened Corporate File.xlsx with sheets: #{xlsx.sheets.join(', ')}"

    # Step 1: Create Company Groups
    puts "\n=== Step 1: Creating Company Groups ==="
    create_company_groups(xlsx)

    # Step 2: Import Directors as Contacts
    puts "\n=== Step 2: Importing Directors as Contacts ==="
    import_directors(xlsx)

    # Step 3: Import Companies from All Companies sheet
    puts "\n=== Step 3: Importing Companies ==="
    import_companies_summary(xlsx)

    # Step 4: Import detailed company data from individual sheets
    puts "\n=== Step 4: Importing Company Details ==="
    import_company_details(xlsx)

    # Step 5: Import Bank Accounts
    puts "\n=== Step 5: Importing Bank Accounts ==="
    import_bank_accounts(xlsx)

    puts "\n=== Import Complete ==="
    puts "Company Groups: #{CompanyGroup.count}"
    puts "Contacts (Directors): #{Contact.where.not(director_id: nil).count}"
    puts "Companies: #{Company.count}"
    puts "Company Directors: #{CompanyDirector.count}"
    puts "Company Shareholdings: #{CompanyShareholding.count}"
    puts "Bank Accounts: #{BankAccount.count}"
  end

  def create_company_groups(xlsx)
    groups = [
      { name: 'Tekna', description: 'Tekna Group companies' },
      { name: 'Team Harder', description: 'Team Harder Group companies' },
      { name: 'Team Harder Super Fund', description: 'Team Harder Super Fund Group' },
      { name: 'Promise', description: 'Promise Group companies' },
      { name: 'Charity', description: 'Charity organisations' },
      { name: 'Personal', description: 'Personal entities' }
    ]

    groups.each do |g|
      group = CompanyGroup.find_or_create_by!(name: g[:name]) do |cg|
        cg.description = g[:description]
        cg.active = true
      end
      puts "  Created/found: #{group.name}"
    end
  end

  def import_directors(xlsx)
    sheet = xlsx.sheet('Director Details')
    headers = sheet.row(1).map { |h| h.to_s.strip.downcase.gsub(/\s+/, '_') }

    (2..sheet.last_row).each do |row_num|
      row = Hash[headers.zip(sheet.row(row_num))]
      next if row['given_names'].blank? && row['family_name'].blank?

      given_names = row['given_names'].to_s.strip
      family_name = row['family_name'].to_s.strip
      next if given_names.blank?

      full_name = "#{given_names} #{family_name}".strip

      contact = Contact.find_or_initialize_by(full_name: full_name)
      contact.assign_attributes(
        first_name: given_names.split.first,
        last_name: family_name,
        full_name: full_name,
        mobile_phone: row['director_mobile'].to_s.strip.presence,
        drivers_licence: row['drivers_licence'].to_s.strip.presence,
        date_of_birth: parse_date(row['date_of_birth']),
        place_of_birth: row['place_of_birth'].to_s.strip.presence,
        birth_state: row['state'].to_s.strip.presence,
        birth_country: row['country'].to_s.strip.presence,
        residential_address: row['residential_address'].to_s.strip.presence,
        director_id: row['directors_id'].to_s.strip.presence,
        # tfn: row['tfn'].to_s.gsub(/\s/, '').presence,  # Skip TFN - needs encryption setup
        entity_type: 'person',
        is_active: true
      )

      if contact.save
        puts "  Created/updated director: #{full_name}"
      else
        puts "  ERROR: #{full_name} - #{contact.errors.full_messages.join(', ')}"
      end
    end
  end

  def import_companies_summary(xlsx)
    sheet = xlsx.sheet('All Companies')
    headers = sheet.row(1).map { |h| h.to_s.strip.downcase.gsub(/\s+/, '_') }

    (2..sheet.last_row).each do |row_num|
      row = Hash[headers.zip(sheet.row(row_num))]
      company_name = row['company'].to_s.strip
      next if company_name.blank?

      group_name = row['group'].to_s.strip
      group = CompanyGroup.find_by(name: group_name) ||
              CompanyGroup.find_by("name ILIKE ?", "%#{group_name.split.first}%")

      acn = row['acn'].to_s.gsub(/\s/, '')
      abn = row['abn'].to_s.gsub(/\s/, '')
      tfn = row['tfn'].to_s.gsub(/\s/, '')

      company = Company.find_or_initialize_by(name: company_name)
      company.assign_attributes(
        company_group: group,
        acn: acn.presence,
        abn: abn.presence,
        # tfn: tfn.presence,  # Skip TFN - needs encryption setup
        review_date: parse_date(row['review_date']),
        corporate_key: row['corporate_key'].to_s.strip.presence,
        asic_username: row['user_name'].to_s.strip.presence,
        # encrypted_asic_password: row['password'].to_s.strip.presence,  # Skip - needs encryption setup
        recovery_question: row['recovery_question'].to_s.strip.presence,
        # encrypted_recovery_answer: row['answer'].to_s.strip.presence,  # Skip - needs encryption setup
        status: 'active'
      )

      if company.save
        puts "  Created/updated: #{company_name}"

        # Link director if specified
        director_name = row['director'].to_s.strip
        if director_name.present?
          director = Contact.find_by("full_name ILIKE ?", "%#{director_name}%")
          if director
            cd = CompanyDirector.find_or_initialize_by(company: company, contact: director)
            cd.position = 'director'
            cd.is_current = true
            if cd.save
              puts "    Linked director: #{director_name}"
            else
              puts "    ERROR linking director #{director_name}: #{cd.errors.full_messages.join(', ')}"
            end
          end
        end
      else
        puts "  ERROR: #{company_name} - #{company.errors.full_messages.join(', ')}"
      end
    end
  end

  def import_company_details(xlsx)
    # Company sheets that follow the template format
    company_sheets = xlsx.sheets.select do |sheet_name|
      # Skip summary/reference sheets
      !['All Companies', 'Document Type', 'Bank Accounts ', 'XERO Account Numbers',
        'Sheet1', 'Sheet2', 'Director Details', 'Director Details (2)', 'Rachel Directorship',
        'Logon', 'Insurance Cover', 'Wages', 'Balance Sheet Reconcile', 'Template',
        'StatementImportTemplate.en-US', '2022 Charity (2)', '2022 Team Harder (2)',
        ' Team Plug', ' Tekna Group', ' Team Harder', ' Charity', 'SVL', 'Tekna Models'].include?(sheet_name)
    end

    company_sheets.each do |sheet_name|
      puts "  Processing sheet: #{sheet_name}"
      import_company_from_sheet(xlsx, sheet_name)
    end
  end

  def import_company_from_sheet(xlsx, sheet_name)
    sheet = xlsx.sheet(sheet_name)

    # Find company name (usually row 3, column B)
    company_name = nil
    (1..10).each do |row|
      (1..3).each do |col|
        val = sheet.cell(row, col).to_s.strip
        if val.present? && val.length > 5 && !val.match?(/^(All Companies|ACN|ABN|TFN|Date|Purpose|Trust|Registered|Current|Does)/i)
          company_name = val.gsub(/\s*(Pty Ltd|Ltd|ATF.*|Pty)?\s*$/i, '').strip + ' Pty Ltd'
          break
        end
      end
      break if company_name.present?
    end

    return unless company_name.present?

    company = Company.find_by("name ILIKE ?", "%#{company_name.gsub(' Pty Ltd', '')}%")
    return unless company

    # Parse template fields
    data = parse_company_template(sheet)

    # Update company with detailed data
    company.update(
      purpose: data[:purpose],
      shares_on_issue: data[:shares_on_issue].to_i.positive? ? data[:shares_on_issue].to_i : nil,
      is_trustee: data[:is_trustee] == 'Yes',
      trust_name: data[:trust_name],
      registered_office_address: data[:registered_office],
      principal_place_of_business: data[:principal_place],
      abbreviation: data[:abbreviation]
    )

    # Import shareholdings
    if data[:shareholdings].present?
      data[:shareholdings].each do |sh|
        next if sh[:name].blank?

        # Find or create shareholder contact
        shareholder = Contact.find_or_create_by!(full_name: sh[:name]) do |c|
          c.first_name = sh[:name].split.first
          c.last_name = sh[:name].split[1..-1]&.join(' ')
          c.entity_type = sh[:name].include?('Pty') || sh[:name].include?('Trust') ? 'company' : 'person'
          c.is_active = true
        end

        shareholding = CompanyShareholding.find_or_initialize_by(
          company: company,
          shareholder: shareholder,
          share_class: sh[:share_class] || 'ordinary'
        )
        shareholding.number_of_shares = sh[:shares].to_i.positive? ? sh[:shares].to_i : 1
        shareholding.beneficially_held = sh[:beneficially_held] == 'Yes'
        shareholding.beneficial_owner = sh[:beneficial_owner]
        shareholding.save
        puts "    Added shareholding: #{sh[:name]} - #{sh[:shares]} shares"
      end
    end

    # Import directors from sheet
    if data[:directors].present?
      data[:directors].each do |dir|
        next if dir[:name].blank?

        director = Contact.find_by("full_name ILIKE ?", "%#{dir[:name]}%")
        next unless director

        cd = CompanyDirector.find_or_initialize_by(company: company, contact: director)
        # Convert position to lowercase format expected by validation
        cd.position = (dir[:position] || 'director').to_s.downcase.gsub(' ', '_')
        cd.appointment_date = parse_date(dir[:from_date])
        cd.is_current = true
        if cd.save
          puts "    Linked director: #{dir[:name]}"
        else
          puts "    ERROR linking director #{dir[:name]}: #{cd.errors.full_messages.join(', ')}"
        end
      end
    end

    puts "    Updated: #{company.name}"
  end

  def parse_company_template(sheet)
    data = {
      shareholdings: [],
      directors: []
    }

    (1..sheet.last_row).each do |row|
      row_data = (1..10).map { |col| sheet.cell(row, col).to_s.strip }

      # Parse key-value pairs
      row_data.each_with_index do |cell, idx|
        next_cell = row_data[idx + 1]

        case cell
        when /purpose/i
          data[:purpose] = next_cell if next_cell.present?
        when /shares on issue/i
          data[:shares_on_issue] = next_cell.to_s.gsub(/[^\d]/, '')
        when /is it a trustee/i
          data[:is_trustee] = next_cell
        when /trust name/i
          data[:trust_name] = next_cell if next_cell.present? && !next_cell.match?(/trustee/i)
        when /registered office/i
          data[:registered_office] = next_cell if next_cell.present?
        when /principal place/i
          data[:principal_place] = next_cell if next_cell.present?
        when /abbreviation/i
          data[:abbreviation] = next_cell if next_cell.present?
        when /current director/i
          if next_cell.present? && !next_cell.match?(/^current/i)
            from_date = row_data[idx + 2]
            data[:directors] << { name: next_cell, position: 'Director', from_date: from_date }
          end
        when /current secretary/i
          if next_cell.present? && !next_cell.match?(/^current/i)
            from_date = row_data[idx + 2]
            data[:directors] << { name: next_cell, position: 'Secretary', from_date: from_date }
          end
        when /current shareholdings/i
          # Parse shareholding rows that follow
          # Format: Name, Share Type, Shares, Beneficially Held, Beneficial Owner
        end
      end

      # Check if this is a shareholding row (after "Current Shareholdings" header)
      if row_data[1].present? && !row_data[1].match?(/^(current|does|folder)/i) &&
         (row_data[4].to_s.match?(/^\d+$/) || row_data[3].to_s.match?(/^\d+$/))
        shares = row_data[4].to_s.match?(/^\d+$/) ? row_data[4] : row_data[3]
        data[:shareholdings] << {
          name: row_data[1],
          share_class: row_data[3].to_s.downcase.include?('ordinary') ? 'ordinary' : row_data[3],
          shares: shares,
          beneficially_held: row_data[5].to_s.strip,
          beneficial_owner: row_data[6].to_s.strip.presence
        }
      end
    end

    data
  end

  def import_bank_accounts(xlsx)
    sheet = xlsx.sheet('Bank Accounts ')
    headers = sheet.row(1).map { |h| h.to_s.strip.downcase.gsub(/\s+/, '_') }

    (2..sheet.last_row).each do |row_num|
      row = Hash[headers.zip(sheet.row(row_num))]
      entity_name = row['entity_'].to_s.strip
      next if entity_name.blank?

      # Find the company
      company = Company.find_by("name ILIKE ?", "%#{entity_name}%")
      next unless company

      bsb = row['bsb_'].to_s.gsub(/[^\d-]/, '')
      account_number = row['account_number_'].to_s.gsub(/[^\d]/, '')
      next if account_number.blank?

      bank_account = BankAccount.find_or_initialize_by(
        company: company,
        bsb: bsb,
        account_number: account_number
      )
      bank_account.assign_attributes(
        bank_name: row['institution_'].to_s.strip,
        account_name: entity_name,
        opened_date: parse_date(row['acc_open']),
        closed_date: parse_date(row['acc_close']),
        status: row['acc_close'].present? ? 'closed' : 'active'
      )

      if bank_account.save
        puts "  Created/updated bank account: #{entity_name} - #{bsb} #{account_number}"
      else
        puts "  ERROR: #{entity_name} - #{bank_account.errors.full_messages.join(', ')}"
      end
    end
  end

  def parse_date(value)
    return nil if value.blank?

    if value.is_a?(Date) || value.is_a?(DateTime)
      return value.to_date
    end

    str = value.to_s.strip
    return nil if str.blank?

    # Try various date formats
    begin
      Date.parse(str)
    rescue
      begin
        Date.strptime(str, '%d/%m/%Y')
      rescue
        begin
          Date.strptime(str, '%d.%m.%Y')
        rescue
          nil
        end
      end
    end
  end
end
