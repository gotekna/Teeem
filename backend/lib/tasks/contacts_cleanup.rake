namespace :contacts do
  desc "Auto-classify NULL entity_type contacts (Option A)"
  task auto_classify: :environment do
    puts "Contact Entity Type Auto-Classification"
    puts "=" * 60

    # Find NULL entity_type contacts
    null_contacts = Contact.unscoped.where(entity_type: nil)
    puts "Total NULL contacts: #{null_contacts.count}"

    # Option A: Auto-classify obvious ones

    # 1. Classify as COMPANY (has company_name_or_trust)
    company_candidates = null_contacts.where.not(company_name_or_trust: [ nil, "" ])
    puts "\nClassifying #{company_candidates.count} as 'company' (have company_name_or_trust)..."
    company_count = company_candidates.update_all(entity_type: "company")
    puts "  ✓ Updated #{company_count} records"

    # 2. Classify as PERSON (has both first_name AND last_name)
    person_candidates = null_contacts.where(entity_type: nil) # Re-query after previous update
                                     .where.not(first_name: [ nil, "" ])
                                     .where.not(last_name: [ nil, "" ])
    puts "\nClassifying #{person_candidates.count} as 'person' (have first + last name)..."
    person_count = person_candidates.update_all(entity_type: "person")
    puts "  ✓ Updated #{person_count} records"

    # 3. Report remaining ambiguous
    remaining = Contact.unscoped.where(entity_type: nil).count
    puts "\n" + "=" * 60
    puts "SUMMARY:"
    puts "  Companies classified: #{company_count}"
    puts "  Persons classified:   #{person_count}"
    puts "  Total classified:     #{company_count + person_count}"
    puts "  Remaining NULL:       #{remaining}"
    puts "\n✓ Auto-classification complete!"
    puts "\nRemaining #{remaining} contacts need manual review"
    puts "(These likely have first_name only - ambiguous whether person or company)"
  end
end
