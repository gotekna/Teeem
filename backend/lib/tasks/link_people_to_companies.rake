namespace :contacts do
  desc "Link people to companies based on email domain matching"
  task link_people_to_companies: :environment do
    puts "=" * 60
    puts "LINK PEOPLE TO COMPANIES VIA EMAIL DOMAIN"
    puts "=" * 60
    puts

    # Personal email domains that don't suggest a company
    personal_domains = [
      "gmail.com", "hotmail.com", "outlook.com", "yahoo.com",
      "icloud.com", "live.com", "bigpond.com", "optusnet.com.au"
    ]

    # Find people without primary_company_id who have email addresses
    people = Contact.where(entity_type: "person")
                   .where(primary_company_id: nil)
                   .where.not(email: [ nil, "" ])
                   .order(:id)

    puts "Found #{people.count} people without companies who have email addresses"
    puts

    stats = {
      linked: 0,
      skipped_personal: 0,
      skipped_no_match: 0,
      errors: 0
    }

    people.find_each do |person|
      begin
        email = person.email.to_s.strip

        unless email.match?(/@/)
          stats[:skipped_no_match] += 1
          next
        end

        domain = email.split("@").last.downcase

        if personal_domains.include?(domain)
          stats[:skipped_personal] += 1
          next
        end

        # Find company with matching website domain
        company = Contact.where(entity_type: [ "company", "trust" ])
                        .where("LOWER(website) LIKE ?", "%#{domain}%")
                        .first

        if company
          person.update_column(:primary_company_id, company.id)
          puts "✓ LINKED [#{person.id}] #{person.full_name} → [#{company.id}] #{company.full_name} (via #{domain})"
          stats[:linked] += 1
        else
          stats[:skipped_no_match] += 1
        end

      rescue => e
        stats[:errors] += 1
        puts "✗ ERROR [#{person.id}] #{person.full_name}: #{e.message}"
      end
    end

    puts
    puts "=" * 60
    puts "LINKING COMPLETE"
    puts "=" * 60
    puts "People linked:        #{stats[:linked]}"
    puts "Personal emails:      #{stats[:skipped_personal]}"
    puts "No company match:     #{stats[:skipped_no_match]}"
    puts "Errors:               #{stats[:errors]}"
    puts
  end

  desc "Preview people who could be linked to companies"
  task preview_linkable_people: :environment do
    personal_domains = [
      "gmail.com", "hotmail.com", "outlook.com", "yahoo.com",
      "icloud.com", "live.com", "bigpond.com", "optusnet.com.au"
    ]

    people = Contact.where(entity_type: "person")
                   .where(primary_company_id: nil)
                   .where.not(email: [ nil, "" ])
                   .order(:id)

    puts "PREVIEW: People who could be linked to companies (#{people.count}):"
    puts

    linkable_count = 0

    people.limit(50).each do |person|
      email = person.email.to_s.strip
      next unless email.match?(/@/)

      domain = email.split("@").last.downcase
      next if personal_domains.include?(domain)

      company = Contact.where(entity_type: [ "company", "trust" ])
                      .where("LOWER(website) LIKE ?", "%#{domain}%")
                      .first

      if company
        puts "ID #{person.id}: #{person.full_name}"
        puts "  Email: #{person.email}"
        puts "  → Could link to: [#{company.id}] #{company.full_name}"
        puts
        linkable_count += 1
      end
    end

    puts "... (showing first 50)" if people.count > 50
    puts
    puts "Total linkable: #{linkable_count}"
  end
end
