namespace :contacts do
  desc "Extract employee data from accounts@ contacts and link to companies"
  task extract_employees_from_accounts: :environment do
    puts "🔍 Extracting employees from accounts@ contacts..."
    puts ""

    # Find person contacts with accounts@ emails (excluding generic "Accounts Team")
    person_accounts = Contact.where("email ILIKE ?", "accounts@%")
                            .where(entity_type: "person")
                            .where.not(display_name: [ "Accounts Team", "accounts team", "", nil ])
                            .where(deleted: [ false, nil ])

    puts "Found #{person_accounts.count} person contacts with accounts@ emails"
    puts ""

    person_accounts.each do |person|
      # Extract company name from email domain
      domain = person.email.split("@").last
      company_domain = domain.split(".").first
      company_name = company_domain.titleize

      puts "👤 Processing: #{person.display_name} (ID: #{person.id})"
      puts "   Email: #{person.email}"
      puts "   Inferred company: #{company_name}"

      # Find or create the company contact
      company = Contact.where(entity_type: [ "company", "trust" ])
                      .where("company_name_or_trust ILIKE ? OR display_name ILIKE ?",
                             "%#{company_name}%", "%#{company_name}%")
                      .first

      if company.nil?
        # Create the company
        company = Contact.create!(
          display_name: company_name,
          company_name_or_trust: company_name,
          entity_type: "company",
          email: person.email, # Use the accounts@ email for the company
          is_team_contact: false
        )
        puts "   ✓ Created company: #{company.display_name} (ID: #{company.id})"
      else
        puts "   ✓ Found existing company: #{company.display_name} (ID: #{company.id})"
      end

      # Create employment relationship (using ContactRelationship SSoT)
      relationship = ContactRelationship.find_or_initialize_by(
        source_contact_id: person.id,
        related_contact_id: company.id,
        relationship_type: "employee_of"
      )

      if relationship.new_record?
        relationship.assign_attributes(
          role_in_relationship: "Accounts", # Inferred from accounts@ email
          is_active: true
        )
        relationship.save!
        puts "   ✓ Created employment: #{person.display_name} → #{company.display_name} (Accounts)"
      else
        puts "   ✓ Employment already exists: #{person.display_name} → #{company.display_name}"
      end

      puts ""
    end

    puts "✅ Employee extraction complete!"
    puts ""
    puts "📊 SUMMARY:"
    total_employments = ContactRelationship.where(relationship_type: "employee_of").count
    total_employees = ContactRelationship.where(relationship_type: "employee_of").select(:source_contact_id).distinct.count
    total_employers = ContactRelationship.where(relationship_type: "employee_of").select(:related_contact_id).distinct.count
    puts "   #{total_employments} employment relationships"
    puts "   #{total_employees} employees"
    puts "   #{total_employers} employers"
  end
end
