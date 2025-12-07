namespace :contacts do
  desc "Extract employee data from accounts@ contacts and link to companies"
  task extract_employees_from_accounts: :environment do
    puts "🔍 Extracting employees from accounts@ contacts..."
    puts ""

    # Find person contacts with accounts@ emails (excluding generic "Accounts Team")
    person_accounts = Contact.where('email ILIKE ?', 'accounts@%')
                            .where(entity_type: 'person')
                            .where.not(full_name: ['Accounts Team', 'accounts team', '', nil])
                            .where(deleted: [false, nil])

    puts "Found #{person_accounts.count} person contacts with accounts@ emails"
    puts ""

    person_accounts.each do |person|
      # Extract company name from email domain
      domain = person.email.split('@').last
      company_domain = domain.split('.').first
      company_name = company_domain.titleize

      puts "👤 Processing: #{person.full_name} (ID: #{person.id})"
      puts "   Email: #{person.email}"
      puts "   Inferred company: #{company_name}"

      # Find or create the company contact
      company = Contact.where(entity_type: ['company', 'trust'])
                      .where('company_name_or_trust ILIKE ? OR full_name ILIKE ?',
                             "%#{company_name}%", "%#{company_name}%")
                      .first

      if company.nil?
        # Create the company
        company = Contact.create!(
          full_name: company_name,
          company_name_or_trust: company_name,
          entity_type: 'company',
          email: person.email, # Use the accounts@ email for the company
          is_team_contact: false
        )
        puts "   ✓ Created company: #{company.full_name} (ID: #{company.id})"
      else
        puts "   ✓ Found existing company: #{company.full_name} (ID: #{company.id})"
      end

      # Create employment record (many-to-many relationship)
      employment = ContactEmployment.find_or_initialize_by(
        employee_id: person.id,
        employer_id: company.id
      )

      if employment.new_record?
        employment.assign_attributes(
          role: 'Accounts', # Inferred from accounts@ email
          work_email: person.email,
          is_active: true,
          is_primary: person.employers.empty? # Set as primary if it's their first employer
        )
        employment.save!
        puts "   ✓ Created employment: #{person.full_name} → #{company.full_name} (Accounts)"
      else
        puts "   ✓ Employment already exists: #{person.full_name} → #{company.full_name}"
      end

      puts ""
    end

    puts "✅ Employee extraction complete!"
    puts ""
    puts "📊 SUMMARY:"
    total_employments = ContactEmployment.count
    total_employees = ContactEmployment.select(:employee_id).distinct.count
    total_employers = ContactEmployment.select(:employer_id).distinct.count
    puts "   #{total_employments} employment relationships"
    puts "   #{total_employees} employees"
    puts "   #{total_employers} employers"
  end
end
