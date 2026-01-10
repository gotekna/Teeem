namespace :documents do
  desc "Find and fix all SharePoint ID mismatches in company documents"
  task fix_sharepoint_mismatches: :environment do
    puts "=" * 60
    puts "SHAREPOINT DOCUMENT MISMATCH FIX"
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

          # Try to find the correct file
          search_results = client.search(doc.file_name)

          if search_results["value"].present?
            correct_file = search_results["value"].find do |result|
              result["name"] == doc.file_name &&
              (result.dig("parentReference", "path") || "").include?(doc.corporate_company&.code.to_s)
            end

            if correct_file && correct_file["id"] != doc.sharepoint_file_id
              old_id = doc.sharepoint_file_id
              doc.update!(sharepoint_file_id: correct_file["id"])
              fixed << { id: doc.id, old_id: old_id, new_id: correct_file["id"] }
              puts "     ✅ FIXED: Updated sharepoint_file_id"
              puts "        Old: #{old_id}"
              puts "        New: #{correct_file["id"]}"
            else
              puts "     ⚠️  Could not find correct file in SharePoint"
            end
          else
            puts "     ⚠️  No search results for: #{doc.file_name}"
          end
        end
      rescue MicrosoftGraphClient::APIError => e
        errors << { id: doc.id, file_name: doc.file_name, error: e.message }
        # Don't print every error - too noisy
      rescue => e
        errors << { id: doc.id, file_name: doc.file_name, error: e.message }
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
        puts "  ID #{f[:id]}: #{f[:old_id]} -> #{f[:new_id]}"
      end
      puts ""
    end

    if (mismatches.count - fixed.count) > 0
      puts "UNFIXED MISMATCHES (#{mismatches.count - fixed.count}):"
      (mismatches - fixed.map { |f| mismatches.find { |m| m[:id] == f[:id] } }).compact.each do |m|
        puts "  ID #{m[:id]} (#{m[:company_code]}): #{m[:db_name]}"
      end
    end
  end
end
