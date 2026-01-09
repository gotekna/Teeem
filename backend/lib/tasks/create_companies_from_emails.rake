namespace :contacts do
  desc "Create companies from people's email domains and link them"
  task create_companies_from_emails: :environment do
    puts "=" * 60
    puts "CREATE COMPANIES FROM EMAIL DOMAINS"
    puts "=" * 60
    puts

    # Personal/test domains to skip
    skip_domains = [
      "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com",
      "live.com", "bigpond.com", "optusnet.com.au",
      "yahoo.com.au", "live.com.au",  # Personal domains with country codes
      "test.com", "y7mail.com",  # Test/demo domains
      "hsmithdemo.co", "yarratransport.co", "storypro.me"  # Demo domains
    ]

    stats = {
      companies_created: 0,
      people_linked: 0,
      skipped: 0,
      errors: 0
    }

    # Find people without companies who have business emails
    people = Contact.where(entity_type: "person")
                   .where(primary_company_id: nil)
                   .where.not(email: [ nil, "" ])
                   .order(:id)

    # Group by domain
    domains = Hash.new { |h, k| h[k] = [] }

    people.each do |person|
      email = person.email.to_s.strip
      next unless email.match?(/@/)

      domain = email.split("@").last.downcase
      next if skip_domains.include?(domain)

      # Check if company already exists with this domain
      company = Contact.where(entity_type: [ "company", "trust" ])
                      .where("LOWER(website) LIKE ?", "%#{domain}%")
                      .first

      if company.nil?
        domains[domain] << person
      end
    end

    puts "Found #{domains.count} unique business domains needing companies"
    puts

    domains.each do |domain, domain_people|
      begin
        # Create company name from domain
        company_name = domain.split(".").first.split("-").map(&:capitalize).join(" ")

        # Create company contact
        company_contact = Contact.new(
          entity_type: "company",
          full_name: company_name,
          company_name_or_trust: company_name,
          website: "https://#{domain}",
          is_active: true,
          xero_synced: false
        )

        if company_contact.save(validate: false)
          # Create Company record
          company = Company.create!(
            name: company_name,
            contact_id: company_contact.id,
            status: "active"
          )

          puts "✓ Created company [#{company_contact.id}] #{company_name} (#{domain})"
          stats[:companies_created] += 1

          # Link all people with this domain
          domain_people.each do |person|
            person.primary_company_id = company_contact.id
            person.save(validate: false)
            puts "  → Linked [#{person.id}] #{person.full_name}"
            stats[:people_linked] += 1
          end
        else
          stats[:errors] += 1
          puts "✗ ERROR creating company for #{domain}: #{company_contact.errors.full_messages.join(', ')}"
        end

        puts

      rescue => e
        stats[:errors] += 1
        puts "✗ ERROR processing #{domain}: #{e.message}"
        puts
      end
    end

    puts "=" * 60
    puts "CREATION COMPLETE"
    puts "=" * 60
    puts "Companies created:    #{stats[:companies_created]}"
    puts "People linked:        #{stats[:people_linked]}"
    puts "Skipped:              #{stats[:skipped]}"
    puts "Errors:               #{stats[:errors]}"
    puts
  end

  desc "Preview companies that would be created from email domains"
  task preview_companies_from_emails: :environment do
    skip_domains = [
      "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com",
      "live.com", "bigpond.com", "optusnet.com.au",
      "yahoo.com.au", "live.com.au",
      "test.com", "y7mail.com",
      "hsmithdemo.co", "yarratransport.co", "storypro.me"
    ]

    people = Contact.where(entity_type: "person")
                   .where(primary_company_id: nil)
                   .where.not(email: [ nil, "" ])

    domains = Hash.new { |h, k| h[k] = [] }

    people.each do |person|
      email = person.email.to_s.strip
      next unless email.match?(/@/)

      domain = email.split("@").last.downcase
      next if skip_domains.include?(domain)

      company = Contact.where(entity_type: [ "company", "trust" ])
                      .where("LOWER(website) LIKE ?", "%#{domain}%")
                      .first

      if company.nil?
        domains[domain] << person
      end
    end

    puts "PREVIEW: Would create #{domains.count} companies:"
    puts

    domains.each do |domain, domain_people|
      company_name = domain.split(".").first.split("-").map(&:capitalize).join(" ")
      puts "#{company_name} (#{domain}) - #{domain_people.count} people:"
      domain_people.each do |p|
        puts "  [#{p.id}] #{p.full_name} - #{p.email}"
      end
      puts
    end
  end
end
