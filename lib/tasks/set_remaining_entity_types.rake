namespace :contacts do
  desc "Manually set entity types for remaining unclear contacts"
  task set_remaining_entity_types: :environment do
    puts "=" * 60
    puts "MANUALLY SETTING REMAINING ENTITY TYPES"
    puts "=" * 60
    puts

    # Find contacts with no entity_type
    contacts = Contact.where(entity_type: [ nil, "" ]).order(:id)

    puts "Found #{contacts.count} contacts with no entity_type"
    puts

    # Manual categorization based on names
    companies = [
      "Hafele", "Tradelink", "Hymix", "Dulux", "Buildmat", "Lydons", "Stratus",
      "hafele", "tradelink", "hymix", "dulux", "buildmat", "lydons", "stratus"
    ]

    people = [
      "Deepak", "Matthew", "James", "Pete", "Amy", "Alan", "Michael", "Louise",
      "Somya", "Rosanna", "Ben", "Zana", "Kylie", "Nk", "Kashif", "Dax",
      "Jillian.d.Purdie", "deepak", "matthew", "james", "pete", "amy", "alan",
      "michael", "louise", "somya", "rosanna", "ben", "zana", "kylie", "nk",
      "kashif", "dax", "jillian"
    ]

    test_data = [ "TistTest", "Client", "tisttest", "client" ]

    stats = {
      people: 0,
      companies: 0,
      test_deleted: 0,
      skipped: 0
    }

    contacts.each do |c|
      name = c.full_name.to_s.strip

      if test_data.any? { |t| name.downcase.include?(t.downcase) }
        puts "🗑️  Deleting test data: [#{c.id}] #{name}"
        c.destroy
        stats[:test_deleted] += 1
      elsif companies.any? { |comp| name.downcase.include?(comp.downcase) }
        c.update_column(:entity_type, "company")
        puts "🏢 Company: [#{c.id}] #{name}"
        stats[:companies] += 1
      elsif people.any? { |person| name.downcase.include?(person.downcase) }
        c.update_column(:entity_type, "person")
        puts "👤 Person: [#{c.id}] #{name}"
        stats[:people] += 1
      else
        puts "❓ SKIPPED: [#{c.id}] #{name}"
        stats[:skipped] += 1
      end
    end

    puts
    puts "=" * 60
    puts "UPDATE COMPLETE"
    puts "=" * 60
    puts "People set:        #{stats[:people]}"
    puts "Companies set:     #{stats[:companies]}"
    puts "Test data deleted: #{stats[:test_deleted]}"
    puts "Skipped:           #{stats[:skipped]}"
    puts
    puts "Final contact count: #{Contact.count}"
    puts "Contacts with no entity_type: #{Contact.where(entity_type: [ nil, '' ]).count}"
  end
end
