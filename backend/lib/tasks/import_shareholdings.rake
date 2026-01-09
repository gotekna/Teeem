require "json"

namespace :corporate do
  desc "Import shareholdings and parent relationships from JSON file"
  task import_shareholdings: :environment do
    file_path = Rails.root.join("db", "shareholdings_data.json")

    unless File.exist?(file_path)
      puts "ERROR: #{file_path} not found"
      exit 1
    end

    data = JSON.parse(File.read(file_path))
    puts "=" * 80
    puts "SHAREHOLDINGS IMPORT FROM JSON"
    puts "=" * 80

    # Helper to find company by name
    find_company = ->(name) {
      Company.where("LOWER(name) LIKE ?", "%#{name.downcase.gsub('pty ltd', '').strip}%").first
    }

    # Helper to find contact by name
    find_contact = ->(name) {
      Contact.where("LOWER(full_name) LIKE ?", "%#{name.downcase}%").first
    }

    # Import shareholdings
    puts "\n--- Importing Shareholdings ---"
    shareholdings_count = 0

    data["shareholdings"].each do |sh|
      company = find_company.call(sh["company_name"])
      unless company
        puts "  Company not found: #{sh['company_name']}"
        next
      end

      shareholder = if sh["shareholder_type"] == "Company"
                      find_company.call(sh["shareholder_name"])
      else
                      find_contact.call(sh["shareholder_name"])
      end

      unless shareholder
        puts "  Shareholder not found: #{sh['shareholder_name']} (#{sh['shareholder_type']})"
        next
      end

      cs = CompanyShareholding.find_or_initialize_by(
        company: company,
        shareholder: shareholder,
        shareholder_type: shareholder.class.name
      )
      cs.update!(
        number_of_shares: sh["number_of_shares"],
        share_class: sh["share_class"],
        beneficially_held: sh["beneficially_held"],
        beneficial_owner: sh["beneficial_owner"]
      )
      shareholdings_count += 1
      puts "  #{company.name} owned by #{sh['shareholder_name']} (#{sh['number_of_shares']} shares)"
    end

    # Import parent relationships
    puts "\n--- Setting Parent Relationships ---"
    parents_count = 0

    data["parent_relationships"].each do |rel|
      child = find_company.call(rel["child_name"])
      parent = find_company.call(rel["parent_name"])

      if child && parent
        child.update!(parent_company_id: parent.id, hierarchy_level: rel["hierarchy_level"])
        parents_count += 1
        puts "  #{child.name} -> #{parent.name}"
      else
        puts "  Could not set: #{rel['child_name']} -> #{rel['parent_name']}"
      end
    end

    puts "\n" + "=" * 80
    puts "IMPORT COMPLETE"
    puts "Shareholdings imported: #{shareholdings_count}"
    puts "Parent relationships set: #{parents_count}"
    puts "=" * 80
  end
end
