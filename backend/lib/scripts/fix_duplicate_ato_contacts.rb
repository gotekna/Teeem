# Fix Duplicate ATO Contacts
# Run this script to:
# 1. Identify duplicate contacts (3410 and 3496)
# 2. Mark stale Xero link as not_found
# 3. Merge TEEEM contacts
#
# Usage: rails runner lib/scripts/fix_duplicate_ato_contacts.rb

puts "="*80
puts "FIX DUPLICATE ATO CONTACTS"
puts "="*80
puts ""

# The two duplicate ATO contacts
contact_3410_id = 3410
contact_3496_id = 3496
tekna_tenant_id = '55b5ff3c-4181-4c2a-b37e-4d2bdb38644f'

puts "Contact 3410: ATO - Australian Tax Office"
puts "Contact 3496: ATO"
puts "Tekna Homes Tenant: #{tekna_tenant_id}"
puts ""

# Find the links
link_3410 = ContactExternalLink.find_by(
  contact_id: contact_3410_id,
  tenant_id: tekna_tenant_id
)

link_3496 = ContactExternalLink.find_by(
  contact_id: contact_3496_id,
  tenant_id: tekna_tenant_id
)

unless link_3410 && link_3496
  puts "❌ ERROR: Could not find both links"
  puts "Link 3410: #{link_3410 ? 'FOUND' : 'NOT FOUND'}"
  puts "Link 3496: #{link_3496 ? 'FOUND' : 'NOT FOUND'}"
  exit 1
end

puts "Found both links:"
puts "  3410 → Xero: #{link_3410.external_contact_id}"
puts "  3496 → Xero: #{link_3496.external_contact_id}"
puts ""

# Determine which one is stale by checking last_verified_at
if link_3410.last_verified_at && link_3496.last_verified_at
  if link_3410.last_verified_at > link_3496.last_verified_at
    stale_link = link_3496
    active_link = link_3410
    stale_contact_id = contact_3496_id
    target_contact_id = contact_3410_id
  else
    stale_link = link_3410
    active_link = link_3496
    stale_contact_id = contact_3410_id
    target_contact_id = contact_3496_id
  end
else
  # If timestamps are missing, keep 3410 as target (has more links overall)
  stale_link = link_3496
  active_link = link_3410
  stale_contact_id = contact_3496_id
  target_contact_id = contact_3410_id
end

puts "Identified:"
puts "  ✅ Active: Contact #{target_contact_id} (Xero: #{active_link.external_contact_id})"
puts "  ❌ Stale:  Contact #{stale_contact_id} (Xero: #{stale_link.external_contact_id})"
puts ""

puts "-"*80
puts "STEP 1: Mark stale link as not_found"
puts "-"*80

stale_link.mark_stale!('not_found')
stale_link.update!(sync_error: "Duplicate contact - no longer exists in Xero")
puts "✅ Marked link #{stale_link.id} as stale"
puts ""

puts "-"*80
puts "STEP 2: Delete stale link"
puts "-"*80

stale_link.destroy!
puts "✅ Deleted stale link #{stale_link.id}"
puts ""

puts "-"*80
puts "STEP 3: Merge TEEEM contacts"
puts "-"*80

source_contact = Contact.find(stale_contact_id)
target_contact = Contact.find(target_contact_id)

puts "Merging:"
puts "  Source: #{source_contact.display_name} (##{source_contact.id})"
puts "  Target: #{target_contact.display_name} (##{target_contact.id})"
puts ""

# Transfer any remaining external links from source to target
remaining_links = source_contact.external_links
if remaining_links.any?
  puts "Transferring #{remaining_links.count} remaining external links..."
  remaining_links.each do |link|
    link.update!(contact_id: target_contact_id)
    puts "  ✅ Transferred link for tenant #{link.tenant_id}"
  end
end

# Delete source contact
source_contact.destroy!
puts "✅ Deleted source contact #{stale_contact_id}"
puts ""

puts "="*80
puts "SUCCESS - DUPLICATE RESOLVED"
puts "="*80
puts "Remaining ATO contact: #{target_contact.display_name} (##{target_contact.id})"
puts "Total Xero links: #{target_contact.external_links.count}"
puts ""
