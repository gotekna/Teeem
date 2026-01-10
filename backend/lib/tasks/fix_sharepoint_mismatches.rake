namespace :documents do
  desc "Find and fix all SharePoint ID mismatches in company documents"
  task fix_sharepoint_mismatches: :environment do
    puts "=" * 60
    puts "SHAREPOINT DOCUMENT MISMATCH FIX"
    puts "SSoT: SharePoint filename is truth - update DB to match"
    puts "=" * 60

    credential = MicrosoftCredential.sharepoint_credential
    unless credential
      puts "❌ No SharePoint credential found"
      exit 1
    end

    client = MicrosoftGraphClient.new(credential)

    mismatches = []
    fixed = []
    errors = []

    docs = CorporateCompanyDocument.where.not(sharepoint_file_id: nil).where(source: "sharepoint")
    total = docs.count
    puts "Checking #{total} documents..."
    puts ""

    docs.find_each.with_index do |doc, idx|
      print "\r[#{idx + 1}/#{total}] Checking..."
      $stdout.flush

      begin
        sp_file = client.get_file(doc.sharepoint_file_id)
        sp_name = sp_file["name"]

        unless sp_name == doc.file_name
          mismatches << {
            id: doc.id,
            db_name: doc.file_name,
            sp_name: sp_name,
            company_code: doc.corporate_company&.code
          }
          puts ""
          puts "  ❌ MISMATCH: ID #{doc.id}"
          puts "     DB:        #{doc.file_name}"
          puts "     SharePoint: #{sp_name}"

          # FIX: Update DB filename to match SharePoint (SSoT)
          begin
            old_name = doc.file_name
            doc.update!(file_name: sp_name)
            fixed << { id: doc.id, old_name: old_name, new_name: sp_name }
            puts "     ✅ FIXED: Updated DB filename to match SharePoint"
          rescue => update_error
            errors << { id: doc.id, file_name: doc.file_name, error: "Update failed: #{update_error.message}" }
            puts "     ❌ UPDATE FAILED: #{update_error.message}"
          end
        end
      rescue MicrosoftGraphClient::APIError => e
        errors << { id: doc.id, file_name: doc.file_name, error: "API error: #{e.message}" }
      rescue => e
        errors << { id: doc.id, file_name: doc.file_name, error: "Error: #{e.message}" }
      end
    end

    puts ""
    puts ""
    puts "=" * 60
    puts "RESULTS"
    puts "=" * 60
    puts "Total scanned:    #{total}"
    puts "Mismatches found: #{mismatches.count}"
    puts "Fixed:            #{fixed.count}"
    puts "Errors:           #{errors.count}"
    puts ""

    if fixed.any?
      puts "FIXED DOCUMENTS:"
      fixed.each do |f|
        puts "  ID #{f[:id]}: '#{f[:old_name]}' -> '#{f[:new_name]}'"
      end
      puts ""
    end

    if errors.any?
      puts "ERRORS:"
      errors.each do |e|
        puts "  ID #{e[:id]}: #{e[:error]}"
      end
    end
  end
end
