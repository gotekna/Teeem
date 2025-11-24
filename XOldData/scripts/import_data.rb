# Quick import script - paste this into Heroku Rails console
require 'csv'

puts "=" * 80
puts "IMPORTING CONTACTS..."
puts "=" * 80

imported_contacts = 0
CSV.foreach('easybuildapp development Contacts.csv', headers: true) do |row|
  next if row['full_name'].blank? && row['email'].blank?
  next if Contact.exists?(full_name: row['full_name'])

  Contact.create!(
    full_name: row['full_name'],
    first_name: row['first_name'],
    last_name: row['last_name'],
    email: row['email'],
    mobile_phone: row['mobile_phone'],
    office_phone: row['office_phone'],
    website: row['website'],
    tax_number: row['tax_number'],
    xero_id: row['xero_id']
  )
  imported_contacts += 1
  print '.' if imported_contacts % 50 == 0
end

puts "\n✓ Imported #{imported_contacts} contacts"
puts "Total contacts: #{Contact.count}"

puts "\n" + "=" * 80
puts "CREATING SUPPLIERS FROM PRICE BOOK..."
puts "=" * 80

created_suppliers = 0
CSV.foreach('pricebook_cleaned.csv', headers: true) do |row|
  name = row['supplier_name']&.strip
  next if name.blank?

  supplier = Supplier.find_or_initialize_by(name: name)
  if supplier.new_record?
    supplier.original_name = name
    supplier.save!
    created_suppliers += 1
    print '.' if created_suppliers % 10 == 0
  end
end

puts "\n✓ Created #{created_suppliers} suppliers"
puts "Total suppliers: #{Supplier.count}"

puts "\n" + "=" * 80
puts "RUNNING AUTO-MATCHING..."
puts "=" * 80

matcher = SupplierMatcher.new

puts "\nPass 1: High confidence (>= 0.95)..."
high = matcher.auto_apply_matches(threshold: 0.95, verify_exact: true)
puts "✓ Matched #{high} suppliers with high confidence"

puts "\nPass 2: Fuzzy matches (>= 0.7)..."
fuzzy = matcher.auto_apply_matches(threshold: 0.7, verify_exact: false)
puts "✓ Matched #{fuzzy} suppliers with fuzzy confidence"

puts "\n" + "=" * 80
puts "RESULTS"
puts "=" * 80

total = Supplier.count
matched = Supplier.matched.count
verified = Supplier.verified.count
needs_review = Supplier.needs_review.count
unmatched = Supplier.unmatched.count

puts "\nTotal Suppliers: #{total}"
puts "  ✓ Matched & Verified: #{verified}"
puts "  ? Needs Review: #{needs_review}"
puts "  ✗ Unmatched: #{unmatched}"
puts "\nMatch Rate: #{(matched.to_f / total * 100).round(1)}%"

if needs_review > 0
  puts "\nExamples needing review:"
  Supplier.needs_review.by_match_confidence.limit(5).each do |s|
    puts "  #{s.name} → #{s.contact.full_name} (#{(s.confidence_score * 100).round(1)}%)"
  end
end

if unmatched > 0
  puts "\nExamples of unmatched:"
  Supplier.unmatched.limit(5).each { |s| puts "  #{s.name}" }
end

puts "\n✓ Complete!"
