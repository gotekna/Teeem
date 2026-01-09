# Analyze the 8 unclassified files to understand their content
job = Job.find(69)
puts "=== ANALYZING UNCLASSIFIED FILES FOR JOB 69 ==="
puts ""

service = JobDocumentMigrationService.new
files = service.list_legacy_files_for_job(job)

# The 8 files that need review
unclassified_names = [
  "Lot 83 Westridge.pdf",
  "Lot_83_Westridge.pdf",
  "20240209 Referral Agency Response for CAR24_0041.pdf",
  "20240305 Minor Change Existing Approval for CAR24_0041.01.pdf",
  "Form 1 - Lot 83 West Ridge Street, THORNLANDS.pdf",
  "210.535-SUBLINE_700-U-en-AU.pdf",
  "Vanity.pdf",
  "038925 Install.pdf"
]

credential = OrganizationOneDriveCredential.active_credential
client = MicrosoftGraphClient.new(credential)

unclassified_names.each do |name|
  file = files.find { |f| f[:name] == name }
  next unless file

  puts "=" * 60
  puts "FILE: #{name}"
  puts "Size: #{(file[:size].to_f / 1024 / 1024).round(2)} MB"
  puts ""

  # For PDFs, try to get metadata or first page text
  if name.end_with?(".pdf")
    begin
      # Get file metadata from OneDrive
      metadata = client.get_file(file[:id])
      puts "Created: #{metadata['createdDateTime']}"
      puts "Modified: #{metadata['lastModifiedDateTime']}"
      puts "Path: #{metadata.dig('parentReference', 'path')}"

      # Try to use AI to analyze if small enough
      if file[:size] < 5_000_000  # Under 5MB
        # Download first bit of content for analysis
        puts ""
        puts "SUGGESTED CLASSIFICATION:"

        # Analyze filename patterns
        if name.include?("Westridge") && !name.include?("Form")
          puts "  -> 04 Plans (Sales or Presentation plans based on 'Westridge' naming)"
          puts "  -> Type: SPLAN (Sales Plan)"
        elsif name.include?("Referral Agency Response")
          puts "  -> 03 Certification/Council (Agency referral response)"
          puts "  -> Type: COUNCIL"
        elsif name.include?("Minor Change")
          puts "  -> 03 Certification/Council (Approval amendment)"
          puts "  -> Type: COUNCIL"
        elsif name.include?("Form 1")
          puts "  -> 02 PreCon/Contracts (Form 1 - Building application)"
          puts "  -> Type: JCON (or new type: FORM1)"
        elsif name.match?(/^\d+\.\d+.*-en-AU/)
          puts "  -> 02 PreCon/Colour Selection (Product spec - Blanco sink)"
          puts "  -> Type: COLOR"
        elsif name == "Vanity.pdf"
          puts "  -> 02 PreCon/Colour Selection (Bathroom fixture spec)"
          puts "  -> Type: COLOR"
        elsif name.include?("Install")
          puts "  -> 03 Certification (Installation certificate)"
          puts "  -> Type: CERT"
        end
      end
    rescue => e
      puts "Error analyzing: #{e.message}"
    end
  end
  puts ""
end

puts "=" * 60
puts ""
puts "RECOMMENDED NEW DOCUMENT TYPES / ALIASES:"
puts ""
puts "1. Update SPLAN (Sales Plan) aliases to include:"
puts "   - lot + address pattern (e.g. 'lot 83 westridge')"
puts ""
puts "2. Update COUNCIL aliases to include:"
puts "   - 'referral agency', 'minor change', 'approval'"
puts ""
puts "3. Update JCON aliases to include:"
puts "   - 'form 1', 'form1', 'building application'"
puts ""
puts "4. Update COLOR aliases to include:"
puts "   - product codes like '210.535', 'subline'"
puts "   - 'vanity', 'sink', 'tap', 'mixer'"
puts ""
puts "5. Update CERT aliases to include:"
puts "   - 'install', 'installation'"
