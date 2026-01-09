namespace :asic do
  desc "Sync directorships from ASIC extracts for all companies with credentials"
  task sync_directorships: :environment do
    puts "=" * 80
    puts "SYNCING DIRECTORSHIPS FROM ASIC"
    puts "=" * 80
    puts

    # Find all companies with ASIC credentials
    companies = CorporateCompany.where.not(asic_username: [ nil, "" ])

    puts "Found #{companies.count} companies with ASIC credentials"
    puts

    if companies.count.zero?
      puts "No companies with ASIC credentials found."
      exit 0
    end

    stats = {
      companies_processed: 0,
      companies_skipped: 0,
      directorships_created: 0,
      directorships_updated: 0,
      errors: []
    }

    companies.each do |company|
      puts "-" * 80
      puts "Processing: #{company.name} (ID: #{company.id})"
      puts "  Corporate Key: #{company.corporate_key}"
      puts "  ACN: #{company.acn}"
      puts

      # Try automated scraping first, fall back to manual extract
      puts "  → Attempting automated ASIC Connect scraping..."

      scraper = AsicConnectScraper.new(company, headless: true)
      result = scraper.fetch_current_directors

      # If automated scraping fails, check for manual extract file
      unless result[:success]
        puts "  ⚠️  Automated scraping failed: #{result[:error]}"
        puts "  → Checking for manual extract file..."

        extract_file = find_asic_extract_file(company)

        if extract_file.nil?
          puts "  ❌ No extract file found either"
          puts "     Please download current officer extract from ASIC Connect"
          puts "     Save to: tmp/asic_extracts/#{company.id}_#{company.code}_officers.pdf"
          puts "     Or fix ASIC credentials for automated scraping"
          puts
          stats[:companies_skipped] += 1
          stats[:errors] << "#{company.name}: #{result[:error]}"
          next
        end

        puts "  ✓ Found extract: #{File.basename(extract_file)}"

        service = AsicConnectService.new(company)
        result = service.parse_asic_extract(extract_file)
      else
        puts "  ✓ Automated scraping successful!"
      end

      unless result[:success]
        puts "  ❌ Failed: #{result[:error]}"
        stats[:errors] << "#{company.name}: #{result[:error]}"
        stats[:companies_skipped] += 1
        next
      end

      directors = result[:directors]
      puts "  ✓ Parsed #{directors.count} directors from extract"
      puts

      # Skip callbacks during sync
      CorporateCompanyDirector.skip_callback(:create, :after, :create_appointment_activity)
      CorporateCompanyDirector.skip_callback(:create, :after, :ensure_ssot_director_membership)
      CorporateCompanyDirector.skip_callback(:commit, :after, :sync_to_contact_relationship)

      directors.each do |director_data|
        puts "    Processing: #{director_data[:name]} (#{director_data[:position]})"

        # Try to find or create contact for this director
        contact = find_or_create_director_contact(director_data[:name])

        if contact.nil?
          puts "      ⚠️  Could not create contact"
          next
        end

        # Find or create directorship record
        directorship = CorporateCompanyDirector.find_or_initialize_by(
          company_id: company.id,
          contact_id: contact.id
        )

        is_new = directorship.new_record?

        # Update directorship details
        directorship.position = map_position(director_data[:position])
        directorship.appointment_date = director_data[:appointment_date] || Date.today
        directorship.resignation_date = director_data[:resignation_date]
        directorship.is_current = director_data[:resignation_date].nil? || director_data[:resignation_date] > Date.today

        if directorship.save
          if is_new
            stats[:directorships_created] += 1
            puts "      + Created directorship"
          else
            stats[:directorships_updated] += 1
            puts "      ✓ Updated directorship"
          end
        else
          puts "      ❌ Failed: #{directorship.errors.full_messages.join(', ')}"
        end
      end

      # Re-enable callbacks
      CorporateCompanyDirector.set_callback(:create, :after, :create_appointment_activity)
      CorporateCompanyDirector.set_callback(:create, :after, :ensure_ssot_director_membership)
      CorporateCompanyDirector.set_callback(:commit, :after, :sync_to_contact_relationship)

      stats[:companies_processed] += 1
      puts
    end

    # Final summary
    puts
    puts "=" * 80
    puts "SYNC COMPLETE"
    puts "=" * 80
    puts
    puts "Results:"
    puts "  ✓ Companies processed: #{stats[:companies_processed]}"
    puts "  ⚠ Companies skipped: #{stats[:companies_skipped]}"
    puts "  + Directorships created: #{stats[:directorships_created]}"
    puts "  ✓ Directorships updated: #{stats[:directorships_updated]}"
    puts

    if stats[:errors].any?
      puts "Errors:"
      stats[:errors].each do |error|
        puts "  ⚠️  #{error}"
      end
      puts
    end
  end

  desc "Sync directorships for a specific company by ID"
  task :sync_company, [ :company_id ] => :environment do |t, args|
    company_id = args[:company_id]

    if company_id.blank?
      puts "❌ Error: Company ID is required"
      puts "Usage: rake asic:sync_company[123]"
      exit 1
    end

    company = CorporateCompany.find_by(id: company_id)

    if company.nil?
      puts "❌ Error: Company not found with ID #{company_id}"
      exit 1
    end

    puts "=" * 80
    puts "SYNCING DIRECTORSHIPS FOR: #{company.name}"
    puts "=" * 80
    puts

    ENV["COMPANY_ID"] = company_id.to_s
    Rake::Task["asic:sync_directorships"].invoke
  end

  desc "Download instructions for ASIC extracts"
  task download_instructions: :environment do
    puts "=" * 80
    puts "HOW TO DOWNLOAD ASIC OFFICER EXTRACTS"
    puts "=" * 80
    puts
    puts "For each company with ASIC credentials:"
    puts
    puts "1. Go to: https://connectonline.asic.gov.au"
    puts "2. Log in with:"
    puts "   - Corporate Key (company number)"
    puts "   - Username (email)"
    puts "   - Password"
    puts
    puts "3. Navigate to: Company Details > Officers"
    puts
    puts "4. Click 'Export' or 'Print' and save as PDF"
    puts
    puts "5. Save file to:"
    puts "   tmp/asic_extracts/{company_id}_{company_code}_officers.pdf"
    puts
    puts "   Example: tmp/asic_extracts/7_GEN_officers.pdf"
    puts
    puts "6. Run: rake asic:sync_directorships"
    puts
    puts "=" * 80
    puts

    # List companies that need extracts
    companies = CorporateCompany.where.not(asic_username: [ nil, "" ])

    puts "Companies with ASIC credentials (#{companies.count}):"
    puts

    companies.each do |company|
      extract_file = find_asic_extract_file(company)
      status = extract_file ? "✓ Extract ready" : "⚠️  Extract needed"

      puts "  #{status} - #{company.name}"
      puts "     ID: #{company.id}, Code: #{company.code || 'N/A'}"
      puts "     File: tmp/asic_extracts/#{company.id}_#{company.code || company.id}_officers.pdf"
      puts
    end
  end

  private

  def find_asic_extract_file(company)
    # Look for extract files in designated folder
    extract_dir = Rails.root.join("tmp", "asic_extracts")
    FileUtils.mkdir_p(extract_dir) unless Dir.exist?(extract_dir)

    # Try various file naming patterns
    patterns = [
      "#{company.id}_#{company.code}_officers.*",
      "#{company.id}_officers.*",
      "#{company.code}_officers.*",
      "#{company.name.parameterize}_officers.*"
    ].compact

    patterns.each do |pattern|
      files = Dir.glob(extract_dir.join(pattern))
      return files.first if files.any?
    end

    nil
  end

  def find_or_create_director_contact(name)
    return nil if name.blank?

    # Try to find existing contact by name
    # Split name into first/last
    name_parts = name.split(/\s+/)
    first_name = name_parts.first
    last_name = name_parts[1..-1]&.join(" ")

    # Search for existing contact
    contact = Contact.where("LOWER(first_name) = ? AND LOWER(last_name) = ?",
                            first_name&.downcase,
                            last_name&.downcase).first

    return contact if contact

    # Create new contact
    begin
      Contact.create!(
        first_name: first_name,
        last_name: last_name,
        display_name: name,
        contact_type: "individual",
        notes: "Auto-created from ASIC directorship sync"
      )
    rescue StandardError => e
      Rails.logger.error("Failed to create contact for #{name}: #{e.message}")
      nil
    end
  end

  def map_position(position_text)
    return "director" if position_text.blank?

    position_lower = position_text.downcase

    # Map common ASIC position descriptions to our enum
    if position_lower.include?("director") && position_lower.include?("secretary")
      "director_secretary"
    elsif position_lower.include?("director") && position_lower.include?("public")
      "director_public_officer"
    elsif position_lower.include?("secretary") && position_lower.include?("public")
      "secretary_public_officer"
    elsif position_lower.include?("director") && position_lower.include?("secretary") && position_lower.include?("public")
      "director_secretary_public_officer"
    elsif position_lower.include?("chairman") || position_lower.include?("chair")
      "chairman"
    elsif position_lower.include?("secretary")
      "secretary"
    elsif position_lower.include?("public officer")
      "public_officer"
    elsif position_lower.include?("director")
      "director"
    else
      "director" # Default
    end
  end
end
