namespace :asic do
  desc "Test ASIC Connect scraping with one company"
  task :test_scraper, [ :company_id ] => :environment do |t, args|
    company_id = args[:company_id] || 7 # Default to Gen2612

    company = Corporate.find_by(id: company_id)

    unless company
      puts "❌ Company not found with ID #{company_id}"
      exit 1
    end

    puts "=" * 80
    puts "TESTING ASIC CONNECT SCRAPER"
    puts "=" * 80
    puts
    puts "Company: #{company.name}"
    puts "ID: #{company.id}"
    puts "Code: #{company.code}"
    puts "ACN: #{company.acn}"
    puts
    puts "Credentials:"
    puts "  Corporate Key: #{company.corporate_key.present? ? company.corporate_key : '❌ Missing'}"
    puts "  Username: #{company.asic_username.present? ? company.asic_username : '❌ Missing'}"
    puts "  Password: #{company.encrypted_asic_password.present? ? '✓ Present (encrypted)' : '❌ Missing or decryption failed'}"
    puts "  Recovery Answer: #{company.encrypted_recovery_answer.present? ? '✓ Present (encrypted)' : '⚠️  Missing'}"
    puts


    unless company.corporate_key.present? && company.asic_username.present?
      puts "❌ Missing required credentials"
      puts "   Company needs corporate_key and asic_username"
      exit 1
    end

    # Check if password is missing
    unless company.encrypted_asic_password.present?
      puts "⚠️  ASIC password is missing or cannot be decrypted"
      puts
      print "Would you like to enter the password now for testing? (y/n): "
      response = STDIN.gets.chomp.downcase

      if response == "y"
        print "Enter ASIC password for #{company.name}: "
        password = STDIN.noecho(&:gets).chomp
        puts
        puts "Password entered (not saved to database)"
        puts

        # Use password for this test only (don't save)
        company.define_singleton_method(:encrypted_asic_password) { password }
      else
        puts "Cannot proceed without password"
        exit 1
      end
    end

    puts "-" * 80
    puts "Starting automated scraper..."
    puts "-" * 80
    puts

    begin
      scraper = AsicConnectScraper.new(company, headless: false) # Use headed mode for debugging
      result = scraper.fetch_current_directors

      if result[:success]
        puts
        puts "=" * 80
        puts "✓ SUCCESS!"
        puts "=" * 80
        puts
        puts "Found #{result[:count]} directors:"
        puts

        result[:directors].each_with_index do |director, index|
          puts "#{index + 1}. #{director[:name]}"
          puts "   Position: #{director[:position]}"
          puts "   Appointed: #{director[:appointment_date] || 'Unknown'}"
          puts "   Resigned: #{director[:resignation_date] || 'Current'}"
          puts "   Status: #{director[:status]}"
          puts
        end
      else
        puts
        puts "=" * 80
        puts "❌ FAILED"
        puts "=" * 80
        puts
        puts "Error: #{result[:error]}"
        puts
        puts "Check screenshots in: backend/tmp/asic_screenshots/"
        puts
      end
    rescue StandardError => e
      puts
      puts "=" * 80
      puts "❌ EXCEPTION"
      puts "=" * 80
      puts
      puts "Error: #{e.message}"
      puts
      puts "Backtrace:"
      puts e.backtrace.first(10).join("\n")
      puts
    end
  end

  desc "Check ASIC credentials for all companies"
  task check_credentials: :environment do
    companies = Corporate.where.not(asic_username: [ nil, "" ])

    puts "=" * 80
    puts "ASIC CREDENTIALS AUDIT"
    puts "=" * 80
    puts
    puts "Found #{companies.count} companies with ASIC usernames"
    puts

    companies.each do |company|
      status = []
      status << (company.corporate_key.present? ? "✓ Key" : "❌ Key")
      status << (company.asic_username.present? ? "✓ User" : "❌ User")
      status << (company.encrypted_asic_password.present? ? "✓ Pass" : "❌ Pass")
      status << (company.encrypted_recovery_answer.present? ? "✓ Recovery" : "⚠️  Recovery")

      puts "#{company.name} (ID: #{company.id})"
      puts "  #{status.join('  ')}"
      puts
    end
  end
end
