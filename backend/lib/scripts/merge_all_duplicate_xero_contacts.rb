# Merge All Duplicate Xero Contacts
# Run this script to find and merge ALL duplicate contacts that have
# multiple Xero links pointing to different external_contact_ids for the same tenant.
#
# Usage: rails runner lib/scripts/merge_all_duplicate_xero_contacts.rb
#
# Options:
#   DRY_RUN=true   - Show what would happen without making changes
#   TENANT_ID=xxx  - Only process duplicates for specific tenant
#
# Examples:
#   rails runner lib/scripts/merge_all_duplicate_xero_contacts.rb
#   DRY_RUN=true rails runner lib/scripts/merge_all_duplicate_xero_contacts.rb
#   TENANT_ID=55b5ff3c-4181-4c2a-b37e-4d2bdb38644f rails runner lib/scripts/merge_all_duplicate_xero_contacts.rb

dry_run = ENV['DRY_RUN'] == 'true'
target_tenant_id = ENV['TENANT_ID']

puts "="*80
puts "MERGE ALL DUPLICATE XERO CONTACTS"
puts "="*80
puts "Mode: #{dry_run ? 'DRY RUN (no changes)' : 'LIVE (will make changes)'}"
puts "Tenant Filter: #{target_tenant_id || 'ALL tenants'}"
puts ""

# Find all contacts with multiple Xero links for the same tenant
sql = <<-SQL
  SELECT
    contact_id,
    tenant_id,
    COUNT(*) as link_count,
    STRING_AGG(DISTINCT external_contact_id, ', ') as xero_ids
  FROM contact_external_links
  WHERE source = 'xero'
    #{target_tenant_id ? "AND tenant_id = '#{target_tenant_id}'" : ''}
  GROUP BY contact_id, tenant_id
  HAVING COUNT(DISTINCT external_contact_id) > 1
  ORDER BY link_count DESC
SQL

duplicate_groups = ActiveRecord::Base.connection.execute(sql)

if duplicate_groups.count == 0
  puts "✅ No duplicate contacts found!"
  exit 0
end

puts "Found #{duplicate_groups.count} contacts with multiple Xero links"
puts "-"*80
puts ""

stats = {
  total_groups: duplicate_groups.count,
  contacts_merged: 0,
  links_deleted: 0,
  errors: 0
}

duplicate_groups.each_with_index do |row, index|
  contact_id = row['contact_id']
  tenant_id = row['tenant_id']
  link_count = row['link_count']

  puts "#{index + 1}. Processing Contact ##{contact_id} (#{link_count} Xero links for same tenant)"

  contact = Contact.find_by(id: contact_id)
  unless contact
    puts "   ❌ ERROR: Contact not found"
    stats[:errors] += 1
    next
  end

  puts "   Name: #{contact.display_name}"

  # Get all Xero links for this contact and tenant
  links = ContactExternalLink
    .where(contact_id: contact_id, tenant_id: tenant_id, source: 'xero')
    .order('last_verified_at DESC NULLS LAST, updated_at DESC')

  # Show all links
  puts "   Links:"
  links.each_with_index do |link, i|
    verified_at = link.last_verified_at ? link.last_verified_at.strftime('%Y-%m-%d %H:%M') : 'never'
    status = link.xero_contact_status || 'unknown'
    puts "     #{i + 1}. Xero ID: #{link.external_contact_id[0..20]}... | Status: #{status} | Verified: #{verified_at}"
  end

  # Keep the first link (most recently verified), mark others as stale
  active_link = links.first
  stale_links = links[1..-1]

  puts "   ✅ Keeping: #{active_link.external_contact_id[0..20]}... (verified: #{active_link.last_verified_at || 'never'})"
  puts "   ❌ Marking #{stale_links.count} links as stale"

  unless dry_run
    begin
      stale_links.each do |link|
        link.mark_stale!('not_found')
        link.update!(sync_error: "Duplicate link - keeping most recently verified")
        link.destroy!
        stats[:links_deleted] += 1
        puts "      ✅ Deleted link: #{link.external_contact_id[0..20]}..."
      end
    rescue StandardError => e
      puts "   ❌ ERROR: #{e.message}"
      stats[:errors] += 1
    end
  end

  puts ""
end

puts "="*80
puts "SUMMARY"
puts "="*80
puts "Total duplicate groups found: #{stats[:total_groups]}"
puts "Stale links deleted: #{stats[:links_deleted]}" unless dry_run
puts "Errors: #{stats[:errors]}"
puts ""

if dry_run
  puts "⚠️  DRY RUN MODE - No changes were made"
  puts "Run without DRY_RUN=true to apply changes"
else
  puts "✅ SUCCESS - All duplicates processed"
  puts ""
  puts "Next steps:"
  puts "1. Run a Xero sync to verify remaining links"
  puts "2. Check for any new duplicates (there shouldn't be any)"
end
puts ""
