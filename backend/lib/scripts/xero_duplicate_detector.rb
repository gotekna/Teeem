# Xero Duplicate Contact Detector
# Identifies contacts with duplicate names in the same Xero organization
# Usage: rails runner lib/scripts/xero_duplicate_detector.rb

class XeroDuplicateDetector
  def self.run
    puts "\n" + "="*80
    puts "XERO DUPLICATE CONTACT DETECTION REPORT"
    puts "="*80
    puts "Generated: #{Time.now.in_time_zone('Australia/Brisbane').strftime('%Y-%m-%d %H:%M %Z')}"
    puts "\n"

    # Get all contacts with Xero links
    contacts_with_xero = Contact.joins(:external_links)
      .where(contact_external_links: { source: 'xero' })
      .distinct
      .includes(:external_links)

    puts "Total contacts with Xero links: #{contacts_with_xero.count}"
    puts "\n" + "-"*80
    puts "\n"

    # Group by normalized name
    name_groups = {}
    contacts_with_xero.each do |contact|
      normalized_name = contact.display_name.to_s.strip.downcase
      name_groups[normalized_name] ||= []
      name_groups[normalized_name] << contact
    end

    # Filter to only duplicates (2+ contacts with same name)
    duplicate_names = name_groups.select { |_name, contacts| contacts.count > 1 }

    puts "Found #{duplicate_names.count} duplicate contact names\n\n"

    # Analyze each duplicate name
    critical_duplicates = []
    potential_duplicates = []

    duplicate_names.each do |normalized_name, contacts|
      # Get all Xero links for these contacts
      org_map = {} # tenant_id => { contact_id => [xero_contact_ids] }

      contacts.each do |contact|
        contact.external_links.where(source: 'xero').each do |link|
          tenant_id = link.tenant_id
          org_map[tenant_id] ||= {}
          org_map[tenant_id][contact.id] ||= []
          org_map[tenant_id][contact.id] << link.external_contact_id
        end
      end

      # Check if any org has multiple TEEEM contacts (different contact IDs, different Xero IDs)
      has_critical_duplicate = org_map.any? do |_tenant_id, contact_xero_map|
        contact_xero_map.keys.count > 1 # Multiple TEEEM contacts for same org
      end

      duplicate_info = {
        name: contacts.first.display_name,
        normalized: normalized_name,
        teeem_contacts: contacts.map(&:id),
        org_map: org_map,
        critical: has_critical_duplicate
      }

      if has_critical_duplicate
        critical_duplicates << duplicate_info
      else
        potential_duplicates << duplicate_info
      end
    end

    # Report CRITICAL duplicates (same org, different Xero IDs)
    if critical_duplicates.any?
      puts "🔴 CRITICAL DUPLICATES - MERGE REQUIRED IN XERO"
      puts "These contacts exist multiple times in the SAME Xero organization"
      puts "="*80
      puts "\n"

      critical_duplicates.each do |dup|
        puts "Contact Name: #{dup[:name]}"
        puts "TEEEM Contact IDs: #{dup[:teeem_contacts].join(', ')}"
        puts "\nDuplicate Organizations:"

        dup[:org_map].each do |tenant_id, contact_xero_map|
          next unless contact_xero_map.keys.count > 1 # Only show orgs with duplicates

          # Get org name
          org = XeroOrganization.find_by(tenant_id: tenant_id)
          org_name = org ? org.name : "Unknown (#{tenant_id})"

          puts "  📍 #{org_name}"
          contact_xero_map.each do |contact_id, xero_ids|
            contact = Contact.find(contact_id)
            puts "     TEEEM Contact #{contact_id} (#{contact.display_name})"
            xero_ids.each do |xero_id|
              puts "       → Xero Contact ID: #{xero_id}"
            end
          end
          puts ""
        end
        puts "-"*80
        puts "\n"
      end
    else
      puts "✅ No critical duplicates found (same Xero org with different Contact IDs)\n\n"
    end

    # Report POTENTIAL duplicates (same name, different orgs only)
    if potential_duplicates.any?
      puts "\n" + "="*80
      puts "⚠️  POTENTIAL DUPLICATES - REVIEW RECOMMENDED"
      puts "These contacts have the same name but in different Xero organizations"
      puts "="*80
      puts "\n"

      potential_duplicates.first(10).each do |dup| # Show first 10 to avoid spam
        puts "Contact Name: #{dup[:name]}"
        puts "TEEEM Contact IDs: #{dup[:teeem_contacts].join(', ')}"
        puts "Organizations: #{dup[:org_map].keys.count}"

        dup[:org_map].each do |tenant_id, contact_xero_map|
          org = XeroOrganization.find_by(tenant_id: tenant_id)
          org_name = org ? org.name : "Unknown"
          contact_ids = contact_xero_map.keys.join(', ')
          puts "  - #{org_name} (TEEEM contacts: #{contact_ids})"
        end
        puts "\n"
      end

      if potential_duplicates.count > 10
        puts "... and #{potential_duplicates.count - 10} more potential duplicates\n"
      end
    end

    # Summary
    puts "\n" + "="*80
    puts "SUMMARY"
    puts "="*80
    puts "Critical duplicates (merge required in Xero): #{critical_duplicates.count}"
    puts "Potential duplicates (same name, different orgs): #{potential_duplicates.count}"
    puts "\n"
    puts "ACTION REQUIRED:"
    puts "1. Log into each Xero organization listed above"
    puts "2. Search for the duplicate contact name"
    puts "3. Merge the duplicates in Xero directly"
    puts "4. Re-run Xero sync in TEEEM to update"
    puts "\n"
    puts "="*80
    puts "\n"
  end
end

XeroDuplicateDetector.run
