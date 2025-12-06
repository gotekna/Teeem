namespace :contacts do
  desc "Convert remaining business contacts from person to company"
  task convert_remaining_businesses: :environment do
    puts "=" * 60
    puts "CONVERTING REMAINING BUSINESS CONTACTS"
    puts "=" * 60
    puts

    # IDs of business contacts found in person entity type
    business_ids = [
      1897, # Titles Queensland
      1895, # Hydraulink
      1893, # GC Landscaping
      1592, # Oasis Landscaping
      1658, # Nuway Landscaping
      1887, # Standard Design Contract
      1666, # Brisbane City Council
      1716, # Ipswich City Council
      1796, # City Ambassadors Association
      1738, # Flash Electrical
      1337  # All Clear Electrical
    ]

    puts "Converting #{business_ids.count} business contacts"
    puts

    stats = {
      converted: 0,
      errors: []
    }

    business_ids.each do |contact_id|
      begin
        contact = Contact.find(contact_id)

        puts "[#{contact.id}] #{contact.full_name}"
        puts "  Current entity_type: #{contact.entity_type}"

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
        error_msg = "Failed to convert [#{contact_id}]: #{e.message}"
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
