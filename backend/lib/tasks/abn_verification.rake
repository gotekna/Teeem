namespace :contacts do
  namespace :abn do
    desc "Verify ABN format for all contacts (no API call)"
    task check_format: :environment do
      puts "Checking ABN format for all contacts..."

      contacts_with_abn = Contact.where.not(tax_number: [ nil, "" ])
      total = contacts_with_abn.count
      puts "Found #{total} contacts with ABN/tax_number"

      valid = 0
      invalid = 0
      invalid_list = []

      contacts_with_abn.find_each do |contact|
        if contact.abn_format_valid?
          valid += 1
        else
          invalid += 1
          invalid_list << {
            id: contact.id,
            name: contact.display_name,
            abn: contact.tax_number
          }
        end
      end

      puts "\n=== Format Check Results ==="
      puts "Valid format: #{valid}"
      puts "Invalid format: #{invalid}"

      if invalid_list.any?
        puts "\nInvalid ABNs:"
        invalid_list.first(20).each do |c|
          puts "  - #{c[:name]} (ID: #{c[:id]}): #{c[:abn]}"
        end
        puts "  ... and #{invalid_list.count - 20} more" if invalid_list.count > 20
      end
    end

    desc "Verify ABNs via ABR API (requires ABR_GUID env var)"
    task verify: :environment do
      unless ENV["ABR_GUID"].present?
        puts "ERROR: ABR_GUID environment variable not set."
        puts "Register at https://abr.business.gov.au/RegisterAgreement.aspx to get your GUID"
        exit 1
      end

      puts "Verifying ABNs via ABR API..."

      # Get contacts that need verification
      contacts = Contact.where.not(tax_number: [ nil, "" ])
                        .where(abn_verified_at: nil)
      total = contacts.count
      puts "Found #{total} contacts with unverified ABNs"

      if total == 0
        puts "All ABNs have been verified!"
        exit 0
      end

      verified = 0
      invalid_format = 0
      not_found = 0
      api_errors = 0

      service = AbrApiService.new

      contacts.find_each.with_index do |contact, index|
        begin
          result = contact.verify_abn!
          verified += 1
          puts "#{index + 1}/#{total}: #{contact.display_name} - VERIFIED (#{result[:entity_name]})"
        rescue AbrApiService::InvalidAbnFormat => e
          invalid_format += 1
          puts "#{index + 1}/#{total}: #{contact.display_name} - INVALID FORMAT: #{e.message}"
        rescue AbrApiService::AbnNotFound => e
          not_found += 1
          puts "#{index + 1}/#{total}: #{contact.display_name} - NOT FOUND: #{contact.tax_number}"
        rescue AbrApiService::ApiError => e
          api_errors += 1
          puts "#{index + 1}/#{total}: #{contact.display_name} - API ERROR: #{e.message}"
        end

        # Rate limiting - ABR doesn't have strict limits but be nice
        sleep(0.5)
      end

      puts "\n=== Verification Complete ==="
      puts "Verified: #{verified}"
      puts "Invalid format: #{invalid_format}"
      puts "Not found in ABR: #{not_found}"
      puts "API errors: #{api_errors}"
    end

    desc "Show ABN verification status"
    task status: :environment do
      puts "=== ABN Verification Status ==="
      puts ""

      total_with_abn = Contact.where.not(tax_number: [ nil, "" ]).count
      verified = Contact.where.not(abn_verified_at: nil).count
      valid = Contact.where(abn_valid: true).count
      invalid = Contact.where(abn_valid: false).count
      unverified = Contact.where.not(tax_number: [ nil, "" ]).where(abn_verified_at: nil).count
      gst_registered = Contact.where(abn_gst_registered: true).count

      puts "Total contacts with ABN: #{total_with_abn}"
      puts "  - Verified: #{verified}"
      puts "    - Valid: #{valid}"
      puts "    - Invalid: #{invalid}"
      puts "  - Not yet verified: #{unverified}"
      puts ""
      puts "GST registered: #{gst_registered}"

      if unverified > 0
        puts ""
        puts "Run 'rake contacts:abn:verify' to verify remaining ABNs"
        puts "(Requires ABR_GUID environment variable)"
      end
    end

    desc "Find missing ABNs by searching company names"
    task find_missing: :environment do
      unless ENV["ABR_GUID"].present?
        puts "ERROR: ABR_GUID environment variable not set."
        puts "Register at https://abr.business.gov.au/RegisterAgreement.aspx to get your GUID"
        exit 1
      end

      puts "Finding missing ABNs by company name..."
      puts ""

      # Get contacts without ABNs (excluding individuals)
      contacts_without_abn = Contact.where(tax_number: [ nil, "" ])
                                   .where.not(display_name: [ nil, "" ])

      total = contacts_without_abn.count
      puts "Found #{total} contacts without ABN"

      if total == 0
        puts "All contacts have ABNs!"
        exit 0
      end

      found = 0
      not_found = 0
      multiple_matches = 0
      skipped = 0
      api_errors = 0

      service = AbrApiService.new

      contacts_without_abn.find_each.with_index do |contact, index|
        # Skip if display_name looks like a person's name
        if contact.display_name.match?(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
          skipped += 1
          puts "#{index + 1}/#{total}: #{contact.display_name} - SKIPPED (individual name)"
          next
        end

        begin
          results = service.search_by_name(contact.display_name)

          if results.empty?
            not_found += 1
            puts "#{index + 1}/#{total}: #{contact.display_name} - NOT FOUND"
          elsif results.length == 1
            # Single match - high confidence
            match = results.first
            contact.update!(tax_number: match[:abn])
            found += 1
            puts "#{index + 1}/#{total}: #{contact.display_name} - FOUND: #{match[:abn_formatted]} (#{match[:name]})"

            # Auto-verify the new ABN
            sleep(0.5)
            contact.verify_abn! rescue nil
          else
            # Multiple matches - show top 3
            multiple_matches += 1
            puts "#{index + 1}/#{total}: #{contact.display_name} - MULTIPLE MATCHES (#{results.length}):"
            results.first(3).each do |match|
              puts "  - #{match[:abn_formatted]}: #{match[:name]} (score: #{match[:score]})"
            end
          end
        rescue AbrApiService::ApiError => e
          api_errors += 1
          puts "#{index + 1}/#{total}: #{contact.display_name} - API ERROR: #{e.message}"
        end

        # Rate limiting
        sleep(0.5)
      end

      puts "\n=== Search Complete ==="
      puts "Found and updated: #{found}"
      puts "Not found: #{not_found}"
      puts "Multiple matches (manual review needed): #{multiple_matches}"
      puts "Skipped (individuals): #{skipped}"
      puts "API errors: #{api_errors}"

      if multiple_matches > 0
        puts "\nNote: Contacts with multiple matches need manual review."
        puts "Check the output above for suggested ABNs."
      end
    end

    desc "Search for ABN by company name (interactive)"
    task :search, [ :name ] => :environment do |t, args|
      unless args[:name]
        puts "Usage: rake contacts:abn:search['Company Name']"
        puts "Example: rake contacts:abn:search['Australian Taxation Office']"
        exit 1
      end

      unless ENV["ABR_GUID"].present?
        puts "ERROR: ABR_GUID environment variable not set."
        exit 1
      end

      service = AbrApiService.new
      puts "Searching for: #{args[:name]}"
      puts ""

      begin
        results = service.search_by_name(args[:name])

        if results.empty?
          puts "No results found"
        else
          puts "=== Search Results (#{results.length}) ==="
          results.each_with_index do |match, index|
            puts "\n#{index + 1}. #{match[:name]}"
            puts "   ABN: #{match[:abn_formatted]}"
            puts "   Trading Names: #{match[:trading_names].join(', ')}" if match[:trading_names].any?
            puts "   Location: #{match[:state]} #{match[:postcode]}" if match[:state].present?
            puts "   Relevance Score: #{match[:score]}"
          end
        end
      rescue AbrApiService::AbrError => e
        puts "ERROR: #{e.message}"
      end
    end

    desc "Test ABN lookup (single ABN)"
    task :test, [ :abn ] => :environment do |t, args|
      unless args[:abn]
        puts "Usage: rake contacts:abn:test[ABN]"
        puts "Example: rake contacts:abn:test[51824753556]"
        exit 1
      end

      unless ENV["ABR_GUID"].present?
        puts "ERROR: ABR_GUID environment variable not set."
        exit 1
      end

      service = AbrApiService.new
      puts "Looking up ABN: #{AbrApiService.format(args[:abn])}"
      puts ""

      begin
        result = service.lookup(args[:abn])
        puts "=== ABN Details ==="
        puts "ABN: #{result[:abn_formatted]}"
        puts "Valid: #{result[:valid]}"
        puts "Active: #{result[:active]}"
        puts "Entity Name: #{result[:entity_name]}"
        puts "Entity Type: #{result[:entity_type_description]}"
        puts "GST Registered: #{result[:gst_registered]}"
        puts "Verified At: #{result[:verified_at]}"
      rescue AbrApiService::AbrError => e
        puts "ERROR: #{e.message}"
      end
    end
  end
end
