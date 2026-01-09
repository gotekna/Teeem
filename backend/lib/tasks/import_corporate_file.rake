namespace :corporate do
  desc "Import corporate structure from Corporate File.xlsx spreadsheet"
  task import: :environment do
    require "roo"

    file_path = ENV["FILE_PATH"] || "/Users/robertharder/GitHub/teeem/Corporate File.xlsx"

    unless File.exist?(file_path)
      puts "ERROR: File not found at #{file_path}"
      puts "Set FILE_PATH environment variable to specify location"
      exit 1
    end

    puts "=" * 80
    puts "CORPORATE FILE IMPORT"
    puts "=" * 80
    puts "File: #{file_path}"
    puts ""

    spreadsheet = Roo::Spreadsheet.open(file_path)
    results = {
      companies_created: 0,
      companies_updated: 0,
      shareholdings_created: 0,
      contacts_created: 0,
      errors: []
    }

    # Map sheet names to company groups (each sheet is a company)
    company_sheets = {
      # Tekna Group
      "Tekna" => "Tekna",
      "Tekna Drafting" => "Tekna",
      "Tekna Admin" => "Tekna",
      "Tekna Homes" => "Tekna",
      "Co Invest Capital" => "Tekna",
      "Co Invest Homes" => "Tekna",
      # Team Harder Group
      "Team Harder" => "Team Harder",
      "Gen2612" => "Team Harder",
      "Prov1322" => "Team Harder",
      "W2G" => "Team Harder",
      "Team Harder Family Trust" => "Team Harder",
      # Team Harder Super Fund
      "THSI" => "Team Harder Super Fund",
      "Team Harder Super Fund" => "Team Harder Super Fund",
      # Promise Group
      "The Promise QLD PTY LTD" => "Promise",
      "The Promise Family Trust" => "Promise"
    }

    # Process each company sheet
    company_sheets.each do |sheet_name, group_name|
      next unless spreadsheet.sheets.include?(sheet_name)

      puts "\n" + "=" * 80
      puts "Processing: #{sheet_name} (#{group_name} Group)"
      puts "=" * 80

      sheet = spreadsheet.sheet(sheet_name)
      company_group = CompanyGroup.find_by(name: group_name)

      unless company_group
        puts "WARNING: Company group '#{group_name}' not found, creating..."
        company_group = CompanyGroup.create!(name: group_name, active: true)
      end

      # Parse the company data from this sheet
      company_data = parse_company_sheet(sheet, sheet_name)

      if company_data[:name].present?
        import_company(company_data, company_group, results)
      else
        puts "  WARNING: Could not find company name in sheet"
      end
    end

    # After all imports, set parent company relationships
    puts "\n" + "=" * 80
    puts "SETTING PARENT COMPANY RELATIONSHIPS"
    puts "=" * 80
    set_parent_relationships(results)

    # Print summary
    puts "\n" + "=" * 80
    puts "IMPORT SUMMARY"
    puts "=" * 80
    puts "Companies created: #{results[:companies_created]}"
    puts "Companies updated: #{results[:companies_updated]}"
    puts "Shareholdings created: #{results[:shareholdings_created]}"
    puts "Contacts created: #{results[:contacts_created]}"

    if results[:errors].any?
      puts "\nErrors (#{results[:errors].count}):"
      results[:errors].first(20).each { |e| puts "  - #{e}" }
      puts "  ... and #{results[:errors].count - 20} more" if results[:errors].count > 20
    end
  end

  desc "Preview corporate file structure without importing"
  task preview: :environment do
    require "roo"

    file_path = ENV["FILE_PATH"] || "/Users/robertharder/GitHub/teeem/Corporate File.xlsx"
    spreadsheet = Roo::Spreadsheet.open(file_path)

    puts "Sheets in spreadsheet:"
    spreadsheet.sheets.each_with_index do |sheet_name, idx|
      sheet = spreadsheet.sheet(sheet_name)
      puts "  #{idx + 1}. #{sheet_name} (#{sheet.last_row} rows)"
    end
  end

  # Helper methods

  def parse_company_sheet(sheet, sheet_name)
    data = { name: nil, shareholdings: [], documents: [] }

    # Scan rows to find data based on labels in column A/B
    (1..sheet.last_row).each do |row|
      row_data = sheet.row(row)
      next if row_data.compact.empty?

      # First column usually has the label
      col_a = row_data[0].to_s.strip
      col_b = row_data[1].to_s.strip
      col_c = row_data[2].to_s.strip
      col_d = row_data[3].to_s.strip
      col_e = row_data[4].to_s.strip
      col_f = row_data[5].to_s.strip

      # Company name is often in row 3, column C (big header cell)
      if row <= 5 && col_c.match?(/pty\s*ltd|trust|fund/i) && col_c.length > 10
        data[:name] = col_c.strip
        next
      end

      # Also check column B for company name
      if row <= 5 && col_b.match?(/pty\s*ltd|trust|fund/i) && col_b.length > 10
        data[:name] = col_b.strip
        next
      end

      label = col_a.downcase

      case label
      when /^acn/
        data[:acn] = extract_number(col_b.presence || col_c)
        # ABN might be on same row
        if col_c.downcase.include?("abn") || col_d.to_s.length == 11
          data[:abn] = extract_number(col_d.presence || col_e)
        end
      when /^abn/
        data[:abn] = extract_number(col_b.presence || col_c)
      when /^tfn/
        data[:tfn] = extract_number(col_b)
      when /^date\s*incorporated/
        data[:date_incorporated] = parse_date(col_b)
        # Shares on issue might be on same row (column E/F)
        if col_e.to_s.downcase.include?("shares") || col_f.to_i > 0
          data[:shares_on_issue] = col_f.to_i if col_f.to_i > 0
        end
      when /^purpose/
        data[:purpose] = col_b
      when /^trust\s*name|^trustee/
        data[:trust_name] = col_b if col_b.present?
      when /^is\s*it\s*a\s*trustee/
        data[:is_trustee] = col_b.downcase == "yes" || col_e.to_s.downcase == "yes"
      when /^registered\s*office/
        data[:registered_office_address] = col_b
        # Principal place might be on same row
        if col_e.to_s.downcase.include?("principal")
          data[:principal_place_of_business] = col_f
        end
      when /^principal\s*place/
        data[:principal_place_of_business] = col_b
      when /^current\s*director/
        data[:director_name] = col_b
        data[:director_from] = parse_date(col_c)
      when /^current\s*secretary/
        data[:secretary_name] = col_b
        data[:secretary_from] = parse_date(col_c)
      when /^shares\s*on\s*issue/
        data[:shares_on_issue] = col_b.to_i if col_b.to_i > 0
        data[:shares_on_issue] = col_f.to_i if col_f.to_i > 0 && data[:shares_on_issue].to_i == 0
      when /^does\s*this\s*company\s*have\s*loans/
        data[:has_loans] = col_b.downcase == "yes"
        # Loan docs might be on same row
        if col_e.to_s.downcase.include?("loan") && col_e.to_s.downcase.include?("document")
          data[:loan_documents_in_place] = col_f.to_s.downcase == "yes"
        end
      when /^is\s*there\s*loan\s*documents/
        data[:loan_documents_in_place] = col_b.downcase == "yes"
      when /^current\s*shareholdings/
        # Parse shareholding rows that follow
        data[:shareholdings] = parse_shareholdings_section(sheet, row)
      when /^folder\s*storage/
        data[:sharepoint_folder_name] = col_b
        # Abbreviation might be on same row
        if col_c.to_s.downcase.include?("abbreviation")
          data[:code] = col_d.upcase if col_d.present?
        end
      when /^abbreviation/
        data[:code] = col_b.upcase if col_b.present?
        data[:code] = col_d.upcase if col_d.present? && data[:code].blank?
      end
    end

    # If no name found, use sheet name to construct it
    if data[:name].blank?
      data[:name] = case sheet_name
      when "Tekna" then "Tekna Pty Ltd"
      when "Tekna Drafting" then "Tekna Drafting Pty Ltd"
      when "Tekna Admin" then "Tekna Admin Pty Ltd"
      when "Tekna Homes" then "Tekna Homes Pty Ltd"
      when "Co Invest Capital" then "Co Invest Capital Pty Ltd"
      when "Co Invest Homes" then "Co Invest Homes Pty Ltd"
      when "Team Harder" then "Team Harder Pty Ltd"
      when "Gen2612" then "Gen2612 Pty Ltd"
      when "Prov1322" then "Prov1322 Global Pty Ltd"
      when "W2G" then "W2G Assets Pty Ltd"
      when "THSI" then "Team Harder Super Investments Pty Ltd"
      when "The Promise QLD PTY LTD" then "The Promise QLD Pty Ltd"
      else sheet_name
      end
    end

    data
  end

  def parse_shareholdings_section(sheet, start_row)
    shareholdings = []

    # Look for shareholding data in rows after "Current Shareholdings"
    ((start_row + 1)..(start_row + 15)).each do |row|
      break if row > sheet.last_row

      row_data = sheet.row(row)

      # Skip empty rows
      next if row_data.compact.empty?

      col_a = row_data[0].to_s.strip
      col_b = row_data[1].to_s.strip
      col_c = row_data[2].to_s.strip
      col_d = row_data[3].to_s.strip
      col_e = row_data[4].to_s.strip
      col_f = row_data[5].to_s.strip

      # Stop if we hit a new section
      break if col_a.downcase.include?("bank")
      break if col_a.downcase.include?("folder")
      break if col_a.downcase.include?("company register")

      # Skip header row
      next if col_d.to_s.downcase.include?("shares")
      next if col_e.to_s.downcase.include?("beneficially")

      # Shareholder name is usually in column B or C
      shareholder_name = col_b.presence || col_c
      next if shareholder_name.blank?
      next if shareholder_name.downcase.include?("shareholding")

      # Find shares (column D or E) and beneficially held (column E or F)
      shares = nil
      beneficially_held = false

      [ col_c, col_d, col_e ].each do |val|
        if val.is_a?(Numeric) || (val.to_s =~ /^\d+$/)
          shares = val.to_i if shares.nil? && val.to_i > 0 && val.to_i < 1_000_000
        end
      end

      [ col_e, col_f ].each do |val|
        if val.to_s.downcase == "yes"
          beneficially_held = true
        end
      end

      if shareholder_name.present? && shares.present? && shares > 0
        shareholdings << {
          name: shareholder_name,
          shares: shares,
          beneficially_held: beneficially_held
        }
      end
    end

    shareholdings
  end

  def find_company_name(sheet, start_row)
    # Company name is usually in a header row with styling
    # Look for cells that contain company-like names
    (0..10).each do |col_offset|
      cell = sheet.cell(start_row, col_offset + 1)
      next unless cell.is_a?(String)

      # Check if this looks like a company name
      if cell.match?(/pty\s*ltd|trust|family|super\s*fund/i) && cell.length > 5
        return cell.strip
      end
    end
    nil
  end

  def parse_company_section(sheet, start_row, company_name)
    data = { name: company_name, shareholdings: [], documents: [] }

    # Scan rows below the company name to find data
    (start_row..(start_row + 50)).each do |row|
      break if row > sheet.last_row

      row_data = sheet.row(row)
      label = row_data[0].to_s.strip.downcase

      case label
      when /^acn/
        data[:acn] = extract_number(row_data[1])
      when /^abn/
        data[:abn] = extract_number(row_data[2] || row_data[1])
      when /^tfn/
        data[:tfn] = extract_number(row_data[1])
      when /^date\s*incorporated/
        data[:date_incorporated] = parse_date(row_data[1])
      when /^purpose/
        data[:purpose] = row_data[1].to_s.strip
      when /^trust\s*name|trustee/
        data[:trust_name] = row_data[1].to_s.strip
        data[:is_trustee] = true if row_data[0].to_s.downcase.include?("trustee")
      when /^is\s*it\s*a\s*trustee/
        data[:is_trustee] = row_data[1].to_s.strip.downcase == "yes"
      when /^registered\s*office/
        data[:registered_office_address] = row_data[1].to_s.strip
      when /^principal\s*place/
        data[:principal_place_of_business] = row_data[1].to_s.strip
      when /^current\s*director/
        data[:director_name] = row_data[1].to_s.strip
        data[:director_from] = parse_date(row_data[2])
      when /^current\s*secretary/
        data[:secretary_name] = row_data[1].to_s.strip
        data[:secretary_from] = parse_date(row_data[2])
      when /^shares\s*on\s*issue/
        data[:shares_on_issue] = row_data[1].to_i
      when /^does\s*this\s*company\s*have\s*loans/
        data[:has_loans] = row_data[1].to_s.strip.downcase == "yes"
      when /^is\s*there\s*loan\s*documents/
        data[:loan_documents_in_place] = row_data[1].to_s.strip.downcase == "yes"
      when /^current\s*shareholdings/
        # Parse shareholding rows that follow
        data[:shareholdings] = parse_shareholdings(sheet, row)
      when /^folder\s*storage/
        data[:sharepoint_folder_name] = row_data[1].to_s.strip
        data[:code] = row_data[3].to_s.strip.upcase if row_data[3].present?
      when /^abbreviation/
        data[:code] = row_data[1].to_s.strip.upcase if row_data[1].present?
      when /^company\s*register/
        # Start of documents section - could parse if needed
        break
      end

      # Stop if we hit another company section
      next_company = find_company_name(sheet, row + 1)
      break if next_company.present? && next_company != company_name
    end

    data
  end

  def parse_shareholdings(sheet, start_row)
    shareholdings = []

    # Look for shareholding data in rows after "Current Shareholdings"
    (start_row..(start_row + 20)).each do |row|
      break if row > sheet.last_row

      row_data = sheet.row(row)

      # Skip header rows
      next if row_data[0].to_s.downcase.include?("shareholding")
      next if row_data[0].to_s.downcase.include?("shares")
      next if row_data[0].to_s.strip.empty? && row_data[1].to_s.strip.empty?

      # Check if this row has shareholding data (shareholder name in column B or C)
      shareholder_name = row_data[1].to_s.strip
      shareholder_name = row_data[2].to_s.strip if shareholder_name.empty?

      next if shareholder_name.empty?
      next if shareholder_name.downcase.include?("bank")  # Skip bank account rows

      # Find shares count (usually column D or E)
      shares = nil
      beneficially_held = false

      row_data.each_with_index do |cell, idx|
        if cell.is_a?(Numeric) && cell > 0 && cell < 1_000_000
          shares = cell.to_i
        end
        if cell.to_s.downcase == "yes" || cell.to_s.downcase == "no"
          beneficially_held = cell.to_s.downcase == "yes"
        end
      end

      if shareholder_name.present? && shares.present?
        shareholdings << {
          name: shareholder_name,
          shares: shares,
          beneficially_held: beneficially_held
        }
      end

      # Stop if we hit another section
      break if row_data[0].to_s.downcase.include?("bank")
    end

    shareholdings
  end

  def import_company(data, company_group, results)
    # Find or create company
    company = nil

    if data[:acn].present?
      company = Company.find_by(acn: data[:acn])
    end

    company ||= Company.find_by("LOWER(name) = ?", data[:name].downcase) if data[:name].present?

    if company
      # Update existing
      company.update!(
        company_group: company_group,
        abn: data[:abn],
        date_incorporated: data[:date_incorporated],
        purpose: data[:purpose],
        is_trustee: data[:is_trustee],
        trust_name: data[:trust_name],
        registered_office_address: data[:registered_office_address],
        principal_place_of_business: data[:principal_place_of_business],
        shares_on_issue: data[:shares_on_issue],
        has_loans: data[:has_loans],
        loan_documents_in_place: data[:loan_documents_in_place],
        sharepoint_folder_name: data[:sharepoint_folder_name],
        code: data[:code]
      )
      results[:companies_updated] += 1
      puts "  Updated: #{company.name}"
    else
      # Create new
      company = Company.create!(
        name: data[:name],
        acn: data[:acn],
        abn: data[:abn],
        status: "active",
        company_group: company_group,
        date_incorporated: data[:date_incorporated],
        purpose: data[:purpose],
        is_trustee: data[:is_trustee],
        trust_name: data[:trust_name],
        registered_office_address: data[:registered_office_address],
        principal_place_of_business: data[:principal_place_of_business],
        shares_on_issue: data[:shares_on_issue],
        has_loans: data[:has_loans],
        loan_documents_in_place: data[:loan_documents_in_place],
        sharepoint_folder_name: data[:sharepoint_folder_name],
        code: data[:code]
      )
      results[:companies_created] += 1
      puts "  Created: #{company.name}"
    end

    # Import shareholdings
    import_shareholdings(company, data[:shareholdings], results)

  rescue => e
    results[:errors] << "Error importing #{data[:name]}: #{e.message}"
    puts "  ERROR: #{e.message}"
  end

  def import_shareholdings(company, shareholdings, results)
    return if shareholdings.blank?

    shareholdings.each do |sh_data|
      # Find or create shareholder (Company or Contact)
      shareholder = find_or_create_shareholder(sh_data[:name], results)

      next unless shareholder

      # Find or create shareholding
      shareholding = CompanyShareholding.find_or_initialize_by(
        company: company,
        shareholder: shareholder,
        share_class: "ordinary"
      )

      shareholding.update!(
        number_of_shares: sh_data[:shares],
        beneficially_held: sh_data[:beneficially_held]
      )

      results[:shareholdings_created] += 1 if shareholding.previously_new_record?
      puts "    Shareholding: #{sh_data[:name]} - #{sh_data[:shares]} shares"
    end
  end

  def find_or_create_shareholder(name, results)
    return nil if name.blank?

    # Check if it's a company (contains Pty Ltd, Trust, etc.)
    if name.match?(/pty\s*ltd|trust|fund|holdings/i)
      company = Company.find_by("LOWER(name) = ?", name.downcase)
      company ||= Company.find_by("LOWER(name) LIKE ?", "%#{name.downcase.gsub(/\s+/, '%')}%")

      unless company
        # Create placeholder company
        company = Company.create!(
          name: name,
          status: "active"
        )
        results[:companies_created] += 1
        puts "    Created placeholder company: #{name}"
      end

      company
    else
      # It's a person - find or create contact
      name_parts = name.split(" ")
      first_name = name_parts.first
      last_name = name_parts[1..].join(" ")

      contact = Contact.find_by("LOWER(first_name) = ? AND LOWER(last_name) = ?", first_name.downcase, last_name.downcase)

      unless contact
        contact = Contact.create!(
          first_name: first_name,
          last_name: last_name,
          contact_type: "individual"
        )
        results[:contacts_created] += 1
        puts "    Created contact: #{name}"
      end

      contact
    end
  end

  def set_parent_relationships(results)
    Company.find_each do |company|
      next if company.shares_on_issue.to_i.zero?

      # Find company shareholders with 100% ownership
      company_shareholders = company.company_shareholdings.where(shareholder_type: "Company")

      company_shareholders.each do |sh|
        percentage = (sh.number_of_shares.to_f / company.shares_on_issue * 100).round(2)

        if percentage >= 100
          parent = Company.find(sh.shareholder_id)

          # Only set parent if in same group or related group
          if parent.company_group_id == company.company_group_id || parent.company_group.nil?
            company.update!(
              parent_company_id: parent.id,
              hierarchy_level: (parent.hierarchy_level || 0) + 1
            )
            puts "  #{company.name} -> parent: #{parent.name}"
          end
        end
      end
    end
  end

  def extract_number(value)
    return nil unless value.present?
    value.to_s.gsub(/[^0-9]/, "")
  end

  def parse_date(value)
    return nil unless value.present?

    case value
    when Date, DateTime, Time
      value.to_date
    when Numeric
      # Excel date serial number
      Date.new(1899, 12, 30) + value.to_i
    when String
      begin
        Date.parse(value)
      rescue
        nil
      end
    end
  end
end
