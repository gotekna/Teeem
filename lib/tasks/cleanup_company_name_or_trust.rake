namespace :contacts do
  desc "Clear company_name_or_trust for people who have primary_company_id set"
  task cleanup_company_name_or_trust: :environment do
    puts "=" * 60
    puts "CLEANING UP COMPANY_NAME_OR_TRUST FIELD"
    puts "=" * 60
    puts

    # Find all people with BOTH primary_company_id AND company_name_or_trust set
    contacts = Contact.where(entity_type: "person")
                     .where.not(primary_company_id: nil)
                     .where.not(company_name_or_trust: [ nil, "" ])
                     .order(:id)

    puts "Found #{contacts.count} people with both primary_company_id and company_name_or_trust"
    puts

    if contacts.count == 0
      puts "No cleanup needed!"
      return
    end

    contacts.each do |contact|
      company = Contact.find_by(id: contact.primary_company_id)
      old_value = contact.company_name_or_trust

      contact.update_column(:company_name_or_trust, nil)

      puts "✓ [#{contact.id}] #{contact.full_name}"
      puts "  Cleared: '#{old_value}'"
      puts "  Linked to: [#{company&.id}] #{company&.full_name}"
      puts
    end

    puts "=" * 60
    puts "COMPLETE - Cleared #{contacts.count} company_name_or_trust fields"
    puts "=" * 60
  end
end
