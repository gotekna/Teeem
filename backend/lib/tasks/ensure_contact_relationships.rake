# frozen_string_literal: true

# SSoT: Ensure all contacts with primary_company_id have corresponding employee_of relationships
# This rake task is part of the deprecation plan for primary_company_id column
# Run this task to backfill any missing relationships before fully deprecating the column

namespace :contacts do
  desc "Ensure all contacts with primary_company_id have matching employee_of relationships"
  task ensure_employment_relationships: :environment do
    puts "=" * 60
    puts "SSoT: Ensuring employee_of relationships exist for all primary_company_id values"
    puts "=" * 60

    # Find contacts with primary_company_id but no matching employee_of relationship
    orphaned_count = 0
    created_count = 0
    errors = []

    # Only check person/sole_trader entities (companies/trusts shouldn't have employment relationships)
    Contact.where.not(primary_company_id: nil)
           .where(entity_type: %w[person sole_trader])
           .find_each do |contact|
      # Check if employee_of relationship exists
      existing = ContactRelationship.find_by(
        source_contact_id: contact.id,
        related_contact_id: contact.primary_company_id,
        relationship_type: "employee_of"
      )

      next if existing&.is_active?

      orphaned_count += 1
      puts "\nFound orphaned primary_company_id:"
      puts "  Contact: ##{contact.id} - #{contact.display_name}"
      puts "  Primary Company ID: #{contact.primary_company_id}"

      begin
        if existing
          # Reactivate existing relationship
          existing.update!(is_active: true, start_date: Date.today)
          puts "  Action: Reactivated existing relationship"
        else
          # Create new relationship
          ContactRelationship.create!(
            source_contact_id: contact.id,
            related_contact_id: contact.primary_company_id,
            relationship_type: "employee_of",
            is_active: true,
            start_date: Date.today
          )
          puts "  Action: Created new employee_of relationship"
        end
        created_count += 1
      rescue StandardError => e
        errors << { contact_id: contact.id, error: e.message }
        puts "  ERROR: #{e.message}"
      end
    end

    puts "\n" + "=" * 60
    puts "Summary:"
    puts "  Orphaned records found: #{orphaned_count}"
    puts "  Relationships created/activated: #{created_count}"
    puts "  Errors: #{errors.count}"
    puts "=" * 60

    if errors.any?
      puts "\nErrors encountered:"
      errors.each do |err|
        puts "  Contact ##{err[:contact_id]}: #{err[:error]}"
      end
    end
  end

  desc "Audit primary_company_id vs employee_of relationships for discrepancies"
  task audit_employment_ssot: :environment do
    puts "=" * 60
    puts "SSoT Audit: primary_company_id vs employee_of relationships"
    puts "=" * 60

    issues = []

    # Check 1: Contacts with primary_company_id but no active employee_of relationship
    Contact.where.not(primary_company_id: nil)
           .where(entity_type: %w[person sole_trader])
           .find_each do |contact|
      has_relationship = ContactRelationship.exists?(
        source_contact_id: contact.id,
        related_contact_id: contact.primary_company_id,
        relationship_type: "employee_of",
        is_active: true
      )

      unless has_relationship
        issues << {
          type: "missing_relationship",
          contact_id: contact.id,
          contact_name: contact.display_name,
          primary_company_id: contact.primary_company_id
        }
      end
    end

    # Check 2: Active employee_of relationships where primary_company_id doesn't match
    ContactRelationship.where(relationship_type: "employee_of", is_active: true)
                       .includes(:source_contact)
                       .find_each do |rel|
      contact = rel.source_contact
      next unless contact

      # If contact has a primary_company_id, it should match this relationship
      if contact.primary_company_id.present? && contact.primary_company_id != rel.related_contact_id
        issues << {
          type: "mismatch",
          contact_id: contact.id,
          contact_name: contact.display_name,
          primary_company_id: contact.primary_company_id,
          relationship_company_id: rel.related_contact_id
        }
      end
    end

    puts "\nAudit Results:"
    puts "  Total issues found: #{issues.count}"

    if issues.any?
      puts "\nMissing Relationships:"
      issues.select { |i| i[:type] == "missing_relationship" }.each do |issue|
        puts "  Contact ##{issue[:contact_id]} (#{issue[:contact_name]})"
        puts "    primary_company_id: #{issue[:primary_company_id]} has no employee_of relationship"
      end

      puts "\nMismatches:"
      issues.select { |i| i[:type] == "mismatch" }.each do |issue|
        puts "  Contact ##{issue[:contact_id]} (#{issue[:contact_name]})"
        puts "    primary_company_id: #{issue[:primary_company_id]}"
        puts "    relationship points to: #{issue[:relationship_company_id]}"
      end
    else
      puts "\n  No issues found! SSoT is in sync."
    end

    puts "=" * 60
  end
end
