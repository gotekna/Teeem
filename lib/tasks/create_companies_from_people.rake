namespace :contacts do
  desc "Create company contacts from people with company email domains"
  task create_companies_from_emails: :environment do
    puts "=" * 60
    puts "CREATE COMPANIES FROM PEOPLE WITH COMPANY EMAILS"
    puts "=" * 60
    puts

    # Personal email domains to skip
    personal_domains = [
      "gmail.com", "hotmail.com", "outlook.com", "yahoo.com",
      "icloud.com", "live.com", "bigpond.com", "optusnet.com.au",
      "me.com", "msn.com", "aol.com", "protonmail.com"
    ]

    # Find people with non-personal email domains
    people = Contact.where(entity_type: "person")
                   .where("email IS NOT NULL AND email != ''")
                   .order(:id)

    puts "Scanning #{people.count} people for company email domains..."
    puts

    stats = {
      companies_created: 0,
      already_exists: 0,
      skipped_personal: 0,
      skipped_invalid: 0,
      errors: 0
    }

    # Track created domains to avoid duplicates in this run
    created_domains = Set.new

    people.find_each do |person|
      begin
        email = person.email.to_s.strip
        next unless email.match?(/@/)

        domain = email.split("@").last.downcase

        # Skip personal domains
        if personal_domains.include?(domain)
          stats[:skipped_personal] += 1
          next
        end

        # Skip if we already created this company in this run
        if created_domains.include?(domain)
          next
        end

        # Check if company with this domain already exists
        existing = Contact.where(entity_type: [ "company", "trust" ])
                         .where("LOWER(website) LIKE ?", "%#{domain}%")
                         .first

        if existing
          stats[:already_exists] += 1
          next
        end

        # Create company name from domain
        # e.g., "blutek.com.au" → "Blutek"
        # e.g., "theonegroup.au" → "The One Group"
        company_name = domain.split(".").first

        # Capitalize and clean up
        company_name = company_name.split(/[-_]/).map(&:capitalize).join(" ")

        # Create the company
        company = Contact.new(
          entity_type: "company",
          full_name: company_name,
          company_name_or_trust: company_name,
          website: "https://#{domain}",
          email: "info@#{domain}",  # Generic company email
          roles: person.roles  # Inherit roles from person (e.g., supplier, customer)
        )

        if company.save(validate: false)
          stats[:companies_created] += 1
          created_domains.add(domain)

          puts "✓ CREATED [#{company.id}] #{company_name}"
          puts "  → from: #{person.full_name} (#{email})"
          puts "  → website: https://#{domain}"
        else
          stats[:errors] += 1
          puts "✗ ERROR creating company from #{domain}: #{company.errors.full_messages.join(', ')}"
        end

      rescue => e
        stats[:errors] += 1
        puts "✗ ERROR [#{person.id}] #{e.message}"
      end
    end

    puts
    puts "=" * 60
    puts "COMPANY CREATION COMPLETE"
    puts "=" * 60
    puts "Companies created:     #{stats[:companies_created]}"
    puts "Already exists:        #{stats[:already_exists]}"
    puts "Skipped (personal):    #{stats[:skipped_personal]}"
    puts "Errors:                #{stats[:errors]}"
    puts
  end

  desc "Preview companies that would be created from people's emails"
  task preview_companies_from_emails: :environment do
    personal_domains = [
      "gmail.com", "hotmail.com", "outlook.com", "yahoo.com",
      "icloud.com", "live.com", "bigpond.com", "optusnet.com.au",
      "me.com", "msn.com", "aol.com", "protonmail.com"
    ]

    people = Contact.where(entity_type: "person")
                   .where("email IS NOT NULL AND email != ''")
                   .limit(100)

    puts "PREVIEW: Companies that would be created from people's emails:"
    puts

    domains_to_create = {}

    people.each do |p|
      email = p.email.to_s.strip
      next unless email.match?(/@/)

      domain = email.split("@").last.downcase

      # Skip personal domains
      next if personal_domains.include?(domain)

      # Check if company exists
      existing = Contact.where(entity_type: [ "company", "trust" ])
                       .where("LOWER(website) LIKE ?", "%#{domain}%")
                       .first

      next if existing

      # Track this domain
      if domains_to_create[domain]
        domains_to_create[domain][:people] << p.full_name
      else
        company_name = domain.split(".").first.split(/[-_]/).map(&:capitalize).join(" ")
        domains_to_create[domain] = {
          company_name: company_name,
          website: "https://#{domain}",
          people: [ p.full_name ]
        }
      end
    end

    domains_to_create.first(30).each do |domain, info|
      puts "WOULD CREATE: #{info[:company_name]}"
      puts "  Website: #{info[:website]}"
      puts "  From people: #{info[:people].join(', ')}"
      puts
    end

    puts "Total unique company domains found: #{domains_to_create.size}"
  end

  desc "Link people to their companies based on email domain"
  task link_people_to_companies: :environment do
    puts "=" * 60
    puts "LINK PEOPLE TO COMPANIES VIA EMAIL DOMAIN"
    puts "=" * 60
    puts

    personal_domains = [
      "gmail.com", "hotmail.com", "outlook.com", "yahoo.com",
      "icloud.com", "live.com", "bigpond.com", "optusnet.com.au",
      "me.com", "msn.com", "aol.com", "protonmail.com"
    ]

    people = Contact.where(entity_type: "person")
                   .where("email IS NOT NULL AND email != ''")
                   .where("linked_company_id IS NULL")
                   .order(:id)

    puts "Found #{people.count} people without linked companies"
    puts

    stats = {
      linked: 0,
      no_company_found: 0,
      skipped_personal: 0
    }

    people.find_each do |person|
      begin
        email = person.email.to_s.strip
        next unless email.match?(/@/)

        domain = email.split("@").last.downcase

        # Skip personal domains
        if personal_domains.include?(domain)
          stats[:skipped_personal] += 1
          next
        end

        # Find company with this domain
        company = Contact.where(entity_type: [ "company", "trust" ])
                        .where("LOWER(website) LIKE ?", "%#{domain}%")
                        .first

        if company
          person.linked_company_id = company.id
          person.save(validate: false)

          stats[:linked] += 1
          puts "✓ LINKED [#{person.id}] #{person.full_name} → [#{company.id}] #{company.full_name}"
        else
          stats[:no_company_found] += 1
        end

      rescue => e
        puts "✗ ERROR [#{person.id}] #{e.message}"
      end
    end

    puts
    puts "=" * 60
    puts "LINKING COMPLETE"
    puts "=" * 60
    puts "People linked:         #{stats[:linked]}"
    puts "No company found:      #{stats[:no_company_found]}"
    puts "Skipped (personal):    #{stats[:skipped_personal]}"
    puts
  end
end
