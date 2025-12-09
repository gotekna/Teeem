namespace :contacts do
  desc "Fix people with self-referencing primary_company_id by creating proper companies"
  task fix_self_referencing_companies: :environment do
    puts "=" * 60
    puts "FIX SELF-REFERENCING COMPANY IDs"
    puts "=" * 60
    puts

    # Find people with primary_company_id pointing to themselves
    people = Contact.where(entity_type: "person")
                   .where("primary_company_id = id")
                   .order(:id)

    puts "Found #{people.count} people with self-referencing company IDs"
    puts

    if people.count == 0
      puts "No issues found!"
      return
    end

    stats = {
      companies_created: 0,
      people_updated: 0,
      skipped: 0,
      errors: 0
    }

    people.find_each do |person|
      begin
        company_name = person.company_name_or_trust

        if company_name.blank?
          puts "⊘ SKIPPED [#{person.id}] #{person.full_name} - No company name"
          stats[:skipped] += 1
          next
        end

        # Check if company already exists
        existing = Contact.where(entity_type: [ "company", "trust" ])
                         .where("LOWER(full_name) = ? OR LOWER(company_name_or_trust) = ?",
                                company_name.downcase, company_name.downcase)
                         .first

        if existing
          # Link to existing company
          person.primary_company_id = existing.id
          person.company_name_or_trust = nil
          person.tax_number = nil if person.tax_number.present?
          person.save(validate: false)

          puts "✓ LINKED [#{person.id}] #{person.full_name} → [#{existing.id}] #{existing.full_name}"
          stats[:people_updated] += 1
          next
        end

        # Create new company contact
        company_contact = Contact.new(
          entity_type: "company",
          full_name: company_name,
          company_name_or_trust: company_name,
          tax_number: person.tax_number,
          xero_contact_number: person.xero_contact_number,
          address: person.address,
          website: person.website,
          email: person.email&.include?("@") ? "info@#{person.email.split('@').last}" : nil,
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

          # Update person to link to new company
          person.primary_company_id = company_contact.id
          person.company_name_or_trust = nil
          person.tax_number = nil
          person.office_phone = nil if person.office_phone.present? && person.office_phone.length < 8
          person.save(validate: false)

          stats[:companies_created] += 1
          stats[:people_updated] += 1

          puts "✓ CREATED [#{company_contact.id}] #{company_name}"
          puts "  → Employee: [#{person.id}] #{person.full_name}"
          if person.tax_number
            puts "  → Transferred ABN: #{person.tax_number}"
          end
        else
          stats[:errors] += 1
          puts "✗ ERROR creating company for [#{person.id}] #{person.full_name}: #{company_contact.errors.full_messages.join(', ')}"
        end

      rescue => e
        stats[:errors] += 1
        puts "✗ ERROR [#{person.id}] #{person.full_name}: #{e.message}"
      end
    end

    puts
    puts "=" * 60
    puts "FIX COMPLETE"
    puts "=" * 60
    puts "Companies created:  #{stats[:companies_created]}"
    puts "People updated:     #{stats[:people_updated]}"
    puts "Skipped:            #{stats[:skipped]}"
    puts "Errors:             #{stats[:errors]}"
    puts
  end

  desc "Preview people with self-referencing company IDs"
  task preview_self_referencing: :environment do
    people = Contact.where(entity_type: "person")
                   .where("primary_company_id = id")
                   .order(:id)

    puts "PREVIEW: People with self-referencing company IDs (#{people.count}):"
    puts

    people.each do |p|
      puts "ID #{p.id}: #{p.full_name}"
      puts "  Company: #{p.company_name_or_trust}"
      puts "  ABN: #{p.tax_number}" if p.tax_number.present?
      puts "  primary_company_id: #{p.primary_company_id} (points to self)"
      puts
    end
  end
end
