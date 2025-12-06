require "json"

namespace :corporate do
  desc "Import company details from JSON file"
  task import_companies: :environment do
    file_path = Rails.root.join("db", "companies_data.json")

    unless File.exist?(file_path)
      puts "ERROR: #{file_path} not found"
      exit 1
    end

    data = JSON.parse(File.read(file_path))
    puts "=" * 80
    puts "COMPANY DETAILS IMPORT FROM JSON"
    puts "=" * 80

    # Helper to find company by name
    find_company = ->(name, sheet_name) {
      return nil if name.blank? && sheet_name.blank?

      # Try by name first
      if name.present?
        search = name.downcase.gsub(/pty ltd/i, "").strip
        company = Company.where("LOWER(name) LIKE ?", "%#{search}%").first
        return company if company
      end

      # Try by sheet name
      if sheet_name.present?
        search = sheet_name.downcase.gsub(/pty ltd/i, "").strip
        company = Company.where("LOWER(name) LIKE ?", "%#{search}%").first
        return company if company
      end

      # Special cases
      case sheet_name
      when "THSI"
        Company.where("LOWER(name) LIKE ?", "%team harder super investments%").first
      when "Tekna Admin"
        Company.where("LOWER(name) LIKE ?", "%tekna admin%").first
      else
        nil
      end
    }

    # Helper to find contact by name
    find_contact = ->(name) {
      return nil if name.blank?
      Contact.where("LOWER(full_name) LIKE ?", "%#{name.downcase}%").first
    }

    updates_count = 0
    directors_count = 0
    not_found = []

    data.each do |company_data|
      company = find_company.call(company_data["name"], company_data["sheet_name"])

      unless company
        not_found << company_data["sheet_name"]
        next
      end

      puts "\n--- #{company.name} ---"

      # Build update attributes
      attrs = {}
      attrs[:acn] = company_data["acn"].gsub(/\s/, "") if company_data["acn"].present?
      attrs[:abn] = company_data["abn"].gsub(/\s/, "") if company_data["abn"].present?
      attrs[:tfn] = company_data["tfn"].gsub(/\s/, "") if company_data["tfn"].present?

      if company_data["date_incorporated"].present? && company_data["date_incorporated"] !~ /^\d{4}-\d{2}-\d{2}$/
        # Skip invalid dates
      elsif company_data["date_incorporated"].present?
        attrs[:date_incorporated] = company_data["date_incorporated"]
      end

      attrs[:shares_on_issue] = company_data["shares_on_issue"] if company_data["shares_on_issue"].to_i > 0
      attrs[:registered_office_address] = company_data["registered_office"] if company_data["registered_office"].present?
      attrs[:principal_place_of_business] = company_data["principal_place"] if company_data["principal_place"].present?
      attrs[:is_trustee] = company_data["is_trustee"]
      attrs[:trust_name] = company_data["trust_name"] if company_data["trust_name"].present?

      if attrs.any?
        company.update!(attrs)
        puts "  Updated: #{attrs.keys.join(', ')}"
        updates_count += 1
      end

      # Import directors
      company_data["directors"]&.each do |director_data|
        next if director_data["name"].blank?

        contact = find_contact.call(director_data["name"])
        unless contact
          puts "  Director not found: #{director_data['name']}"
          next
        end

        appointed_date = begin
          Date.parse(director_data["appointed"]) if director_data["appointed"].present? && director_data["appointed"] =~ /^\d{4}-\d{2}-\d{2}$/
        rescue
          nil
        end

        # Check if already exists (any position)
        existing = CompanyDirector.find_by(company: company, contact: contact, is_current: true)
        if existing
          puts "  Director already exists: #{contact.full_name}"
        else
          cd = CompanyDirector.find_or_initialize_by(
            company: company,
            contact: contact,
            position: "director"
          )
          cd.appointment_date ||= appointed_date
          cd.is_current = true
          if cd.new_record? || cd.changed?
            cd.save!
            directors_count += 1
            puts "  Director: #{contact.full_name} (appointed: #{appointed_date})"
          end
        end
      end

      # Import secretaries
      company_data["secretaries"]&.each do |secretary_data|
        next if secretary_data["name"].blank?

        contact = find_contact.call(secretary_data["name"])
        unless contact
          puts "  Secretary not found: #{secretary_data['name']}"
          next
        end

        appointed_date = begin
          Date.parse(secretary_data["appointed"]) if secretary_data["appointed"].present? && secretary_data["appointed"] =~ /^\d{4}-\d{2}-\d{2}$/
        rescue
          nil
        end

        # Check if already exists (any position)
        existing = CompanyDirector.find_by(company: company, contact: contact, is_current: true)
        if existing
          puts "  Secretary already exists: #{contact.full_name}"
        else
          cd = CompanyDirector.find_or_initialize_by(
            company: company,
            contact: contact,
            position: "secretary"
          )
          cd.appointment_date ||= appointed_date
          cd.is_current = true
          if cd.new_record? || cd.changed?
            cd.save!
            directors_count += 1
            puts "  Secretary: #{contact.full_name} (appointed: #{appointed_date})"
          end
        end
      end
    end

    puts "\n" + "=" * 80
    puts "IMPORT COMPLETE"
    puts "Companies updated: #{updates_count}"
    puts "Directors/Secretaries added: #{directors_count}"
    if not_found.any?
      puts "Not found: #{not_found.join(', ')}"
    end
    puts "=" * 80
  end
end
