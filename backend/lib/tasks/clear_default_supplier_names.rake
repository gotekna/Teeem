namespace :contacts do
  desc "Clear first_name and last_name from ALL CAPS default_supplier contacts"
  task clear_default_supplier_names: :environment do
    puts "=" * 60
    puts "CLEARING FIRST_NAME AND LAST_NAME FROM DEFAULT SUPPLIERS"
    puts "=" * 60
    puts

    # Find ALL CAPS default_supplier contacts with first_name or last_name
    all_contacts = Contact.where(entity_type: "default_supplier")
                          .where.not(full_name: [ nil, "" ])

    all_caps_contacts = all_contacts.select do |c|
      c.full_name == c.full_name.upcase && c.full_name.match?(/[A-Z]/)
    end

    puts "Found #{all_caps_contacts.count} ALL CAPS default_supplier contacts"
    puts

    # Filter to only those with first_name or last_name
    with_names = all_caps_contacts.select do |c|
      c.first_name.present? || c.last_name.present?
    end

    puts "Need to clear names: #{with_names.count}"
    puts

    if with_names.count == 0
      puts "All default suppliers already have empty first_name and last_name!"
      return
    end

    stats = {
      cleared: 0,
      errors: []
    }

    puts "=" * 60
    puts "CLEARING"
    puts "=" * 60
    puts

    with_names.each do |contact|
      begin
        old_first = contact.first_name
        old_last = contact.last_name

        contact.update_columns(
          first_name: nil,
          last_name: nil
        )

        puts "✓ [#{contact.id}] #{contact.full_name}"
        puts "  Cleared first_name: #{old_first.inspect}" if old_first.present?
        puts "  Cleared last_name: #{old_last.inspect}" if old_last.present?
        puts
        stats[:cleared] += 1
      rescue => e
        error_msg = "Failed to clear [#{contact.id}] #{contact.full_name}: #{e.message}"
        puts "✗ #{error_msg}"
        stats[:errors] << error_msg
      end
    end

    puts "=" * 60
    puts "COMPLETE"
    puts "=" * 60
    puts "Cleared: #{stats[:cleared]}"
    puts "Errors: #{stats[:errors].count}"
    puts

    if stats[:errors].any?
      puts "Error details:"
      stats[:errors].each { |err| puts "  - #{err}" }
    end
  end
end
