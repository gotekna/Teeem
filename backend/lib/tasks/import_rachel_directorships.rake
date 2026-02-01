namespace :directorships do
  desc "Import Rachel Harder directorships from Excel spreadsheet"
  task import_rachel: :environment do
    require "roo"
    require "date"

    file_path = Rails.root.join("../Rachels Directorships.xlsx")

    unless File.exist?(file_path)
      puts "❌ Error: Excel file not found at #{file_path}"
      exit 1
    end

    puts "=" * 80
    puts "IMPORTING RACHEL HARDER DIRECTORSHIPS FROM EXCEL"
    puts "=" * 80
    puts

    # Find Rachel Harder contact
    rachel = Contact.find_by(id: 2159)  # Rachel Anne Harder
    unless rachel
      puts "❌ Error: Rachel Anne Harder contact (ID: 2159) not found"
      exit 1
    end

    puts "✓ Found contact: #{rachel.display_name} (ID: #{rachel.id})"
    puts

    # Open Excel file
    xlsx = Roo::Spreadsheet.open(file_path.to_s)
    sheet = xlsx.sheet("Rachel Directorship")

    puts "✓ Opened Excel file: #{file_path.basename}"
    puts "  Sheet: Rachel Directorship"
    puts "  Total rows: #{sheet.last_row}"
    puts

    # Parse directorships
    directorships = []

    # Skip header rows (rows 1-2)
    (3..sheet.last_row).each do |row_num|
      row = sheet.row(row_num)

      # Column C = Company name
      company_name = row[2]
      next unless company_name && company_name.to_s.strip.length > 0

      # Parse dates
      # Columns D, E = Director start dates
      # Columns F, G, H = Resignation dates

      # Try to find director appointment date (column D or E)
      director_start = nil
      [ row[3], row[4] ].each do |cell|
        if cell.is_a?(DateTime)
          director_start = cell.to_date
          break
        elsif cell.is_a?(String) && cell =~ /\d{1,2}\/\d{1,2}\/\d{4}/
          begin
            director_start = Date.strptime(cell, "%d/%m/%Y")
            break
          rescue
            # Try other format
          end
        end
      end

      # Try to find resignation date (columns F, G, H)
      resignation_date = nil
      [ row[5], row[6], row[7] ].each do |cell|
        if cell.is_a?(DateTime)
          resignation_date = cell.to_date
          break
        elsif cell.is_a?(String) && cell =~ /\d{1,2}\/\d{1,2}\/\d{4}/
          begin
            resignation_date = Date.strptime(cell, "%d/%m/%Y")
            break
          rescue
            # Skip
          end
        end
      end

      # Determine if current (no resignation date or resignation date in future)
      is_current = resignation_date.nil? || resignation_date > Date.today

      directorships << {
        company_name: company_name.to_s.strip,
        appointment_date: director_start || Date.today, # Default to today if no date
        resignation_date: resignation_date,
        is_current: is_current,
        position: "director", # Assume director role
        purpose: row[8]&.to_s&.strip, # Column I = Purpose
        group: row[9]&.to_s&.strip    # Column J = Part of Group
      }
    end

    puts "=" * 80
    puts "PARSED DATA SUMMARY"
    puts "=" * 80
    puts "  Total directorships: #{directorships.count}"
    puts "  Current: #{directorships.count { |d| d[:is_current] }}"
    puts "  Historical: #{directorships.count { |d| !d[:is_current] }}"
    puts

    # Skip callbacks during import
    CorporateDirector.skip_callback(:create, :after, :create_appointment_activity)
    CorporateDirector.skip_callback(:create, :after, :ensure_ssot_director_membership)
    CorporateDirector.skip_callback(:commit, :after, :sync_to_contact_relationship)

    stats = {
      directorships_found: directorships.count,
      companies_matched: 0,
      companies_created: 0,
      directorships_created: 0,
      directorships_skipped: 0,
      errors: []
    }

    puts "=" * 80
    puts "IMPORTING TO DATABASE"
    puts "=" * 80
    puts

    directorships.each_with_index do |dir_data, index|
      # Find company by name
      corp_company = Corporate.find_by("name ILIKE ?", dir_data[:company_name])

      if corp_company
        stats[:companies_matched] += 1
        print "."
      else
        # Create new company
        begin
          # Try to find company group if specified
          company_group_id = nil
          if dir_data[:group].present?
            group = CorporateGroup.find_by("name ILIKE ?", "%#{dir_data[:group]}%")
            company_group_id = group&.id
          end

          corp_company = Corporate.create!(
            name: dir_data[:company_name],
            status: dir_data[:is_current] ? "active" : "struck_off",
            entity_type: "company",
            code: "RH-#{dir_data[:company_name].gsub(/[^A-Z0-9]/i, '')[0..8].upcase}",
            purpose: dir_data[:purpose],
            company_group_id: company_group_id
          )
          stats[:companies_created] += 1
          print "+"
        rescue => e
          stats[:errors] << "Failed to create company #{dir_data[:company_name]}: #{e.message}"
          next
        end
      end

      # Create directorship
      begin
        directorship = CorporateDirector.find_or_initialize_by(
          contact_id: rachel.id,
          company_id: corp_company.id,
          appointment_date: dir_data[:appointment_date]
        )

        if directorship.new_record?
          directorship.position = dir_data[:position]
          directorship.resignation_date = dir_data[:resignation_date]
          directorship.is_current = dir_data[:is_current]
          directorship.save!
          stats[:directorships_created] += 1
        end
      rescue => e
        stats[:directorships_skipped] += 1
        stats[:errors] << "Company #{corp_company.name}: #{e.message}"
      end

      # Print progress every 10
      if (index + 1) % 10 == 0
        puts " #{index + 1}/#{directorships.count}"
      end
    end
    puts

    # Re-enable callbacks
    CorporateDirector.set_callback(:create, :after, :create_appointment_activity)
    CorporateDirector.set_callback(:create, :after, :ensure_ssot_director_membership)
    CorporateDirector.set_callback(:commit, :after, :sync_to_contact_relationship)

    # Final summary
    puts
    puts "=" * 80
    puts "IMPORT COMPLETE"
    puts "=" * 80
    puts
    puts "Results:"
    puts "  ✓ Companies matched: #{stats[:companies_matched]}"
    puts "  + Companies created: #{stats[:companies_created]}"
    puts "  ✓ Directorship records created: #{stats[:directorships_created]}"
    puts "  ⚠ Directorships skipped: #{stats[:directorships_skipped]}"
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
    current_count = rachel.current_directorships.count
    total_count = rachel.corporate_directorships.count

    puts "Rachel Harder Directorships:"
    puts "  Current: #{current_count}"
    puts "  Historical: #{total_count - current_count}"
    puts "  Total: #{total_count}"
    puts
    puts "=" * 80
    puts "Done! View at: https://teeem.vercel.app/contacts/2159"
    puts "=" * 80
  end
end
