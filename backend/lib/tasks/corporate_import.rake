namespace :corporate do
  desc "Import corporate data from Corporate File.xlsx"
  task import: :environment do
    file_path = Rails.root.join("..", "Corporate File.xlsx")

    unless File.exist?(file_path)
      puts "ERROR: Corporate File.xlsx not found at #{file_path}"
      exit 1
    end

    xlsx = TeeemXl::SpreadsheetAdapter.open(file_path.to_s)
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
      { name: "Tekna", description: "Tekna Group companies" },
      { name: "Team Harder", description: "Team Harder Group companies" },
      { name: "Team Harder Super Fund", description: "Team Harder Super Fund Group" },
      { name: "Promise", description: "Promise Group companies" },
      { name: "Charity", description: "Charity organisations" },
      { name: "Personal", description: "Personal entities" }
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
    sheet = xlsx.sheet("Director Details")
    headers = sheet.row(1).map { |h| h.to_s.strip.downcase.gsub(/\s+/, "_") }

    (2..sheet.last_row).each do |row_num|
      row = Hash[headers.zip(sheet.row(row_num))]
      next if row["given_names"].blank? && row["family_name"].blank?

      given_names = row["given_names"].to_s.strip
      family_name = row["family_name"].to_s.strip
      next if given_names.blank?

      full_name = "#{given_names} #{family_name}".strip

      contact = Contact.find_or_initialize_by(full_name: full_name)
      contact.assign_attributes(
        first_name: given_names.split.first,
        last_name: family_name,
        full_name: full_name,
        mobile_phone: row["director_mobile"].to_s.strip.presence,
        drivers_licence: row["drivers_licence"].to_s.strip.presence,
        date_of_birth: parse_date(row["date_of_birth"]),
        place_of_birth: row["place_of_birth"].to_s.strip.presence,
        birth_state: row["state"].to_s.strip.presence,
        birth_country: row["country"].to_s.strip.presence,
        residential_address: row["residential_address"].to_s.strip.presence,
        director_id: row["directors_id"].to_s.strip.presence,
        # tfn: row['tfn'].to_s.gsub(/\s/, '').presence,  # Skip TFN - needs encryption setup
        entity_type: "person",
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
    sheet = xlsx.sheet("All Companies")
    headers = sheet.row(1).map { |h| h.to_s.strip.downcase.gsub(/\s+/, "_") }

    (2..sheet.last_row).each do |row_num|
      row = Hash[headers.zip(sheet.row(row_num))]
      company_name = row["company"].to_s.strip
      next if company_name.blank?

      group_name = row["group"].to_s.strip
      group = CompanyGroup.find_by(name: group_name) ||
              CompanyGroup.find_by("name ILIKE ?", "%#{group_name.split.first}%")

      acn = row["acn"].to_s.gsub(/\s/, "")
      abn = row["abn"].to_s.gsub(/\s/, "")
      tfn = row["tfn"].to_s.gsub(/\s/, "")

      company = Company.find_or_initialize_by(name: company_name)
      company.assign_attributes(
        company_group: group,
        acn: acn.presence,
        abn: abn.presence,
        # tfn: tfn.presence,  # Skip TFN - needs encryption setup
        review_date: parse_date(row["review_date"]),
        corporate_key: row["corporate_key"].to_s.strip.presence,
        asic_username: row["user_name"].to_s.strip.presence,
        # encrypted_asic_password: row['password'].to_s.strip.presence,  # Skip - needs encryption setup
        recovery_question: row["recovery_question"].to_s.strip.presence,
        # encrypted_recovery_answer: row['answer'].to_s.strip.presence,  # Skip - needs encryption setup
        status: "active"
      )

      if company.save
        puts "  Created/updated: #{company_name}"

        # Link director if specified
        director_name = row["director"].to_s.strip
        if director_name.present?
          director = Contact.find_by("full_name ILIKE ?", "%#{director_name}%")
          if director
            cd = CompanyDirector.find_or_initialize_by(company: company, contact: director)
            cd.position = "director"
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
      ![ "All Companies", "Document Type", "Bank Accounts ", "XERO Account Numbers",
        "Sheet1", "Sheet2", "Director Details", "Director Details (2)", "Rachel Directorship",
        "Logon", "Insurance Cover", "Wages", "Balance Sheet Reconcile", "Template",
        "StatementImportTemplate.en-US", "2022 Charity (2)", "2022 Team Harder (2)",
        " Team Plug", " Tekna Group", " Team Harder", " Charity", "SVL", "Tekna Models" ].include?(sheet_name)
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
          company_name = val.gsub(/\s*(Pty Ltd|Ltd|ATF.*|Pty)?\s*$/i, "").strip + " Pty Ltd"
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
      is_trustee: data[:is_trustee] == "Yes",
      trust_name: data[:trust_name],
      registered_office_address: data[:registered_office],
      principal_place_of_business: data[:principal_place],
      code: data[:code]
    )

    # Import shareholdings
    if data[:shareholdings].present?
      data[:shareholdings].each do |sh|
        next if sh[:name].blank?

        # Find or create shareholder contact
        shareholder = Contact.find_or_create_by!(full_name: sh[:name]) do |c|
          c.first_name = sh[:name].split.first
          c.last_name = sh[:name].split[1..-1]&.join(" ")
          c.entity_type = sh[:name].include?("Pty") || sh[:name].include?("Trust") ? "company" : "person"
          c.is_active = true
        end

        shareholding = CompanyShareholding.find_or_initialize_by(
          company: company,
          shareholder: shareholder,
          share_class: sh[:share_class] || "ordinary"
        )
        shareholding.number_of_shares = sh[:shares].to_i.positive? ? sh[:shares].to_i : 1
        shareholding.beneficially_held = sh[:beneficially_held] == "Yes"
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
        cd.position = (dir[:position] || "director").to_s.downcase.gsub(" ", "_")
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

    in_shareholdings_section = false
    in_bank_section = false

    (1..sheet.last_row).each do |row|
      row_data = (1..10).map { |col| sheet.cell(row, col).to_s.strip }
      row_text = row_data.join(" ").downcase

      # Track sections
      if row_text.include?("current shareholdings")
        in_shareholdings_section = true
        in_bank_section = false
        next
      elsif row_text.include?("current bank accounts") || row_text.include?("bank") && row_text.include?("bsb")
        in_shareholdings_section = false
        in_bank_section = true
        next
      elsif row_text.include?("folder storage") || row_text.include?("company register")
        in_shareholdings_section = false
        in_bank_section = false
        next
      end

      # Parse key-value pairs
      row_data.each_with_index do |cell, idx|
        next_cell = row_data[idx + 1]

        case cell
        when /purpose/i
          data[:purpose] = next_cell if next_cell.present?
        when /shares on issue/i
          data[:shares_on_issue] = next_cell.to_s.gsub(/[^\d]/, "")
        when /is it a trustee/i
          data[:is_trustee] = next_cell
        when /trust name/i
          data[:trust_name] = next_cell if next_cell.present? && !next_cell.match?(/trustee/i)
        when /registered office/i
          data[:registered_office] = next_cell if next_cell.present?
        when /principal place/i
          data[:principal_place] = next_cell if next_cell.present?
        when /abbreviation/i
          data[:code] = next_cell if next_cell.present?
        when /current director/i
          if next_cell.present? && !next_cell.match?(/^current/i)
            from_date = row_data[idx + 2]
            data[:directors] << { name: next_cell, position: "Director", from_date: from_date }
          end
        when /current secretary/i
          if next_cell.present? && !next_cell.match?(/^current/i)
            from_date = row_data[idx + 2]
            data[:directors] << { name: next_cell, position: "Secretary", from_date: from_date }
          end
        end
      end

      # Parse shareholdings only in the shareholdings section
      if in_shareholdings_section
        # Name could be in column 2 or 3 depending on layout
        # Check both - prefer column 3 if it looks like a name
        name = nil
        if row_data[2].present? && row_data[2].length > 3 && !row_data[2].match?(/^(shares|beneficially|current|does|bank|\d)/i)
          name = row_data[2]
        elsif row_data[1].present? && row_data[1].length > 3 && !row_data[1].match?(/^(shares|beneficially|current|does|bank|\d)/i)
          name = row_data[1]
        end

        next if name.blank?
        next if name.match?(/^\d{4}-\d{2}-\d{2}/)  # Skip date rows

        # Shares could be in column 4 or 5 depending on layout
        shares = nil
        [ 4, 5, 3 ].each do |col|
          val = row_data[col].to_s.gsub(/[^\d]/, "")
          if val.present? && val.to_i > 0 && val.to_i < 1000000  # Reasonable share count
            shares = val.to_i
            break
          end
        end

        if shares && shares > 0
          # Beneficially held is usually after shares column
          beneficially_held = row_data[5].to_s.strip.downcase
          if beneficially_held.blank?
            beneficially_held = row_data[6].to_s.strip.downcase
          end
          data[:shareholdings] << {
            name: name,
            share_class: "ordinary",
            shares: shares,
            beneficially_held: beneficially_held == "yes" ? "Yes" : "No",
            beneficial_owner: row_data[7].to_s.strip.presence
          }
        end
      end
    end

    data
  end

  def import_bank_accounts(xlsx)
    sheet = xlsx.sheet("Bank Accounts ")

    # Track current entity as some rows inherit from previous
    current_entity = nil

    (2..sheet.last_row).each do |row_num|
      row = (1..8).map { |col| sheet.cell(row_num, col).to_s.strip }
      # Columns: Group, Entity, Institution, BSB, Account Number, Acc Open, Acc Close

      group = row[0]
      entity = row[1]
      institution = row[2]
      bsb = row[3].to_s.gsub(/[^\d]/, "")  # Strip all non-digits
      # Normalize BSB to 6 digits (pad with leading zeros if needed)
      bsb = bsb.rjust(6, "0") if bsb.present? && bsb.length < 6 && bsb.length >= 5
      account_number = row[4].to_s.gsub(/[^\d]/, "")
      acc_open = row[5]
      acc_close = row[6]

      # Update current entity if specified
      current_entity = entity if entity.present?
      next if current_entity.blank?
      next if account_number.blank? || account_number.length < 5

      # Find the company - try various name matches
      search_name = current_entity.gsub(/\s*(Pty Ltd|Ltd|ATF.*|Pty)?\s*$/i, "").strip
      company = Company.find_by("name ILIKE ?", "%#{search_name}%")

      unless company
        # Try first word
        first_word = search_name.split.first
        company = Company.find_by("name ILIKE ?", "%#{first_word}%") if first_word.length > 3
      end

      unless company
        puts "  WARNING: Company not found for '#{current_entity}' - skipping bank account"
        next
      end

      bank_account = BankAccount.find_or_initialize_by(
        company: company,
        bsb: bsb,
        account_number: account_number
      )
      bank_account.assign_attributes(
        institution_name: institution,
        account_name: current_entity,
        date_opened: parse_date(acc_open),
        date_closed: parse_date(acc_close),
        status: acc_close.present? ? "closed" : "active"
      )

      if bank_account.save
        puts "  Created/updated bank account: #{current_entity} - #{bsb} #{account_number}"
      else
        puts "  ERROR: #{current_entity} - #{bank_account.errors.full_messages.join(', ')}"
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
        Date.strptime(str, "%d/%m/%Y")
      rescue
        begin
          Date.strptime(str, "%d.%m.%Y")
        rescue
          nil
        end
      end
    end
  end

  # ==============================
  # DOCUMENT IMPORT TASK
  # ==============================
  desc "Import company documents from Corporate File.xlsx spreadsheet"
  task import_documents: :environment do
    xlsx_path = Rails.root.join("..", "Corporate File.xlsx")
    unless File.exist?(xlsx_path)
      puts "ERROR: Corporate File.xlsx not found at #{xlsx_path}"
      exit 1
    end

    xlsx = TeeemXl::SpreadsheetAdapter.open(xlsx_path.to_s)
    puts "=== Importing Company Documents ==="

    # Map sheet names to company names
    company_sheets = {
      "Tekna" => { name: "Tekna", group: "Tekna Group", folder: "Tekna" },
      "Tekna Admin" => { name: "Tekna Admin Pty LTd", group: "Tekna Group", folder: "Tekna Admin" },
      "Tekna Drafting" => { name: "Tekna Drafting (formerly Rock Invest Qld)", group: "Tekna Group", folder: "Tekna Drafting" },
      "Tekna Homes" => { name: "Tekna Homes formerly Tekna Licence", group: "Tekna Group", folder: "Tekna Homes" },
      "Team Harder" => { name: "Team Harder", group: "Team Harder Group", folder: "Team Harder" },
      "Team Harder Super Fund" => { name: "Team Harder ATF Team Harder Super Fund", group: "Team Harder Super Investment Group", folder: "Team Harder Super Fund" },
      "Gen2612" => { name: "Gen2612", group: "Team Harder Group", folder: "Gen2612" },
      "Prov1322" => { name: "Prov1322 Global", group: "Team Harder Group", folder: "Prov1322 Global" },
      "Team Harder Family Trust" => { name: "Prov1322 Global ATF Team Harder Family Trust", group: "Team Harder Group", folder: "Team Harder Family Trust" },
      "THSI" => { name: "Team Harder Super Investments", group: "Team Harder Super Investment Group", folder: "Team Harder Super Investments" },
      "W2G" => { name: "W2G Assets", group: "Team Harder Super Investment Group", folder: "W2G Assets" },
      "The Promise QLD PTY LTD" => { name: "The Promise QLD Pty Ltd", group: "The Promise Group", folder: "The Promise QLD" },
      "The Promise Family Trust" => { name: "The Promise Family Trust", group: "The Promise Group", folder: "The Promise Family Trust" },
      "Co Invest Capital" => { name: "Co Invest Capital Pty Ltd", group: "Tekna Group", folder: "Co Invest Capital" },
      "Co Invest Homes" => { name: "Co Invest Homes Pty Ltd", group: "Tekna Group", folder: "Co Invest Homes" }
    }

    total_documents = 0
    total_errors = 0

    company_sheets.each do |sheet_name, config|
      company = Company.find_by(name: config[:name])
      unless company
        puts "  Company not found: #{config[:name]}"
        next
      end

      begin
        sheet = xlsx.sheet(sheet_name)
      rescue
        puts "  Sheet not found: #{sheet_name}"
        next
      end

      puts "\n=== #{sheet_name} -> #{config[:name]} ==="

      # Find the Company Register section
      register_row = nil
      folder_storage = nil
      company_code = nil

      (1..50).each do |row|
        row_data = (1..10).map { |col| sheet.cell(row, col).to_s.strip }
        row_text = row_data.join(" ")

        # Find folder storage
        if row_text.include?("Folder Storage")
          folder_storage = row_data[2].presence || row_data[3].presence
          company_code = row_data[4].presence || row_data[5].presence
          puts "  Folder: #{folder_storage}, Code: #{company_code}"
        end

        # Find Company Register header
        if row_data[1] == "Company Register" || row_text.include?("Company Register") && row_text.include?("Type")
          register_row = row + 1
          break
        end
      end

      unless register_row
        puts "  No Company Register section found"
        next
      end

      # Parse document rows
      doc_count = 0
      (register_row..sheet.last_row).each do |row|
        row_data = (1..10).map { |col| sheet.cell(row, col) }

        # Stop at empty row
        break if row_data[1].to_s.blank? || row_data[1].to_s.include?("#N/A")

        doc_name = row_data[1].to_s.strip
        next if doc_name.blank? || doc_name == "Company Register"

        doc_type_raw = row_data[2].to_s.strip
        folder_name = row_data[3].to_s.strip
        doc_date = row_data[4]
        is_manual = row_data[5].to_s.strip.present?
        electronic_ref = row_data[6].to_s.strip
        by_whom = row_data[7].to_s.strip

        # Parse date
        document_date = nil
        if doc_date.is_a?(Date) || doc_date.is_a?(DateTime)
          document_date = doc_date.to_date
        elsif doc_date.to_s =~ /\d{4}-\d{2}-\d{2}/
          document_date = Date.parse(doc_date.to_s) rescue nil
        end

        # Normalize document type
        doc_type = normalize_document_type(doc_type_raw)

        # Build expected OneDrive path
        onedrive_path = build_document_path(config[:group], folder_storage || config[:folder], folder_name)

        # Create or update document
        company_doc = CompanyDocument.find_or_initialize_by(
          company: company,
          title: doc_name
        )

        # Determine storage type (manual = physical paper copy)
        storage = if is_manual && electronic_ref.present?
                    "both"
        elsif is_manual
                    "manual"
        elsif electronic_ref.present?
                    "electronic"
        else
                    nil  # Allow nil to pass validation
        end

        company_doc.assign_attributes(
          document_type: doc_type,
          document_date: document_date,
          storage_type: storage,
          description: [ electronic_ref, "Filed by: #{by_whom}" ].reject(&:blank?).join("\n"),
          expected_onedrive_path: onedrive_path,
          register_folder: folder_name
        )

        if company_doc.save
          doc_count += 1
          total_documents += 1
        else
          puts "    Error: #{doc_name} - #{company_doc.errors.full_messages.join(', ')}"
          total_errors += 1
        end
      end

      puts "  Imported #{doc_count} documents"
    end

    puts "\n=== Document Import Complete ==="
    puts "Documents created/updated: #{total_documents}"
    puts "Errors: #{total_errors}"
    puts "Total documents in database: #{CompanyDocument.count}"
  end

  def normalize_document_type(type_raw)
    return "other" if type_raw.blank?

    type = type_raw.to_s.downcase.strip

    type_map = {
      "members" => "share_registry",
      "register of members" => "share_registry",
      "constitution" => "constitution",
      "minutes" => "minutes",
      "loan agreement" => "loan_agreement",
      "loans and security" => "loan_agreement",
      "security deed" => "security_deed",
      "company setup" => "certificate",
      "asic docs" => "asic",
      "eoy asic" => "asic",
      "eoy ato" => "tax",
      "ato tax return" => "tax",
      "tax consolidation" => "tax",
      "bas" => "tax",
      "bank statements" => "financial",
      "financial" => "financial",
      "corporate key" => "other",
      "asset" => "other",
      "assets" => "other",
      "general" => "other"
    }

    type_map[type] || "other"
  end

  def build_document_path(group, folder_storage, sub_folder)
    parts = [ "Corporate File" ]
    parts << group if group.present?
    parts << folder_storage if folder_storage.present?
    parts << sub_folder if sub_folder.present? && sub_folder != "#N/A"
    parts.join("/")
  end

  # ==============================
  # ONEDRIVE SYNC TASK
  # ==============================
  desc "Scan OneDrive Corporate folder and link documents"
  task sync_onedrive: :environment do
    puts "=== Syncing OneDrive Corporate Documents ==="

    folder_path = ENV["CORPORATE_FOLDER"] || "Corporate"
    service = CorporateOnedriveService.new(nil, folder_path: folder_path)
    result = service.scan_all

    if result[:success]
      puts "\nSync Complete!"
      puts "  Companies scanned: #{result[:companies_scanned]}"
      puts "  Documents found: #{result[:documents_found]}"
      puts "  Documents linked: #{result[:documents_linked]}"

      if result[:errors].present?
        puts "\nErrors:"
        result[:errors].each { |e| puts "  - #{e}" }
      end
    else
      puts "Sync failed: #{result[:error]}"
    end
  end

  # ==============================
  # IMPORT FROM JSON
  # ==============================
  desc "Import company documents from JSON file (for staging/prod)"
  task import_from_json: :environment do
    json_data = ENV["DOCS_JSON"]
    unless json_data.present?
      puts "ERROR: Set DOCS_JSON environment variable with JSON data"
      puts "Usage: heroku run 'DOCS_JSON=\"[...]\" bundle exec rails corporate:import_from_json'"
      exit 1
    end

    docs = JSON.parse(json_data)
    puts "=== Importing #{docs.count} Company Documents from JSON ==="

    imported = 0
    errors = 0

    docs.each do |doc|
      company = Company.find_by(name: doc["company_name"])
      unless company
        puts "  Company not found: #{doc['company_name']}"
        errors += 1
        next
      end

      company_doc = CompanyDocument.find_or_initialize_by(
        company: company,
        title: doc["title"]
      )

      company_doc.assign_attributes(
        document_type: doc["document_type"],
        document_date: doc["document_date"],
        storage_type: doc["storage_type"],
        description: doc["description"],
        expected_onedrive_path: doc["expected_onedrive_path"],
        register_folder: doc["register_folder"]
      )

      if company_doc.save
        imported += 1
      else
        puts "  Error: #{doc['title']} - #{company_doc.errors.full_messages.join(', ')}"
        errors += 1
      end
    end

    puts "\n=== Import Complete ==="
    puts "Documents imported: #{imported}"
    puts "Errors: #{errors}"
    puts "Total documents: #{CompanyDocument.count}"
  end
end
