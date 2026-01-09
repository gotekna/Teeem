namespace :contacts do
  desc "Create Company records for supplier contacts"
  task create_supplier_companies: :environment do
    puts "=" * 60
    puts "CREATING COMPANY RECORDS FOR SUPPLIERS"
    puts "=" * 60
    puts

    # Define company data with proper names and websites
    companies_data = [
      { id: 1500, name: "Hafele Australia", website: "https://www.hafele.com.au" },
      { id: 1505, name: "Stratus", website: nil },
      { id: 1594, name: "Tradelink", website: "https://www.tradelink.com.au" },
      { id: 1647, name: "Lydons", website: nil },
      { id: 1663, name: "Hymix", website: "https://www.hymix.com.au" },
      { id: 1718, name: "Dulux", website: "https://www.dulux.com.au" },
      { id: 1731, name: "Buildmat", website: nil }
    ]

    stats = {
      company_records_created: 0,
      websites_added: 0,
      skipped: 0
    }

    companies_data.each do |data|
      contact = Contact.find_by(id: data[:id])

      unless contact
        puts "⚠️  Contact #{data[:id]} not found - SKIPPED"
        stats[:skipped] += 1
        next
      end

      # Check if Company record already exists
      if Company.exists?(contact_id: data[:id])
        puts "ℹ️  [#{data[:id]}] #{contact.full_name} - Company record already exists"
        stats[:skipped] += 1
        next
      end

      # Update contact with proper company name
      contact.update_columns(
        full_name: data[:name],
        company_name_or_trust: data[:name],
        website: data[:website]
      )

      # Create Company record
      company = Company.create!(
        name: data[:name],
        contact_id: contact.id,
        status: "active"
      )

      puts "✓ Created Company record for [#{contact.id}] #{data[:name]}"
      if data[:website]
        puts "  → Website: #{data[:website]}"
        stats[:websites_added] += 1
      end
      stats[:company_records_created] += 1
    end

    puts
    puts "=" * 60
    puts "COMPLETE"
    puts "=" * 60
    puts "Company records created: #{stats[:company_records_created]}"
    puts "Websites added:          #{stats[:websites_added]}"
    puts "Skipped:                 #{stats[:skipped]}"
    puts
  end
end
