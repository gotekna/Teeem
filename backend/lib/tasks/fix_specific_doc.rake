namespace :documents do
  desc "Fix specific Financial Statements document - find correct file in SharePoint"
  task fix_financial_statements: :environment do
    puts "=" * 60
    puts "FIXING FINANCIAL STATEMENTS DOCUMENT"
    puts "=" * 60

    # Find the document
    doc = CorporateCompanyDocument.where("file_name ILIKE ?", "%Financial Statements Harder Family Trust%").first

    unless doc
      puts "Document not found!"
      exit 1
    end

    puts "Found document:"
    puts "  ID: #{doc.id}"
    puts "  File name: #{doc.file_name}"
    puts "  SharePoint ID: #{doc.sharepoint_file_id}"
    puts "  Company: #{doc.corporate_company&.code}"
    puts ""

    credential = MicrosoftCredential.sharepoint_credential
    client = MicrosoftGraphClient.new(credential)

    # Check what SharePoint currently has for this ID
    begin
      sp_file = client.get_file(doc.sharepoint_file_id)
      puts "SharePoint file for current ID:"
      puts "  Name: #{sp_file['name']}"
      puts "  Path: #{sp_file.dig('parentReference', 'path')}"

      if sp_file["name"] == doc.file_name
        puts ""
        puts "✅ Names match - no fix needed"
        exit 0
      end

      puts ""
      puts "❌ MISMATCH - SharePoint ID points to wrong file!"
      puts ""
    rescue => e
      puts "Error getting current file: #{e.message}"
    end

    # Search for the correct file
    puts "Searching SharePoint for: #{doc.file_name}"
    search_term = "Financial Statements Harder"
    search_results = client.search(search_term)

    if search_results["value"].blank?
      puts "No search results found"
      exit 1
    end

    puts "Found #{search_results['value'].count} results:"
    search_results["value"].each do |result|
      puts "  - #{result['name']} (ID: #{result['id']})"
      puts "    Path: #{result.dig('parentReference', 'path')}"
    end

    # Find exact match
    correct_file = search_results["value"].find { |r| r["name"] == doc.file_name }

    if correct_file
      puts ""
      puts "✅ Found exact match!"
      puts "   Name: #{correct_file['name']}"
      puts "   ID: #{correct_file['id']}"
      puts ""

      if correct_file["id"] != doc.sharepoint_file_id
        old_id = doc.sharepoint_file_id
        doc.update!(sharepoint_file_id: correct_file["id"])
        puts "✅ FIXED! Updated sharepoint_file_id:"
        puts "   Old: #{old_id}"
        puts "   New: #{correct_file['id']}"
      else
        puts "IDs already match - nothing to fix"
      end
    else
      puts ""
      puts "❌ Could not find exact match for filename"
      puts "You may need to manually identify the correct file from the list above"
    end
  end
end
