namespace :ssot do
  desc "Link existing Companies to Contact records (SSoT migration)"
  task link_companies_to_contacts: :environment do
    puts "Starting SSoT Data Migration: Linking Companies to Contacts..."
    puts "=" * 60

    companies_linked = 0
    companies_created = 0
    errors = []

    Company.find_each do |company|
      next if company.contact_id.present?

      begin
        # Determine entity type for the contact
        entity_type = if company.trust_name.present?
                        "trust"
        else
                        "company"
        end

        # Try to find an existing Contact by ABN match
        contact = if company.abn.present?
                    Contact.find_by(tax_number: company.abn)
        end

        # If not found by ABN, try by exact name match
        contact ||= Contact.find_by(
          full_name: company.name,
          entity_type: entity_type
        )

        if contact
          # Link existing contact
          company.update!(contact_id: contact.id)
          puts "  [LINKED] Company '#{company.name}' -> Contact ##{contact.id}"
          companies_linked += 1
        else
          # Create new Contact for this company
          contact = Contact.create!(
            full_name: company.name,
            entity_type: entity_type,
            tax_number: company.abn,
            company_group_id: company.company_group_id,
            bank_bsb: company.bank_bsb,
            bank_account_number: company.bank_account_number,
            bank_account_name: company.bank_account_name
          )
          company.update!(contact_id: contact.id)
          puts "  [CREATED] Contact ##{contact.id} for Company '#{company.name}'"
          companies_created += 1
        end
      rescue StandardError => e
        errors << { company: company.name, error: e.message }
        puts "  [ERROR] Company '#{company.name}': #{e.message}"
      end
    end

    puts "=" * 60
    puts "SSoT Migration Complete!"
    puts "  Companies linked to existing contacts: #{companies_linked}"
    puts "  New contacts created: #{companies_created}"
    puts "  Errors: #{errors.count}"

    if errors.any?
      puts "\nErrors:"
      errors.each { |e| puts "  - #{e[:company]}: #{e[:error]}" }
    end
  end

  desc "Create ContactCompanyGroupMemberships for all Directors and Shareholders"
  task create_memberships: :environment do
    puts "Starting SSoT Data Migration: Creating Company Group Memberships..."
    puts "=" * 60

    memberships_created = 0
    skipped = 0
    errors = []

    # Process Directors
    puts "\nProcessing Directors..."
    CompanyDirector.includes(:contact, company: :company_group).find_each do |director|
      next unless director.company&.company_group_id
      next unless director.contact_id

      begin
        membership = ContactCompanyGroupMembership.find_or_initialize_by(
          contact_id: director.contact_id,
          company_group_id: director.company.company_group_id
        )

        if membership.new_record?
          membership.membership_type = "director"
          membership.is_active = director.is_current
          membership.save!
          puts "  [CREATED] Director membership: #{director.contact.display_name} -> #{director.company.company_group.name}"
          memberships_created += 1
        else
          skipped += 1
        end
      rescue StandardError => e
        errors << { type: "director", contact: director.contact&.display_name, error: e.message }
        puts "  [ERROR] Director #{director.contact&.display_name}: #{e.message}"
      end
    end

    # Process Shareholders (Contact-based)
    puts "\nProcessing Shareholders..."
    CompanyShareholding.where(shareholder_type: "Contact").includes(:company).find_each do |shareholding|
      next unless shareholding.company&.company_group_id
      next unless shareholding.shareholder_id

      begin
        contact = Contact.find_by(id: shareholding.shareholder_id)
        next unless contact

        membership = ContactCompanyGroupMembership.find_or_initialize_by(
          contact_id: contact.id,
          company_group_id: shareholding.company.company_group_id
        )

        if membership.new_record?
          membership.membership_type = "shareholder"
          membership.is_active = true
          membership.save!
          puts "  [CREATED] Shareholder membership: #{contact.display_name} -> #{shareholding.company.company_group.name}"
          memberships_created += 1
        else
          # Update membership type if already exists as director
          if membership.membership_type == "director"
            # Person is both director and shareholder - keep as director (higher privilege)
            skipped += 1
          else
            skipped += 1
          end
        end
      rescue StandardError => e
        errors << { type: "shareholder", contact_id: shareholding.shareholder_id, error: e.message }
        puts "  [ERROR] Shareholder #{shareholding.shareholder_id}: #{e.message}"
      end
    end

    # Process Companies (create entity memberships)
    puts "\nProcessing Companies as entities..."
    Company.where.not(contact_id: nil).includes(:company_group).find_each do |company|
      next unless company.company_group_id

      begin
        membership = ContactCompanyGroupMembership.find_or_initialize_by(
          contact_id: company.contact_id,
          company_group_id: company.company_group_id
        )

        if membership.new_record?
          membership.membership_type = company.trust_name.present? ? "trust_entity" : "company_entity"
          membership.company_id = company.id  # Link back to Company record
          membership.is_active = company.status == "active"
          membership.save!
          puts "  [CREATED] Entity membership: #{company.name} -> #{company.company_group.name}"
          memberships_created += 1
        else
          # Update company reference if missing
          if membership.company_id.nil?
            membership.update!(company_id: company.id)
          end
          skipped += 1
        end
      rescue StandardError => e
        errors << { type: "company", company: company.name, error: e.message }
        puts "  [ERROR] Company #{company.name}: #{e.message}"
      end
    end

    puts "=" * 60
    puts "SSoT Membership Migration Complete!"
    puts "  Memberships created: #{memberships_created}"
    puts "  Skipped (already exist): #{skipped}"
    puts "  Errors: #{errors.count}"

    if errors.any?
      puts "\nErrors:"
      errors.each { |e| puts "  - #{e[:type]} #{e[:contact] || e[:company] || e[:contact_id]}: #{e[:error]}" }
    end
  end

  desc "Run full SSoT data migration (link companies, then create memberships)"
  task migrate_all: [ :link_companies_to_contacts, :create_memberships ] do
    puts "\n" + "=" * 60
    puts "Full SSoT Migration Complete!"
    puts "=" * 60
  end

  desc "Show SSoT migration status"
  task status: :environment do
    puts "SSoT Migration Status"
    puts "=" * 60

    total_companies = Company.count
    linked_companies = Company.where.not(contact_id: nil).count
    unlinked_companies = Company.where(contact_id: nil).count

    puts "\nCompanies:"
    puts "  Total: #{total_companies}"
    puts "  Linked to Contact: #{linked_companies}"
    puts "  Unlinked: #{unlinked_companies}"

    total_memberships = ContactCompanyGroupMembership.count
    director_memberships = ContactCompanyGroupMembership.directors.count
    shareholder_memberships = ContactCompanyGroupMembership.shareholders.count
    entity_memberships = ContactCompanyGroupMembership.where(membership_type: %w[company_entity trust_entity]).count

    puts "\nMemberships:"
    puts "  Total: #{total_memberships}"
    puts "  Directors: #{director_memberships}"
    puts "  Shareholders: #{shareholder_memberships}"
    puts "  Entity (Company/Trust): #{entity_memberships}"

    puts "\nCompany Groups with Contacts:"
    CompanyGroup.includes(:contacts).each do |group|
      contacts_count = group.contacts.count
      puts "  #{group.name}: #{contacts_count} contacts"
    end
  end
end
