namespace :directorships do
  desc "Import Robert Harder directorships from ASIC Excel extract"
  task import_robert_harder: :environment do
    require "roo"
    require "date"

    file_path = Rails.root.join("../Copy of Robert Harder Directorship.xlsx")

    unless File.exist?(file_path)
      puts "❌ Error: Excel file not found at #{file_path}"
      exit 1
    end

    puts "=" * 80
    puts "IMPORTING ROBERT HARDER DIRECTORSHIPS FROM ASIC EXTRACT"
    puts "=" * 80
    puts

    # Find Robert Harder contact
    robert_harder = Contact.find_by(id: 1301)
    unless robert_harder
      puts "❌ Error: Robert Harder contact (ID: 1301) not found"
      exit 1
    end

    puts "✓ Found contact: #{robert_harder.display_name} (ID: #{robert_harder.id})"
    puts

    # Open Excel file
    xlsx = Roo::Spreadsheet.open(file_path.to_s)
    sheet = xlsx.sheet("HARDER")

    puts "✓ Opened Excel file: #{file_path.basename}"
    puts "  Sheet: HARDER"
    puts "  Total rows: #{sheet.last_row}"
    puts

    # Parse companies and directorships
    companies = []
    current_company = nil
    company_name = nil

    sheet.each_row_streaming(pad_cells: true) do |row|
      cell_value = row[0]&.value.to_s.strip
      next if cell_value.empty?

      # Detect company name (line before ACN)
      if cell_value =~ /PTY LTD|LIMITED|LTD|PROPRIETARY/i &&
         cell_value !~ /ACN|ABN|Status|Appointment|Ceased|Director|Secretary/i
        company_name = cell_value
        next
      end

      # Detect company ACN/ABN line
      acn_match = cell_value.match(/ACN\s*(\d{3}).*?(\d{3}).*?(\d{3})/)
      if acn_match
        # Save previous company
        companies << current_company if current_company

        # Start new company
        acn = "#{acn_match[1]} #{acn_match[2]} #{acn_match[3]}"

        # Extract ABN if present
        abn_match = cell_value.match(/ABN\s*(\d{2}).*?(\d{3}).*?(\d{3}).*?(\d{3})/)
        abn = abn_match ? "#{abn_match[1]} #{abn_match[2]} #{abn_match[3]} #{abn_match[4]}" : nil

        current_company = {
          name: company_name,
          acn: acn,
          abn: abn,
          directorships: []
        }
        company_name = nil # Reset for next company
        next
      end

      # Detect company status
      if current_company && cell_value.start_with?("Company Status:")
        status = cell_value.sub("Company Status:", "").strip
        current_company[:status] = status
        next
      end

      # Detect directorship position
      if current_company && (cell_value =~ /^(Director|Secretary)/i)
        position_match = cell_value.match(/^(Director|Secretary)/i)
        position = position_match[1].downcase

        current_company[:directorships] << {
          position: position
        }
        next
      end

      # Detect appointment/ceased dates
      if current_company && !current_company[:directorships].empty? &&
         cell_value.include?("Appointment Date:")

        last_dir = current_company[:directorships].last

        # Parse appointment date
        if appt_match = cell_value.match(/Appointment Date:\s*(\d{2}\/\d{2}\/\d{4})/)
          begin
            last_dir[:appointment_date] = Date.strptime(appt_match[1], "%d/%m/%Y")
          rescue ArgumentError
            puts "⚠️  Invalid appointment date: #{appt_match[1]}"
          end
        end

        # Parse ceased date
        if ceased_match = cell_value.match(/Ceased Date:\s*(\d{2}\/\d{2}\/\d{4})/)
          begin
            last_dir[:resignation_date] = Date.strptime(ceased_match[1], "%d/%m/%Y")
            last_dir[:is_current] = false
          rescue ArgumentError
            puts "⚠️  Invalid ceased date: #{ceased_match[1]}"
          end
        else
          last_dir[:is_current] = true
        end
      end
    end

    # Add last company
    companies << current_company if current_company

    puts "=" * 80
    puts "PARSED DATA SUMMARY"
    puts "=" * 80
    puts "  Companies found: #{companies.count}"
    puts "  Total directorships: #{companies.sum { |c| c[:directorships].count }}"
    puts "  Current directorships: #{companies.sum { |c| c[:directorships].count { |d| d[:is_current] } }}"
    puts

    # Import into database
    puts "=" * 80
    puts "IMPORTING TO DATABASE"
    puts "=" * 80
    puts

    # Skip callbacks during import to avoid errors with company_activities
    CorporateCompanyDirector.skip_callback(:create, :after, :create_appointment_activity)
    CorporateCompanyDirector.skip_callback(:create, :after, :ensure_ssot_director_membership)
    CorporateCompanyDirector.skip_callback(:commit, :after, :sync_to_contact_relationship)

    stats = {
      companies_found: companies.count,
      companies_matched: 0,
      companies_created: 0,
      directorships_created: 0,
      directorships_skipped: 0,
      errors: []
    }

    companies.each_with_index do |company_data, index|
      next unless company_data[:acn] # Skip if no ACN

      # Find or create company
      acn_normalized = company_data[:acn].gsub(/\s+/, "")

      corp_company = CorporateCompany.find_by("REPLACE(acn, ' ', '') = ?", acn_normalized)

      if corp_company
        stats[:companies_matched] += 1
        print "."
      else
        # Create new company
        # Map ASIC status to our status values
        status_map = {
          "Registered" => "active",
          "Deregistered" => "struck_off",
          "Strike-off action in progress" => "struck_off",
          "Under external administration and/or controller appointed" => "in_liquidation"
        }
        our_status = status_map[company_data[:status]] || "struck_off"

        corp_company = CorporateCompany.create!(
          name: company_data[:name] || "Company ACN #{company_data[:acn]}",
          acn: company_data[:acn],
          abn: company_data[:abn],
          status: our_status,
          entity_type: "company",
          code: "RH-#{acn_normalized}", # External company code with full ACN
          purpose: "Imported from Robert Harder ASIC extract"
        )
        stats[:companies_created] += 1
        print "+"
      end

      # Create directorship records
      company_data[:directorships].each do |dir|
        # Determine combined position for director+secretary
        position = if company_data[:directorships].count { |d| d[:appointment_date] == dir[:appointment_date] } > 1
          # Multiple roles with same appointment date - combine them
          positions = company_data[:directorships]
            .select { |d| d[:appointment_date] == dir[:appointment_date] }
            .map { |d| d[:position] }
            .uniq

          if positions.sort == [ "director", "secretary" ]
            "director_secretary"
          else
            dir[:position]
          end
        else
          dir[:position]
        end

        # Skip duplicates (e.g., if director and secretary are listed separately but we already created director_secretary)
        next if position == "secretary" &&
                CorporateCompanyDirector.exists?(
                  contact_id: robert_harder.id,
                  company_id: corp_company.id,
                  position: "director_secretary",
                  appointment_date: dir[:appointment_date]
                )

        begin
          # Find or create without callbacks to avoid activity logging errors
          directorship = CorporateCompanyDirector.find_or_initialize_by(
            contact_id: robert_harder.id,
            company_id: corp_company.id,
            appointment_date: dir[:appointment_date]
          )

          if directorship.new_record?
            directorship.position = position
            directorship.resignation_date = dir[:resignation_date]
            directorship.is_current = dir[:is_current] || false
            directorship.save!
            stats[:directorships_created] += 1
          end
        rescue => e
          stats[:directorships_skipped] += 1
          stats[:errors] << "Company #{corp_company.name}: #{e.message}"
        end
      end

      # Print progress every 10 companies
      if (index + 1) % 10 == 0
        puts " #{index + 1}/#{companies.count}"
      end
    end
    puts

    # Re-enable callbacks
    CorporateCompanyDirector.set_callback(:create, :after, :create_appointment_activity)
    CorporateCompanyDirector.set_callback(:create, :after, :ensure_ssot_director_membership)
    CorporateCompanyDirector.set_callback(:commit, :after, :sync_to_contact_relationship)

    # Final summary
    puts
    puts "=" * 80
    puts "IMPORT COMPLETE"
    puts "=" * 80
    puts
    puts "Results:"
    puts "  ✓ Companies matched to existing: #{stats[:companies_matched]}"
    puts "  + Companies created: #{stats[:companies_created]}"
    puts "  ✓ Directorship records created: #{stats[:directorships_created]}"
    puts "  ⚠ Directorships skipped (duplicates/errors): #{stats[:directorships_skipped]}"
    puts

    if stats[:errors].any?
      puts "Errors:"
      stats[:errors].first(10).each do |error|
        puts "  ⚠️  #{error}"
      end
      puts "  ... and #{stats[:errors].count - 10} more" if stats[:errors].count > 10
      puts
    end

    # Show current directorships count
    current_count = robert_harder.current_directorships.count
    total_count = robert_harder.corporate_company_directorships.count

    puts "Robert Harder Directorships:"
    puts "  Current: #{current_count}"
    puts "  Historical: #{total_count - current_count}"
    puts "  Total: #{total_count}"
    puts
    puts "=" * 80
    puts "Done! View at: https://teeemlive.vercel.app/contacts/1301"
    puts "=" * 80
  end
end
