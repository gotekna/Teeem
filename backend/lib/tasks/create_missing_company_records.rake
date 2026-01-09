namespace :contacts do
  desc "Create missing Company records for company contacts"
  task create_missing_company_records: :environment do
    puts "=" * 60
    puts "CREATE MISSING COMPANY RECORDS"
    puts "=" * 60
    puts

    # Find company contacts without Company records
    companies_without_record = Contact.where(entity_type: [ "company", "trust" ])
                                      .where.not("EXISTS (SELECT 1 FROM companies WHERE companies.contact_id = contacts.id)")
                                      .order(:id)

    puts "Found #{companies_without_record.count} company contacts without Company records"
    puts

    if companies_without_record.count == 0
      puts "No missing records!"
      return
    end

    stats = {
      created: 0,
      errors: 0
    }

    companies_without_record.find_each do |contact|
      begin
        # Create Company record
        company = Company.create!(
          name: contact.full_name || contact.company_name_or_trust || "Unknown",
          contact_id: contact.id,
          status: contact.is_active ? "active" : "inactive",
          abn: contact.tax_number,
          acn: contact.company_number,
          registered_office_address: contact.address
        )

        stats[:created] += 1
        puts "✓ Created Company [#{company.id}] for contact [#{contact.id}] #{contact.full_name}"

      rescue => e
        stats[:errors] += 1
        puts "✗ ERROR [#{contact.id}] #{contact.full_name}: #{e.message}"
      end
    end

    puts
    puts "=" * 60
    puts "CREATION COMPLETE"
    puts "=" * 60
    puts "Companies created:  #{stats[:created]}"
    puts "Errors:             #{stats[:errors]}"
    puts
  end

  desc "Preview company contacts without Company records"
  task preview_missing_company_records: :environment do
    companies_without_record = Contact.where(entity_type: [ "company", "trust" ])
                                      .where.not("EXISTS (SELECT 1 FROM companies WHERE companies.contact_id = contacts.id)")
                                      .order(:id)

    puts "PREVIEW: Company contacts without Company records (#{companies_without_record.count}):"
    puts

    companies_without_record.limit(20).each do |c|
      puts "ID #{c.id}: #{c.full_name}"
      puts "  Entity type: #{c.entity_type}"
      puts "  ABN: #{c.tax_number}" if c.tax_number.present?
      puts "  Active: #{c.is_active}"
      puts
    end

    puts "... (showing first 20)" if companies_without_record.count > 20
    puts
    puts "Total: #{companies_without_record.count}"
  end
end
