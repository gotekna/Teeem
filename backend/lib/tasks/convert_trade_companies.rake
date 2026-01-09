namespace :contacts do
  desc "Convert Trade companies from person to company entity type"
  task convert_trade_companies: :environment do
    puts "=" * 60
    puts "CONVERTING TRADE COMPANIES FROM PERSON TO COMPANY"
    puts "=" * 60
    puts

    trade_companies = [ 1654, 1825, 1877 ]

    trade_companies.each do |contact_id|
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
    end

    puts "=" * 60
    puts "COMPLETE - Converted #{trade_companies.count} contacts"
    puts "=" * 60
  end
end
