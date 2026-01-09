namespace :employees do
  desc "Link employees to companies based on email domain matching (one-time setup)"
  task link_by_email_domain: :environment do
    puts "=" * 80
    puts "LINKING EMPLOYEES TO COMPANIES BY EMAIL DOMAIN"
    puts "=" * 80
    puts ""
    puts "⚠️  IMPORTANT: This task is ADDITIVE ONLY"
    puts "   - Only CREATES relationships that don't exist"
    puts "   - NEVER deletes existing relationships"
    puts "   - Safe to run multiple times"
    puts "   - If someone's email changes, their existing relationships stay intact"
    puts ""

    # Get all companies with email_domains configured
    companies_with_domains = Contact.where(entity_type: [ "company", "trust" ])
      .where("email_domains != '[]'::jsonb")
      .where("jsonb_array_length(email_domains) > 0")

    if companies_with_domains.empty?
      puts "❌ No companies have email_domains configured."
      puts ""
      puts "To configure, update a company contact:"
      puts "  company = Contact.find_by(display_name: 'Tekna Pty Ltd')"
      puts "  company.update(email_domains: ['tekna.com.au'])"
      puts ""
      exit
    end

    puts "Found #{companies_with_domains.count} companies with email domains:"
    companies_with_domains.each do |company|
      domains = company.email_domains.join(", ")
      puts "  - #{company.display_name}: #{domains}"
    end
    puts ""

    # Build domain → company mapping
    domain_to_companies = {}
    companies_with_domains.each do |company|
      company.email_domains.each do |domain|
        domain_to_companies[domain.downcase] ||= []
        domain_to_companies[domain.downcase] << company
      end
    end

    # Find all persons with emails
    persons_with_emails = Contact.where(entity_type: "person")
      .where.not(email: [ nil, "" ])

    puts "Scanning #{persons_with_emails.count} persons with emails..."
    puts ""

    email_created = 0
    email_skipped = 0
    primary_company_created = 0
    primary_company_skipped = 0

    # STEP 1: Match by email domain
    persons_with_emails.find_each do |person|
      email = person.email.to_s.downcase.strip
      next if email.blank?

      # Extract domain from email
      domain = email.split("@").last
      next unless domain

      # Find matching companies
      matching_companies = domain_to_companies[domain]
      next unless matching_companies

      matching_companies.each do |company|
        # Check if relationship already exists
        existing = ContactRelationship.find_by(
          source_contact_id: person.id,
          related_contact_id: company.id,
          relationship_type: "employee_of"
        )

        if existing
          email_skipped += 1
          next
        end

        # Create employee_of relationship
        ContactRelationship.create!(
          source_contact_id: person.id,
          related_contact_id: company.id,
          relationship_type: "employee_of",
          is_active: true,
          notes: "Auto-created from email domain match (#{domain})"
        )

        email_created += 1
        puts "✅ EMAIL: #{person.display_name} (#{email}) → #{company.display_name}"
      end
    end

    puts ""
    puts "STEP 2: Match by company name extracted from email domain..."
    puts ""

    # Extract company name from email domain and fuzzy match to company names
    company_name_created = 0
    company_name_skipped = 0

    persons_with_emails.find_each do |person|
      email = person.email.to_s.downcase.strip
      next if email.blank?

      # Extract domain and company name from email
      domain = email.split("@").last
      next unless domain

      # Extract company name from domain (e.g., "bunnings.com.au" → "bunnings")
      company_name_from_domain = domain.split(".").first
      next if company_name_from_domain.blank? || company_name_from_domain.length < 3

      # Find companies with similar names (case-insensitive partial match)
      matching_companies = Contact.where(entity_type: [ "company", "trust", "sole_trader" ])
        .where("display_name ILIKE ?", "%#{company_name_from_domain}%")

      matching_companies.each do |company|
        # Skip if this domain is already in the company's email_domains (already handled in STEP 1)
        next if company.email_domains.include?(domain)

        # Check if relationship already exists
        existing = ContactRelationship.find_by(
          source_contact_id: person.id,
          related_contact_id: company.id,
          relationship_type: "employee_of"
        )

        if existing
          company_name_skipped += 1
          next
        end

        # Create employee_of relationship
        ContactRelationship.create!(
          source_contact_id: person.id,
          related_contact_id: company.id,
          relationship_type: "employee_of",
          is_active: true,
          notes: "Auto-created from email company name match (#{company_name_from_domain} in #{domain})"
        )

        company_name_created += 1
        puts "✅ NAME: #{person.display_name} (#{email}) → #{company.display_name}"
      end
    end

    puts ""
    puts "STEP 3: Match by primary_company_id field (legacy data recovery)..."
    puts ""

    # Find all persons with primary_company_id set
    persons_with_primary_company = Contact.where(entity_type: "person")
      .where.not(primary_company_id: nil)

    puts "Found #{persons_with_primary_company.count} persons with primary_company_id set"
    puts ""

    persons_with_primary_company.find_each do |person|
      company = Contact.find_by(id: person.primary_company_id, entity_type: [ "company", "trust", "sole_trader" ])
      next unless company

      # Check if relationship already exists
      existing = ContactRelationship.find_by(
        source_contact_id: person.id,
        related_contact_id: company.id,
        relationship_type: "employee_of"
      )

      if existing
        primary_company_skipped += 1
        next
      end

      # Create employee_of relationship from primary_company_id
      ContactRelationship.create!(
        source_contact_id: person.id,
        related_contact_id: company.id,
        relationship_type: "employee_of",
        is_active: true,
        notes: "Auto-created from primary_company_id field"
      )

      primary_company_created += 1
      puts "✅ PRIMARY: #{person.display_name} → #{company.display_name}"
    end

    puts ""
    puts "=" * 80
    puts "RESULTS"
    puts "=" * 80
    puts "Email domain matches (exact):"
    puts "  Created:    #{email_created}"
    puts "  Skipped:    #{email_skipped} (already existed)"
    puts ""
    puts "Company name matches (from email):"
    puts "  Created:    #{company_name_created}"
    puts "  Skipped:    #{company_name_skipped} (already existed)"
    puts ""
    puts "Primary company matches (legacy field):"
    puts "  Created:    #{primary_company_created}"
    puts "  Skipped:    #{primary_company_skipped} (already existed)"
    puts ""
    puts "TOTAL CREATED: #{email_created + company_name_created + primary_company_created}"
    puts ""
    puts "✅ Done! Employee relationships have been created."
    puts "   The primary_company_id field will auto-sync from these relationships."
    puts "=" * 80
  end

  desc "Show statistics about email domain matches (dry run)"
  task preview_email_domain_matches: :environment do
    puts "=" * 80
    puts "EMAIL DOMAIN MATCH PREVIEW (DRY RUN)"
    puts "=" * 80
    puts ""

    # Get all companies with email_domains configured
    companies_with_domains = Contact.where(entity_type: [ "company", "trust" ])
      .where("email_domains != '[]'::jsonb")
      .where("jsonb_array_length(email_domains) > 0")

    if companies_with_domains.empty?
      puts "❌ No companies have email_domains configured."
      puts ""
      puts "To configure, update a company contact:"
      puts "  company = Contact.find_by(display_name: 'Tekna Pty Ltd')"
      puts "  company.update(email_domains: ['tekna.com.au'])"
      puts ""
      exit
    end

    puts "Companies with email domains configured:"
    companies_with_domains.each do |company|
      domains = company.email_domains.join(", ")
      puts "  - #{company.display_name}: #{domains}"
    end
    puts ""

    # Build domain → company mapping
    domain_to_companies = {}
    companies_with_domains.each do |company|
      company.email_domains.each do |domain|
        domain_to_companies[domain.downcase] ||= []
        domain_to_companies[domain.downcase] << company
      end
    end

    # Find all persons with emails
    persons_with_emails = Contact.where(entity_type: "person")
      .where.not(email: [ nil, "" ])

    # Count matches
    matches_by_company = Hash.new(0)
    total_matches = 0

    persons_with_emails.find_each do |person|
      email = person.email.to_s.downcase.strip
      next if email.blank?

      domain = email.split("@").last
      next unless domain

      matching_companies = domain_to_companies[domain]
      next unless matching_companies

      matching_companies.each do |company|
        # Check if relationship already exists
        existing = ContactRelationship.find_by(
          source_contact_id: person.id,
          related_contact_id: company.id,
          relationship_type: "employee_of"
        )

        unless existing
          matches_by_company[company.display_name] += 1
          total_matches += 1
        end
      end
    end

    puts "Potential new employee relationships:"
    if matches_by_company.empty?
      puts "  None (all relationships already exist)"
    else
      matches_by_company.sort_by { |_name, count| -count }.each do |company_name, count|
        puts "  - #{company_name}: #{count} employees"
      end
    end
    puts ""
    puts "Total: #{total_matches} new relationships would be created"
    puts ""
    puts "To create these relationships, run:"
    puts "  bin/rails employees:link_by_email_domain"
    puts "=" * 80
  end
end
