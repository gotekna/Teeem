namespace :directorships do
  desc "Import James Harder directorships from ASIC PDF extract"
  task import_james: :environment do
    require 'pdf-reader'
    require 'date'

    file_path = Rails.root.join('../James Harder Directorships.pdf')

    unless File.exist?(file_path)
      puts "❌ Error: PDF file not found at #{file_path}"
      exit 1
    end

    puts "=" * 80
    puts "IMPORTING JAMES HARDER DIRECTORSHIPS FROM ASIC PDF"
    puts "=" * 80
    puts

    # Find James Harder contact
    james = Contact.find_by(id: 2165)
    unless james
      puts "❌ Error: James Harder contact (ID: 2165) not found"
      exit 1
    end

    puts "✓ Found contact: #{james.display_name} (ID: #{james.id})"
    puts

    # Read PDF
    reader = PDF::Reader.new(file_path.to_s)
    puts "✓ Opened PDF file: #{file_path.basename}"
    puts "  Pages: #{reader.page_count}"
    puts

    # Extract text from all pages
    full_text = reader.pages.map(&:text).join("\n")

    # Parse directorships
    directorships = []
    current_entry = nil

    full_text.each_line do |line|
      line = line.strip
      next if line.empty?

      # Detect directorship type
      if line =~ /^Type\s*:\s*(.+)/
        # Save previous entry
        directorships << current_entry if current_entry

        position = $1.strip
        # Map ASIC types to our position types
        position_map = {
          /Director/ => 'director',
          /Secretary/ => 'secretary',
          /Public Officer/ => 'public_officer'
        }

        mapped_position = nil
        position_map.each do |pattern, value|
          if position =~ pattern
            mapped_position = value
            break
          end
        end

        current_entry = {
          position: mapped_position || 'director',
          is_current: position =~ /Current/i
        }
      elsif current_entry
        # Parse dates
        if line =~ /Appointment Date\s*:\s*(\d{2}\/\d{2}\/\d{4})/
          begin
            current_entry[:appointment_date] = Date.strptime($1, '%d/%m/%Y')
          rescue ArgumentError
            puts "⚠️  Invalid appointment date: #{$1}"
          end
        end

        if line =~ /Ceased Date\s*:\s*(\d{2}\/\d{2}\/\d{4})/
          begin
            current_entry[:resignation_date] = Date.strptime($1, '%d/%m/%Y')
            current_entry[:is_current] = false
          rescue ArgumentError
            puts "⚠️  Invalid ceased date: #{$1}"
          end
        end

        # Parse entity name
        if line =~ /Entity Name\s*:\s*(.+)/
          current_entry[:company_name] = $1.strip
        end

        # Parse ACN
        if line =~ /ACN\s*:\s*(\d+)/
          acn = $1
          if acn.length == 9
            current_entry[:acn] = "#{acn[0..2]} #{acn[3..5]} #{acn[6..8]}"
          end
        end
      end
    end

    # Add last entry
    directorships << current_entry if current_entry

    # Filter out incomplete entries
    directorships = directorships.select { |d| d[:company_name] && d[:appointment_date] }

    puts "=" * 80
    puts "PARSED DATA SUMMARY"
    puts "=" * 80
    puts "  Total directorships: #{directorships.count}"
    puts "  Current: #{directorships.count { |d| d[:is_current] }}"
    puts "  Historical: #{directorships.count { |d| !d[:is_current] }}"
    puts

    # Skip callbacks during import
    CorporateCompanyDirector.skip_callback(:create, :after, :create_appointment_activity)
    CorporateCompanyDirector.skip_callback(:create, :after, :ensure_ssot_director_membership)
    CorporateCompanyDirector.skip_callback(:commit, :after, :sync_to_contact_relationship)

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
      # Find or create company
      corp_company = if dir_data[:acn]
        acn_normalized = dir_data[:acn].gsub(/\s+/, '')
        CorporateCompany.find_by("REPLACE(acn, ' ', '') = ?", acn_normalized)
      else
        CorporateCompany.find_by(name: dir_data[:company_name])
      end

      if corp_company
        stats[:companies_matched] += 1
        print "."
      else
        # Create new company
        begin
          corp_company = CorporateCompany.create!(
            name: dir_data[:company_name],
            acn: dir_data[:acn],
            status: dir_data[:is_current] ? 'active' : 'struck_off',
            entity_type: 'company',
            code: dir_data[:acn] ? "JH-#{dir_data[:acn].gsub(/\s+/, '')}" : nil,
            purpose: "Imported from James Harder ASIC extract"
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
        directorship = CorporateCompanyDirector.find_or_initialize_by(
          contact_id: james.id,
          company_id: corp_company.id,
          appointment_date: dir_data[:appointment_date]
        )

        if directorship.new_record?
          directorship.position = dir_data[:position]
          directorship.resignation_date = dir_data[:resignation_date]
          directorship.is_current = dir_data[:is_current] || false
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
    current_count = james.current_directorships.count
    total_count = james.corporate_company_directorships.count

    puts "James Harder Directorships:"
    puts "  Current: #{current_count}"
    puts "  Historical: #{total_count - current_count}"
    puts "  Total: #{total_count}"
    puts
    puts "=" * 80
    puts "Done! View at: https://teeemlive.vercel.app/contacts/2165"
    puts "=" * 80
  end
end
