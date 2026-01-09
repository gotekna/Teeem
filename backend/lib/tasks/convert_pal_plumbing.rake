namespace :contacts do
  desc "Convert PAL Plumbing from person to company entity type"
  task convert_pal_plumbing: :environment do
    puts "=" * 60
    puts "CONVERTING PAL PLUMBING FROM PERSON TO COMPANY"
    puts "=" * 60
    puts

    contact_id = 1888
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

    puts "=" * 60
    puts "COMPLETE - Converted #{contact.full_name}"
    puts "=" * 60
  end
end
