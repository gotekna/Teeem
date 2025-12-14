# frozen_string_literal: true

namespace :contacts do
  desc "Backfill employees_count from ContactRelationship SSoT"
  task backfill_employees_count: :environment do
    puts "Backfilling employees_count from ContactRelationship..."

    # Find all companies/trusts/sole_traders that could have employees
    companies = Contact.where(entity_type: %w[company trust sole_trader])
    total = companies.count
    updated = 0
    mismatched = 0

    puts "Found #{total} company/trust/sole_trader contacts to check"

    companies.find_each.with_index do |company, index|
      # Count from SSoT (active employee_of relationships)
      correct_count = ContactRelationship.where(
        related_contact_id: company.id,
        relationship_type: "employee_of",
        is_active: true
      ).count

      current_count = company.employees_count || 0

      if current_count != correct_count
        company.update_column(:employees_count, correct_count)
        mismatched += 1
        puts "  Fixed Contact ##{company.id} (#{company.display_name}): #{current_count} → #{correct_count}"
      end

      updated += 1
      print "\r  Progress: #{updated}/#{total} (#{mismatched} fixed)" if (index % 100).zero?
    end

    puts "\n\nDone! Checked #{total} contacts, fixed #{mismatched} mismatched counts."
  end
end
