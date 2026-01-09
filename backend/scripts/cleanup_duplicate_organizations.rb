#!/usr/bin/env ruby
# Script to clean up duplicate organization Microsoft app credentials
# Keeps the most recently updated active record, deactivates the rest

puts "==== Cleaning Up Duplicate Organization Records ===="
puts ""

# For each organization name that has duplicates
OrganizationMicrosoftAppCredential.where(is_active: true)
  .group(:name)
  .having("COUNT(*) > 1")
  .count
  .each do |org_name, count|
    puts "Found #{count} active records for: #{org_name}"

    # Get all active records for this org, ordered by most recently updated first
    records = OrganizationMicrosoftAppCredential.where(name: org_name, is_active: true)
                                                  .order(updated_at: :desc)

    # Keep the first one (most recently updated)
    keeper = records.first
    duplicates = records[1..-1]

    puts "  Keeping record ID #{keeper.id} (updated: #{keeper.updated_at})"
    puts "    - status: #{keeper.status}"
    puts "    - has credentials: #{keeper.client_id.present?}"

    # Disconnect and deactivate duplicates
    duplicates.each do |duplicate|
      puts "  Removing duplicate ID #{duplicate.id} (updated: #{duplicate.updated_at})"
      puts "    - status: #{duplicate.status}"
      puts "    - has credentials: #{duplicate.client_id.present?}"

      # Use disconnect! to clear credentials and mark inactive
      duplicate.disconnect!
      puts "    ✓ Disconnected and deactivated"
    end

    puts ""
  end

# Summary
active_orgs = OrganizationMicrosoftAppCredential.where(is_active: true)
puts "==== Summary ===="
puts "Active organizations after cleanup:"
active_orgs.each do |org|
  puts "  #{org.name} (ID: #{org.id})"
  puts "    - status: #{org.status}"
  puts "    - has credentials: #{org.client_id.present?}"
  puts "    - updated: #{org.updated_at}"
end

puts ""
puts "Total active organizations: #{active_orgs.count}"
puts ""
puts "✓ Cleanup complete!"
