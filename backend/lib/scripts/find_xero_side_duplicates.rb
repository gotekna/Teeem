# Find Xero-Side Duplicates
# Identifies contacts with the same name that have different Xero contact IDs
# within the SAME Xero tenant. This indicates duplicate contacts in Xero itself.
#
# Usage: rails runner lib/scripts/find_xero_side_duplicates.rb
#
# Options:
#   TENANT_NAME=xxx  - Only check specific tenant
#   MIN_COUNT=2      - Minimum number of contacts with same name (default: 2)
#
# Examples:
#   rails runner lib/scripts/find_xero_side_duplicates.rb
#   TENANT_NAME="Tekna Drafting" rails runner lib/scripts/find_xero_side_duplicates.rb
#   MIN_COUNT=3 rails runner lib/scripts/find_xero_side_duplicates.rb

tenant_filter = ENV['TENANT_NAME']
min_count = (ENV['MIN_COUNT'] || 2).to_i

puts "="*80
puts "XERO-SIDE DUPLICATE DETECTOR"
puts "="*80
puts "Tenant Filter: #{tenant_filter || 'ALL tenants'}"
puts "Min Contacts: #{min_count}"
puts ""

# Strategy:
# 1. Group contacts by display_name (case-insensitive)
# 2. For each name group with 2+ contacts, check their Xero links
# 3. If multiple contacts have Xero links to the SAME tenant (different Xero IDs),
#    that's a Xero-side duplicate

# Get all contacts with Xero links, grouped by normalized name
sql = <<-SQL
  SELECT
    LOWER(TRIM(c.display_name)) as normalized_name,
    c.display_name as original_name,
    STRING_AGG(DISTINCT c.id::text, ',') as contact_ids,
    COUNT(DISTINCT c.id) as contact_count
  FROM contacts c
  INNER JOIN contact_external_links cel ON cel.contact_id = c.id
  WHERE cel.source = 'xero'
    #{tenant_filter ? "AND cel.tenant_name = '#{tenant_filter}'" : ''}
  GROUP BY LOWER(TRIM(c.display_name)), c.display_name
  HAVING COUNT(DISTINCT c.id) >= #{min_count}
  ORDER BY contact_count DESC, c.display_name
SQL

name_groups = ActiveRecord::Base.connection.execute(sql)

if name_groups.count == 0
  puts "✅ No duplicate contact names found!"
  exit 0
end

puts "Found #{name_groups.count} contact names with multiple TEEEM contacts"
puts "-"*80
puts ""

duplicates_found = 0

name_groups.each do |row|
  normalized_name = row['normalized_name']
  original_name = row['original_name']
  contact_ids = row['contact_ids'].split(',').map(&:to_i)
  contact_count = row['contact_count']

  # Get all Xero links for these contacts
  links = ContactExternalLink
    .where(contact_id: contact_ids, source: 'xero')
    .order(:tenant_name, :contact_id)

  # Group links by tenant
  by_tenant = links.group_by(&:tenant_name)

  # Find tenants with multiple different Xero IDs
  xero_side_dups = by_tenant.select do |tenant_name, tenant_links|
    # Count distinct Xero contact IDs for this tenant
    tenant_links.map(&:external_contact_id).uniq.count > 1
  end

  next if xero_side_dups.empty?

  duplicates_found += 1

  puts "#{duplicates_found}. \"#{original_name}\" (#{contact_count} TEEEM contacts)"
  puts "   Xero-side duplicates found in #{xero_side_dups.count} tenant(s):"
  puts ""

  xero_side_dups.each do |tenant_name, tenant_links|
    puts "   Tenant: #{tenant_name}"

    # Group by contact to show which TEEEM contact has which Xero ID
    by_contact = tenant_links.group_by(&:contact_id)

    by_contact.each do |contact_id, contact_links|
      contact = Contact.find(contact_id)
      contact_links.each do |link|
        status = link.xero_contact_status || 'unknown'
        verified = link.last_verified_at ? link.last_verified_at.strftime('%Y-%m-%d %H:%M') : 'never'
        puts "     - Contact #{contact_id}: Xero ID #{link.external_contact_id[0..20]}... | Status: #{status} | Verified: #{verified}"
      end
    end

    puts ""
  end

  puts "   💡 Solution: Merge/delete duplicate contacts in Xero (#{tenant_name}), then merge TEEEM contacts"
  puts ""
end

puts "="*80
puts "SUMMARY"
puts "="*80
puts "Contact names checked: #{name_groups.count}"
puts "Xero-side duplicates found: #{duplicates_found}"
puts ""

if duplicates_found > 0
  puts "⚠️  These duplicates exist in Xero itself, not just TEEEM."
  puts "Fix by:"
  puts "1. Clean up duplicates in Xero (merge or delete)"
  puts "2. Wait for next Xero sync (will mark old links as 'not_found')"
  puts "3. Merge TEEEM contacts using the UI"
  puts "4. Cleanup job will remove stale links after 7 days"
else
  puts "✅ No Xero-side duplicates found!"
end
puts ""
