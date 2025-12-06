namespace :contacts do
  desc "Convert business contacts from person to company entity type"
  task convert_business_contacts: :environment do
    puts "=" * 60
    puts "CONVERTING BUSINESS CONTACTS FROM PERSON TO COMPANY"
    puts "=" * 60
    puts

    # Search for business-sounding contacts in person entity type
    keywords = [
      "miele", "timberwood", "taylex", "betaboard",
      "tiles queensland", "hydraulink", "gsc", "landscaping standard",
      "hamilton smith", "icon", "slip flash", "pal plumbing"
    ]

    people = Contact.where(entity_type: "person")
    found = Set.new

    keywords.each do |keyword|
      matches = people.where("full_name ILIKE ?", "%#{keyword}%")
      found.merge(matches.to_a)
    end

    # Filter to likely companies (exclude obvious people names)
    likely_companies = found.select do |c|
      name = c.full_name.downcase
      # Include if contains business keywords
      name.match?(/pty|ltd|plumbing|electrical|tiles|design|landscaping|hydraulic|timber|icon|flash|gsc|betaboard|taylex|miele/)
    end

    puts "Found #{likely_companies.count} business contacts to convert"
    puts

    if likely_companies.count == 0
      puts "No business contacts found to convert!"
      return
    end

    stats = {
      converted: 0,
      errors: []
    }

    puts "=" * 60
    puts "CONVERTING"
    puts "=" * 60
    puts

    likely_companies.sort_by(&:id).each do |contact|
      old_type = contact.entity_type

      begin
        puts "[#{contact.id}] #{contact.full_name}"
        puts "  Current entity_type: #{old_type}"

        # Update to company
        contact.update_column(:entity_type, "company")

        # Create Company record if it doesn't exist
        unless Company.exists?(contact_id: contact.id)
          Company.create!(
            name: contact.full_name,
            contact_id: contact.id,
            status: "active"
          )
          puts "  ✓ Converted to company + Created Company record"
        else
          puts "  ✓ Converted to company (Company record already exists)"
        end
        puts

        stats[:converted] += 1
      rescue => e
        error_msg = "Failed to convert [#{contact.id}] #{contact.full_name}: #{e.message}"
        puts "✗ #{error_msg}"
        stats[:errors] << error_msg
      end
    end

    puts "=" * 60
    puts "COMPLETE"
    puts "=" * 60
    puts "Converted: #{stats[:converted]}"
    puts "Errors: #{stats[:errors].count}"
    puts

    if stats[:errors].any?
      puts "Error details:"
      stats[:errors].each { |err| puts "  - #{err}" }
    end
  end
end
