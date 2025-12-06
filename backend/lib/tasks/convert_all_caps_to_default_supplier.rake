namespace :contacts do
  desc "Convert all ALL CAPS contacts to default_supplier entity type"
  task convert_all_caps_to_default_supplier: :environment do
    puts "=" * 60
    puts "CONVERTING ALL CAPS CONTACTS TO DEFAULT_SUPPLIER"
    puts "=" * 60
    puts

    # Find contacts where full_name is all uppercase
    all_contacts = Contact.where.not(full_name: [nil, ''])

    all_caps_contacts = all_contacts.select do |c|
      c.full_name == c.full_name.upcase && c.full_name.match?(/[A-Z]/)
    end

    puts "Found #{all_caps_contacts.count} contacts with ALL CAPS names"
    puts

    # Group by current entity type
    by_type = all_caps_contacts.group_by(&:entity_type)
    by_type.each do |entity_type, group|
      puts "  #{entity_type || 'NULL'}: #{group.count}"
    end
    puts

    # Filter to only those that need conversion (not already default_supplier)
    to_convert = all_caps_contacts.reject { |c| c.entity_type == 'default_supplier' }

    puts "Need to convert: #{to_convert.count} contacts"
    puts

    if to_convert.count == 0
      puts "All ALL CAPS contacts are already default_supplier!"
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

    to_convert.each do |contact|
      old_type = contact.entity_type

      begin
        # Update entity_type and clear first_name/last_name
        contact.update_columns(
          entity_type: 'default_supplier',
          first_name: nil,
          last_name: nil
        )
        puts "✓ [#{contact.id}] #{contact.full_name}"
        puts "  #{old_type} → default_supplier (cleared first_name/last_name)"
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
