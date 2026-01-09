require "csv"

namespace :contacts do
  desc "Analyze email domains AND names and match them to company contacts, export to CSV"
  task analyze_company_emails: :environment do
    puts "=" * 80
    puts "ANALYZING COMPANY EMAIL & NAME MATCHES"
    puts "=" * 80
    puts

    # Get all contacts
    all_contacts = Contact.where.not(entity_type: "company")
    # Get all companies
    companies = Contact.where(entity_type: "company").pluck(:id, :full_name)

    company_matches = {}

    puts "Analyzing #{all_contacts.count} contacts against #{companies.count} companies..."
    puts

    all_contacts.find_each do |contact|
      # Check each company
      companies.each do |company_id, company_name|
        next unless company_name

        # Clean company name for matching
        clean_company_name = company_name.downcase
          .gsub(/\s*(pty|ltd|limited|group|services|solutions|enterprises)\s*/i, "")
          .gsub(/[^a-z0-9\s]/, "")
          .strip

        next if clean_company_name.empty?

        matched = false
        match_type = nil

        # 1. EMAIL DOMAIN MATCHING
        if contact.email.present?
          email_parts = contact.email.split("@")
          if email_parts.length == 2
            domain = email_parts[1].downcase
            domain_clean = domain.gsub(/[^a-z0-9]/, "")
            company_clean = clean_company_name.gsub(/\s+/, "")

            if domain_clean.include?(company_clean) || company_clean.include?(domain_clean.split(".").first)
              matched = true
              match_type = "email_domain"
            end
          end
        end

        # 2. NAME MATCHING (if not already matched by email)
        if !matched && contact.full_name.present?
          contact_name = contact.full_name.downcase

          # Check if company name appears in contact name
          # e.g., "John Smith - Bunnings" or "Bunnings Rep" or "Trade at Bunnings"
          if contact_name.include?(clean_company_name) ||
             clean_company_name.split.any? { |word| contact_name.include?(word) && word.length > 4 }
            matched = true
            match_type = "name_match"
          end
        end

        if matched
          company_matches[company_id] ||= {
            company_name: company_name,
            contacts: []
          }
          company_matches[company_id][:contacts] << {
            id: contact.id,
            name: contact.full_name,
            email: contact.email,
            mobile: contact.mobile_phone,
            entity_type: contact.entity_type,
            match_type: match_type
          }
        end
      end
    end

    puts "Found #{company_matches.count} companies with matches"
    puts

    # Generate CSV
    csv_path = Rails.root.join("tmp", "company_matches_#{Time.current.strftime('%Y%m%d_%H%M%S')}.csv")

    CSV.open(csv_path, "w") do |csv|
      # Header
      csv << [ "Company ID", "Company Name", "Contact Count", "Contact ID", "Contact Name", "Contact Type", "Email", "Mobile", "Match Type" ]

      # Data rows
      company_matches.sort_by { |_, data| -data[:contacts].count }.each do |company_id, data|
        data[:contacts].each_with_index do |contact, index|
          csv << [
            index == 0 ? company_id : "",
            index == 0 ? data[:company_name] : "",
            index == 0 ? data[:contacts].count : "",
            contact[:id],
            contact[:name],
            contact[:entity_type],
            contact[:email],
            contact[:mobile],
            contact[:match_type]
          ]
        end
        # Blank row between companies
        csv << []
      end
    end

    puts "=" * 80
    puts "EXPORT COMPLETE"
    puts "=" * 80
    puts "CSV saved to: #{csv_path}"
    puts "Total companies with matches: #{company_matches.count}"
    puts

    # Count match types
    email_matches = company_matches.values.sum { |v| v[:contacts].count { |c| c[:match_type] == "email_domain" } }
    name_matches = company_matches.values.sum { |v| v[:contacts].count { |c| c[:match_type] == "name_match" } }

    puts "Match breakdown:"
    puts "  Email domain matches: #{email_matches}"
    puts "  Name matches: #{name_matches}"
    puts

    puts "Top 20 companies by contact count:"
    company_matches.sort_by { |_, data| -data[:contacts].count }.first(20).each do |company_id, data|
      email_count = data[:contacts].count { |c| c[:match_type] == "email_domain" }
      name_count = data[:contacts].count { |c| c[:match_type] == "name_match" }
      puts "  [#{company_id}] #{data[:company_name]} - #{data[:contacts].count} contacts (#{email_count} email, #{name_count} name)"
    end
  end
end
