namespace :easybuild do
  desc "Export all contacts CSV to stdout (for download)"
  task export_contacts_csv: :environment do
    require "csv"
    contacts = Contact.order(:full_name)

    csv_string = CSV.generate do |csv|
      csv << [ "TEEEM ID", "Full Name", "Email", "Mobile Phone", "Has Xero ID", "Source", "Entity Type", "Contact Types", "Company Name" ]
      contacts.each do |c|
        source = c.xero_id.present? ? "Xero" : (c.sync_with_xero == false ? "EasyBuild" : "TEEEM")
        csv << [
          c.id,
          c.full_name,
          c.email,
          c.mobile_phone,
          c.xero_id.present? ? "Yes" : "No",
          source,
          c.entity_type,
          c.contact_types&.join("; "),
          c.company_name_or_trust
        ]
      end
    end
    puts csv_string
  end

  desc "Export all contacts with source info"
  task export_contacts: :environment do
    require "csv"

    contacts = Contact.order(:full_name)
    csv_output = Rails.root.join("tmp", "all_contacts_export.csv")

    CSV.open(csv_output, "w") do |csv|
      csv << [ "TEEEM ID", "Full Name", "Email", "Mobile Phone", "Has Xero ID", "Source", "Entity Type", "Contact Types", "Company Name" ]
      contacts.each do |c|
        source = c.xero_id.present? ? "Xero" : (c.sync_with_xero == false ? "EasyBuild" : "TEEEM")
        csv << [
          c.id,
          c.full_name,
          c.email,
          c.mobile_phone,
          c.xero_id.present? ? "Yes" : "No",
          source,
          c.entity_type,
          c.contact_types&.join(", "),
          c.company_name_or_trust
        ]
      end
    end

    puts "Total contacts: #{contacts.count}"
    puts "\nBy Source:"
    puts "  Xero: #{contacts.count { |c| c.xero_id.present? }}"
    puts "  EasyBuild: #{contacts.count { |c| c.xero_id.blank? && c.sync_with_xero == false }}"
    puts "  Other: #{contacts.count { |c| c.xero_id.blank? && c.sync_with_xero != false }}"
    puts "\nExported to: #{csv_output}"
  end

  desc "Import EasyBuild contacts that don't exist in TEEEM"
  task import_contacts: :environment do
    require "csv"

    # Export current TEEEM contacts for matching
    puts "Exporting current TEEEM contacts..."
    teeem_contacts = Contact.all.map do |c|
      {
        "id" => c.id,
        "n" => c.full_name,
        "e" => c.email&.downcase,
        "p" => c.mobile_phone&.gsub(/\D/, "")&.last(9),
        "x" => c.xero_id
      }
    end
    puts "TEEEM contacts: #{teeem_contacts.count}"

    # Build lookup indexes
    by_xero = teeem_contacts.select { |c| c["x"].to_s.length > 0 }.index_by { |c| c["x"] }
    by_email = teeem_contacts.select { |c| c["e"].to_s.length > 0 }.index_by { |c| c["e"] }
    by_phone = teeem_contacts.select { |c| c["p"].to_s.length > 0 }.index_by { |c| c["p"] }

    puts "  With xero_id: #{by_xero.count}"
    puts "  With email: #{by_email.count}"
    puts "  With phone: #{by_phone.count}"

    # Load EasyBuild contacts from CSV
    csv_path = Rails.root.join("easybuildapp development Contacts.csv")
    easybuild = CSV.read(csv_path, headers: true)
    puts "\nEasyBuild contacts: #{easybuild.count}"

    matched_count = 0
    created_count = 0
    errors = []
    results = []

    easybuild.each do |row|
      eb_id = row["id"]
      eb_name = row["full_name"].to_s.strip
      eb_first = row["first_name"].to_s.strip
      eb_last = row["last_name"].to_s.strip
      eb_xero = row["xero_id"].to_s.strip
      eb_email = row["email"].to_s.strip
      eb_phone = row["mobile_phone"].to_s.strip
      eb_office = row["office_phone"].to_s.strip
      eb_tax = row["tax_number"].to_s.strip
      eb_website = row["website"].to_s.strip

      next if eb_name.blank?

      eb_email_norm = eb_email.downcase
      eb_phone_norm = eb_phone.gsub(/\D/, "")
      eb_phone_norm = eb_phone_norm[-9..] if eb_phone_norm.length >= 9

      teeem_match = nil
      match_type = nil

      if eb_xero.length > 0 && by_xero[eb_xero]
        teeem_match = by_xero[eb_xero]
        match_type = "xero_id"
      elsif eb_email_norm.length > 0 && by_email[eb_email_norm]
        teeem_match = by_email[eb_email_norm]
        match_type = "email"
      elsif eb_phone_norm.to_s.length > 0 && by_phone[eb_phone_norm]
        teeem_match = by_phone[eb_phone_norm]
        match_type = "phone"
      end

      if teeem_match
        matched_count += 1
        results << {
          eb_id: eb_id, eb_name: eb_name, eb_email: eb_email, eb_phone: eb_phone,
          status: "MATCHED", match_type: match_type,
          teeem_id: teeem_match["id"], teeem_name: teeem_match["n"]
        }
      else
        begin
          new_contact = Contact.create!(
            full_name: eb_name,
            first_name: eb_first.presence,
            last_name: eb_last.presence,
            email: eb_email.presence,
            mobile_phone: eb_phone.presence,
            office_phone: eb_office.presence,
            tax_number: eb_tax.presence,
            website: eb_website.presence,
            xero_id: eb_xero.presence,
            sync_with_xero: false,
            entity_type: "person"
          )
          created_count += 1
          results << {
            eb_id: eb_id, eb_name: eb_name, eb_email: eb_email, eb_phone: eb_phone,
            status: "CREATED", match_type: nil,
            teeem_id: new_contact.id, teeem_name: new_contact.full_name
          }
        rescue => e
          errors << "#{eb_name}: #{e.message}"
          results << {
            eb_id: eb_id, eb_name: eb_name, eb_email: eb_email, eb_phone: eb_phone,
            status: "ERROR", match_type: nil,
            teeem_id: nil, teeem_name: e.message[0..50]
          }
        end
      end
    end

    puts "\n" + "=" * 60
    puts "IMPORT RESULTS"
    puts "=" * 60
    puts "Matched to existing: #{matched_count}"
    puts "Created new:         #{created_count}"
    puts "Errors:              #{errors.count}"
    puts "-" * 60
    puts "Total processed:     #{results.count}"

    if errors.any?
      puts "\nFirst 10 errors:"
      errors.first(10).each { |e| puts "  - #{e}" }
    end

    # Write CSV report
    csv_output = Rails.root.join("tmp", "easybuild_import_report.csv")
    CSV.open(csv_output, "w") do |csv|
      csv << [ "EasyBuild ID", "EasyBuild Name", "EasyBuild Email", "EasyBuild Phone", "Status", "Match Type", "TEEEM ID", "TEEEM Name" ]
      results.each do |r|
        csv << [ r[:eb_id], r[:eb_name], r[:eb_email], r[:eb_phone], r[:status], r[:match_type], r[:teeem_id], r[:teeem_name] ]
      end
    end

    puts "\nReport saved to: #{csv_output}"

    # Print summary by status
    puts "\n" + "=" * 60
    puts "SUMMARY BY STATUS"
    puts "=" * 60
    results.group_by { |r| r[:status] }.each do |status, items|
      puts "#{status}: #{items.count}"
    end

    # Print summary by match type (for matched)
    matched = results.select { |r| r[:status] == "MATCHED" }
    if matched.any?
      puts "\nMATCHED BY:"
      matched.group_by { |r| r[:match_type] }.each do |type, items|
        puts "  #{type}: #{items.count}"
      end
    end
  end
end
