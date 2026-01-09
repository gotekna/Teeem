namespace :contacts do
  desc "Extract websites from email domains for companies"
  task extract_websites_from_emails: :environment do
    puts "=" * 60
    puts "EXTRACT WEBSITES FROM EMAIL DOMAINS"
    puts "=" * 60
    puts

    # Find companies without websites but with emails
    companies = Contact.where(entity_type: [ "company", "trust" ])
                      .where("website IS NULL OR website = ''")
                      .where("email IS NOT NULL AND email != ''")
                      .order(:id)

    puts "Found #{companies.count} companies with emails but no websites"
    puts

    stats = {
      updated: 0,
      skipped: 0,
      errors: 0
    }

    companies.find_each do |company|
      begin
        email = company.email.to_s.strip
        name = company.full_name || company.company_name_or_trust

        # Extract domain from email
        if email.match?(/@/)
          domain = email.split("@").last.downcase

          # Skip personal email domains
          personal_domains = [ "gmail.com", "hotmail.com", "outlook.com", "yahoo.com",
                            "icloud.com", "live.com", "bigpond.com", "optusnet.com.au" ]

          if personal_domains.include?(domain)
            stats[:skipped] += 1
            puts "⊘ SKIPPED [#{company.id}] #{name}"
            puts "  → #{email} (personal email domain)"
            next
          end

          # Set website to https://domain
          website = "https://#{domain}"

          company.website = website
          company.save(validate: false)

          stats[:updated] += 1
          puts "✓ UPDATED [#{company.id}] #{name}"
          puts "  → #{email} → #{website}"
        else
          stats[:skipped] += 1
          puts "⊘ SKIPPED [#{company.id}] #{name} - Invalid email format"
        end

      rescue => e
        stats[:errors] += 1
        puts "✗ ERROR [#{company.id}] #{e.message}"
      end
    end

    puts
    puts "=" * 60
    puts "EXTRACTION COMPLETE"
    puts "=" * 60
    puts "Websites updated:  #{stats[:updated]}"
    puts "Skipped:           #{stats[:skipped]}"
    puts "Errors:            #{stats[:errors]}"
    puts
  end

  desc "Preview companies that can have websites extracted from emails"
  task preview_email_websites: :environment do
    companies = Contact.where(entity_type: [ "company", "trust" ])
                      .where("website IS NULL OR website = ''")
                      .where("email IS NOT NULL AND email != ''")
                      .limit(30)

    puts "PREVIEW: Companies with emails but no websites (first 30):"
    puts

    personal_domains = [ "gmail.com", "hotmail.com", "outlook.com", "yahoo.com",
                       "icloud.com", "live.com", "bigpond.com", "optusnet.com.au" ]

    companies.each do |c|
      name = c.full_name || c.company_name_or_trust || "NO NAME"
      email = c.email.to_s

      if email.match?(/@/)
        domain = email.split("@").last.downcase
        is_personal = personal_domains.include?(domain)
        status = is_personal ? "[SKIP - personal]" : "[WILL UPDATE]"

        puts "ID #{c.id}: #{name}"
        puts "  Email: #{email} → https://#{domain} #{status}"
      end
    end

    puts
    total = Contact.where(entity_type: [ "company", "trust" ])
                  .where("website IS NULL OR website = ?", "")
                  .where("email IS NOT NULL AND email != ?", "")
                  .count
    puts "Total companies with emails but no websites: #{total}"
  end
end
