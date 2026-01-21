namespace :xero do
  desc "Fix Xero contact mismatches - links internal team members to correct company contacts"
  task fix_mismatches: :environment do
    puts "=" * 80
    puts "Fixing Xero Contact Mismatches"
    puts "=" * 80

    tenant_id = Contact.first&.tenant_id
    unless tenant_id
      puts "ERROR: No contacts found, cannot determine tenant_id"
      exit 1
    end

    # Helper to create company contact
    def create_company(name, tenant_id)
      existing = Contact.find_by(display_name: name, entity_type: 'company')
      return existing if existing

      next_id = (Contact.maximum(:id) || 0) + 1
      contact = Contact.create!(
        display_name: name,
        company_name_or_trust: name,
        entity_type: 'company',
        tenant_id: tenant_id,
        is_active: true,
        contact_code: "C#{next_id}"
      )
      contact.update_columns(contact_code: "C#{contact.id}")
      puts "  Created company: #{name} -> ##{contact.id}"
      contact
    end

    # Helper to create person contact
    def create_person(name, first_name, last_name, tenant_id)
      existing = Contact.find_by(display_name: name, entity_type: 'person')
      return existing if existing

      next_id = (Contact.maximum(:id) || 0) + 1
      contact = Contact.create!(
        display_name: name,
        first_name: first_name,
        last_name: last_name,
        entity_type: 'person',
        tenant_id: tenant_id,
        is_active: true,
        contact_code: "C#{next_id}"
      )
      contact.update_columns(contact_code: "C#{contact.id}")
      puts "  Created person: #{name} -> ##{contact.id}"
      contact
    end

    # Helper to link contact to Xero
    def link_to_xero(contact, xero_sync)
      existing = ContactExternalLink.find_by(
        external_contact_id: xero_sync.xero_id,
        source: 'xero',
        tenant_id: xero_sync.xero_tenant_id
      )

      if existing
        if existing.contact_id != contact.id
          existing.update!(contact_id: contact.id)
          puts "    Updated link ##{existing.id} -> Contact ##{contact.id}"
        end
        return existing
      end

      link = ContactExternalLink.create!(
        contact_id: contact.id,
        external_contact_id: xero_sync.xero_id,
        external_name: xero_sync.xero_name,
        source: 'xero',
        tenant_id: xero_sync.xero_tenant_id,
        tenant_name: xero_sync.xero_tenant_name,
        sync_enabled: true,
        sync_direction: 'import_only',
        match_type: 'manual',
        match_confidence: 1.0,
        xero_contact_status: 'active'
      )
      puts "    Created link ##{link.id} -> Contact ##{contact.id}"
      link
    end

    # 1. Fix Rachel links to Gen2612 Pty Ltd and W2G Assets Pty Ltd
    puts "\n1. Fixing Rachel mislinks..."

    gen2612_company = create_company('Gen2612 Pty Ltd', tenant_id)
    w2g_company = create_company('W2G Assets Pty Ltd', tenant_id)

    # Find Rachel contact IDs (person contacts named Rachel)
    rachel_contacts = Contact.where(entity_type: 'person').where('display_name ILIKE ?', 'Rachel').pluck(:id)
    puts "  Rachel contact IDs: #{rachel_contacts.join(', ')}"

    # Move Gen2612 links
    gen2612_links = ContactExternalLink.where(contact_id: rachel_contacts, external_name: 'Gen2612 Pty Ltd', source: 'xero')
    gen2612_links.each do |link|
      link.update!(contact_id: gen2612_company.id)
      puts "    Moved link ##{link.id} from Rachel to Gen2612 Pty Ltd company"
    end

    # Move W2G Assets links
    w2g_links = ContactExternalLink.where(contact_id: rachel_contacts, external_name: 'W2G Assets Pty Ltd', source: 'xero')
    w2g_links.each do |link|
      link.update!(contact_id: w2g_company.id)
      puts "    Moved link ##{link.id} from Rachel to W2G Assets Pty Ltd company"
    end

    # 2. Fix other team member mislinks
    puts "\n2. Fixing other team member mislinks..."

    team_member_fixes = {
      'InfoSpark' => nil,
      'Wilson & Bradley' => nil,
      'All Clear Electrical' => nil,
      'Sunshine Coast Rendering' => nil,
      'Livin The Dream' => nil,
      'Marcoola Hire & Scaffolding' => nil,
      'Joii Flooring' => nil,
      'Joii Roofing' => nil,
      'Sunstate Garage Doors' => nil
    }

    # Create company contacts for each
    team_member_fixes.keys.each do |name|
      team_member_fixes[name] = create_company(name, tenant_id)
    end

    # Get team member contact IDs (internal team)
    team_member_ids = Contact.where(entity_type: 'person')
      .where('display_name IN (?)', ['Accounts Team', 'Ben Davison', 'Blake Leifels', 'Christine Harder',
                                      'Emily Jacobs', 'Gunnar Nelson', 'Stuart McGregor', 'Travis Voigt'])
      .pluck(:id)
    puts "  Team member contact IDs: #{team_member_ids.join(', ')}"

    # Fix each team member's mislinked Xero records
    team_member_fixes.each do |xero_name, company|
      links = ContactExternalLink.where(contact_id: team_member_ids, external_name: xero_name, source: 'xero')
      links.each do |link|
        link.update!(contact_id: company.id)
        puts "    Moved #{xero_name} link ##{link.id} to company ##{company.id}"
      end
    end

    # 3. Link unlinked Xero contacts to existing/new Teeem contacts
    puts "\n3. Linking unlinked Xero contacts..."

    # Existing contacts to link
    existing_links = [
      { contact_display: '12 Tulum Street Jimboomba QLD 4280 Pty Ltd A.C.N 677 589 347', xero_name: '12 Tulum Street Jimboomba QLD 4280 Pty Ltd A.C.N 677 589 347' },
      { contact_display: '14 Tulum Street Jimboomba QLD 4280 Pty Ltd A.C.N 677 589 347', xero_name: '14 Tulum Street Jimboomba QLD 4280 Pty Ltd A.C.N 677 589 347' },
      { contact_display: 'Bunnings Group Limited', xero_name: 'Bunnings' },
      { contact_display: 'Homes of Hope', xero_name: 'Homes of Hope' }
    ]

    existing_links.each do |link_data|
      contact = Contact.find_by('display_name ILIKE ?', "%#{link_data[:contact_display]}%")
      next unless contact

      xero_sync = XeroSyncContact.where(xero_name: link_data[:xero_name], contact_id: nil).first
      next unless xero_sync

      link_to_xero(contact, xero_sync)
    end

    # New companies to create and link
    new_companies = [
      'Access All Ways Consultants',
      'Ready Mix Concrete',
      'Southern Star Windows',
      'Stratus',
      'Mellors Plumbing Services'
    ]

    new_companies.each do |name|
      xero_sync = XeroSyncContact.where(xero_name: name, contact_id: nil).first
      next unless xero_sync

      company = create_company(name, tenant_id)
      link_to_xero(company, xero_sync)
    end

    # New people to create and link
    new_people = [
      { name: 'David Kilner and Stella Panagotiou', first: 'David', last: 'Kilner' },
      { name: 'Roger and Michelle', first: 'Roger', last: 'Michelle' },
      { name: 'Zdemek Dubrava', first: 'Zdemek', last: 'Dubrava' }
    ]

    new_people.each do |p|
      xero_sync = XeroSyncContact.where(xero_name: p[:name], contact_id: nil).first
      next unless xero_sync

      person = create_person(p[:name], p[:first], p[:last], tenant_id)
      link_to_xero(person, xero_sync)
    end

    puts "\n" + "=" * 80
    puts "Done! Verify results at: /settings/integrations/xero/view/xero-mis-match"
    puts "=" * 80
  end
end
