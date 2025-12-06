namespace :corporate do
  desc "Categorize Tekna Drafting documents by document type"
  task categorize_tekna_documents: :environment do
    puts "Categorizing Tekna Drafting Documents"
    puts "=" * 80

    begin
      # Find Tekna Drafting company
      company = Company.find_by("name ILIKE ?", "%Tekna Drafting%")
      unless company
        puts "❌ Tekna Drafting company not found"
        exit 1
      end

      puts "✅ Found company: #{company.name} (ID: #{company.id})"
      puts ""

      # Get ALL documents for categorization
      docs = company.company_documents
      puts "Found #{docs.count} documents to categorize"
      puts ""

      updated = 0
      skipped = 0

      docs.each do |doc|
        filename = doc.file_name.to_s
        old_type = doc.document_type

        # Determine correct document type based on filename
        new_type = case filename
        # ATO/Tax documents
        when /ATO Tax Return/i
          "ATO Tax Return"
        when /EOY ATO/i
          "End of Year ATO Return"
        when /Tax File Number/i, /TFN/i
          "ATO Documents"
        when /BAS/i
          "Business Activity Statement"
        when /Tax Consolidation/i
          "Tax Consolidation Schedule"

        # ASIC documents
        when /EOY ASIC/i
          "End of Year ASIC Return"
        when /Solvency ASIC/i
          "ASIC Solvency Declaration"
        when /Corporate Key/i
          "Corporate Key"
        when /ASIC Key/i
          "ASIC Company Key"
        when /ASIC/i
          "ASIC Documents"

        # Corporate setup documents
        when /Constitution/i
          "Constitution"
        when /Company Setup/i
          "Company Setup"
        when /Register of Members/i
          "Register of Members"
        when /Structure/i
          "Structure"

        # Minutes and resolutions
        when /Board Resolution.*Loan/i
          "Distribution Resolution"
        when /Minutes/i, /Board Resolution/i
          "Company Minutes"

        # Director changes
        when /Appoint.*Director/i, /Resignation.*Director/i, /Change.*Director/i
          "Director and Officer Changes"
        when /Registered Office/i
          "Registered Office Address"

        # Financial documents
        when /EOY NAB/i, /EOY WBC/i, /Bank Statement/i
          "Bank Statement"

        # Loan documents
        when /Loan Agreement/i
          "Loan Agreement"
        when /Security Deed/i
          "Security Deed"
        when /Loan/i, /Token Issued/i, /Verification Statement/i
          "Loan Agreement"

        # Asset documents
        when /Asset/i
          "Asset"

        # Distributions
        when /Dividend/i
          "Dividend Payment"
        when /Distribution/i
          "Distribution"

        # Trust documents
        when /Trust Deed/i
          "Trust Deed"

        else
          # Keep existing type if no match
          old_type
        end

        # Update if different
        if new_type != old_type
          doc.update!(document_type: new_type)
          puts "  ✅ #{filename.ljust(60)} | #{old_type.ljust(20)} → #{new_type}"
          updated += 1
        else
          skipped += 1
        end
      end

      puts ""
      puts "=" * 80
      puts "CATEGORIZATION COMPLETE"
      puts "=" * 80
      puts "Documents updated: #{updated}"
      puts "Documents skipped (already correct): #{skipped}"
      puts ""
      puts "✅ Documents are now properly categorized and filterable!"

    rescue => e
      puts "❌ Error: #{e.class}"
      puts "   Message: #{e.message}"
      puts ""
      puts "Stack trace:"
      puts e.backtrace.first(10).map { |line| "   #{line}" }.join("\n")
    end
  end
end
