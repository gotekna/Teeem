# frozen_string_literal: true

namespace :contacts do
  desc "Migrate legacy address columns to contact_addresses table (SSoT)"
  task migrate_legacy_addresses: :environment do
    puts "Migrating legacy contact addresses to contact_addresses table..."
    puts "contact_addresses is the SSoT - this populates it from legacy columns"
    puts ""

    # Find contacts with legacy address data but no STREET address in contact_addresses
    contacts_with_legacy = Contact.where.not(address: [nil, ""])
                                  .or(Contact.where.not(city: [nil, ""]))
                                  .or(Contact.where.not(state: [nil, ""]))
                                  .or(Contact.where.not(postcode: [nil, ""]))

    total = contacts_with_legacy.count
    migrated = 0
    skipped = 0
    errors = 0

    puts "Found #{total} contacts with legacy address data"
    puts ""

    contacts_with_legacy.find_each do |contact|
      # Skip if already has a STREET address
      if contact.contact_addresses.street.exists?
        skipped += 1
        next
      end

      # Parse legacy address field (may be multi-line)
      address_lines = contact.address.to_s.split("\n").map(&:strip).reject(&:blank?)
      line1 = address_lines[0]
      line2 = address_lines[1] if address_lines.length > 1

      # Skip if no actual address data
      if line1.blank? && contact.city.blank? && contact.state.blank? && contact.postcode.blank?
        skipped += 1
        next
      end

      begin
        contact.contact_addresses.create!(
          address_type: "STREET",
          line1: line1,
          line2: line2,
          city: contact.city,
          region: contact.state,
          postal_code: contact.postcode,
          country: "Australia", # Default for TEEEM
          is_primary: true
        )
        migrated += 1
        print "." if migrated % 100 == 0
      rescue StandardError => e
        errors += 1
        puts "\nError migrating contact #{contact.id} (#{contact.display_name}): #{e.message}"
      end
    end

    puts ""
    puts ""
    puts "Migration complete!"
    puts "  Total contacts with legacy data: #{total}"
    puts "  Migrated to contact_addresses:   #{migrated}"
    puts "  Skipped (already have address):  #{skipped}"
    puts "  Errors:                          #{errors}"
  end

  desc "Check contacts missing address in form but have legacy data"
  task check_address_ssot: :environment do
    puts "Checking address SSoT status..."
    puts ""

    # Contacts with legacy data but no contact_addresses
    missing_ssot = Contact.where.not(address: [nil, ""])
                          .or(Contact.where.not(city: [nil, ""]))
                          .or(Contact.where.not(state: [nil, ""]))
                          .or(Contact.where.not(postcode: [nil, ""]))
                          .left_joins(:contact_addresses)
                          .where(contact_addresses: { id: nil })

    puts "Contacts with legacy address data but NO contact_addresses: #{missing_ssot.count}"

    if missing_ssot.count > 0
      puts ""
      puts "Sample contacts (first 10):"
      missing_ssot.limit(10).each do |contact|
        puts "  ID: #{contact.id}, Name: #{contact.display_name}"
        puts "    Legacy: #{contact.address}, #{contact.city}, #{contact.state} #{contact.postcode}"
      end
      puts ""
      puts "Run 'rails contacts:migrate_legacy_addresses' to fix"
    else
      puts "All contacts are using contact_addresses SSoT correctly!"
    end
  end
end
