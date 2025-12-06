require 'csv'

namespace :contacts do
  desc "Analyze email domains and match them to company contacts, export to CSV"
  task analyze_company_emails: :environment do
    puts "=" * 80
    puts "ANALYZING COMPANY EMAIL DOMAIN MATCHES"
    puts "=" * 80
    puts

    # Get all contacts with emails
    all_contacts = Contact.where.not(email: [nil, ""])
    # Get all companies
    companies = Contact.where(entity_type: "company").pluck(:id, :full_name)

    company_matches = {}

    puts "Analyzing #{all_contacts.count} contacts against #{companies.count} companies..."
    puts

    all_contacts.find_each do |contact|
      next unless contact.email

      # Extract domain from email
      email_parts = contact.email.split("@")
      next if email_parts.length != 2

      local_part = email_parts[0].downcase
      domain = email_parts[1].downcase

      # Check each company
      companies.each do |company_id, company_name|
        next unless company_name

        # Clean company name
        clean_name = company_name.downcase
          .gsub(/\s*(pty|ltd|limited|group|services|solutions|enterprises)\s*/i, "")
          .gsub(/[^a-z0-9]/, "")
          .strip

        next if clean_name.empty?

        # Check if company name appears in domain
        domain_clean = domain.gsub(/[^a-z0-9]/, "")

        if domain_clean.include?(clean_name) || clean_name.include?(domain_clean.split(".").first)
          company_matches[company_id] ||= {
            company_name: company_name,
            contacts: []
          }
          company_matches[company_id][:contacts] << {
            id: contact.id,
            name: contact.full_name,
            email: contact.email,
            mobile: contact.mobile_phone,
            entity_type: contact.entity_type
          }
        end
      end
    end

    puts "Found #{company_matches.count} companies with email matches"
    puts

    # Generate CSV
    csv_path = Rails.root.join("tmp", "company_email_matches_#{Time.current.strftime('%Y%m%d_%H%M%S')}.csv")

    CSV.open(csv_path, "w") do |csv|
      # Header
      csv << ["Company ID", "Company Name", "Contact Count", "Contact ID", "Contact Name", "Contact Type", "Email", "Mobile"]

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
            contact[:mobile]
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
    puts "Top 10 companies by contact count:"
    company_matches.sort_by { |_, data| -data[:contacts].count }.first(10).each do |company_id, data|
      puts "  [#{company_id}] #{data[:company_name]} - #{data[:contacts].count} contacts"
    end
  end
end
