namespace :contacts do
  desc "Convert people incorrectly classified as companies back to person entity type"
  task convert_companies_to_people: :environment do
    puts "=" * 60
    puts "CONVERTING COMPANIES BACK TO PEOPLE"
    puts "=" * 60
    puts

    # IDs of people incorrectly classified as companies
    person_ids = [
      1327, 1330, 1331, 1353, 1365, 1374, 1413, 1428, 1430, 1432,
      1440, 1442, 1450, 1451, 1453, 1454, 1456, 1457, 1459, 1460,
      1463, 1464, 1465, 1466, 1467, 1471, 1473, 1477, 1481, 1494,
      1504, 1510, 1512, 1517, 1533, 1534, 1550, 1555, 1558, 1565,
      1566, 1567, 1571
    ]

    puts "Converting #{person_ids.count} contacts back to person"
    puts

    stats = {
      converted: 0,
      errors: []
    }

    person_ids.each do |contact_id|
      begin
        contact = Contact.find(contact_id)

        puts "[#{contact.id}] #{contact.full_name}"
        puts "  Current entity_type: #{contact.entity_type}"

        # Delete Company record if it exists
        company = Company.find_by(contact_id: contact.id)
        if company
          company.destroy
          puts "  × Deleted Company record"
        end

        # Update to person
        contact.update_column(:entity_type, "person")
        puts "  ✓ Converted to person"
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
