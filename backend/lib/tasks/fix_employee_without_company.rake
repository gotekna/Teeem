# frozen_string_literal: true

# FRC: Contacts with Employee role should have a company link (primary_company_id or employee_of relationship)
# This rake task finds and fixes orphaned employee roles

namespace :contacts do
  desc "Find and report contacts with Employee role but no company link"
  task employee_without_company_report: :environment do
    puts "Finding employees without company link..."
    puts "=" * 60

    # Find contacts with Employee role but no company
    contacts_with_active_employment = ContactRelationship
      .where(relationship_type: "employee_of", is_active: true)
      .select(:source_contact_id)

    # Note: roles is TEXT storing JSON array like '["Employee"]', so use LIKE pattern
    orphaned = Contact.unscoped
      .where("roles LIKE ?", '%"Employee"%')
      .where(primary_company_id: nil)
      .where.not(id: contacts_with_active_employment)

    count = orphaned.count
    puts "Found #{count} contacts with Employee role but no company"
    puts

    if count > 0
      puts "ID | Display Name | Entity Type | Roles"
      puts "-" * 60
      orphaned.limit(50).each do |c|
        puts "#{c.id} | #{c.display_name} | #{c.entity_type} | #{c.roles&.join(', ')}"
      end
      puts "... and #{count - 50} more" if count > 50
    end

    puts
    puts "Run 'rake contacts:fix_employee_without_company' to remove Employee role from these contacts"
  end

  desc "Remove Employee role from contacts without company link"
  task fix_employee_without_company: :environment do
    puts "Fixing employees without company link..."
    puts "=" * 60

    # Find contacts with Employee role but no company
    contacts_with_active_employment = ContactRelationship
      .where(relationship_type: "employee_of", is_active: true)
      .select(:source_contact_id)

    # Note: roles is TEXT storing JSON array like '["Employee"]', so use LIKE pattern
    orphaned = Contact.unscoped
      .where("roles LIKE ?", '%"Employee"%')
      .where(primary_company_id: nil)
      .where.not(id: contacts_with_active_employment)

    count = orphaned.count
    puts "Found #{count} contacts to fix"
    puts

    fixed_count = 0
    error_count = 0

    orphaned.find_each do |contact|
      # Parse JSON string to array (roles is TEXT storing JSON like '["Employee"]')
      old_roles = contact.roles.is_a?(String) ? (JSON.parse(contact.roles) rescue []) : (contact.roles || [])
      next unless old_roles.include?("Employee")

      new_roles = old_roles - [ "Employee" ]

      begin
        contact.update_columns(roles: new_roles.to_json)
        fixed_count += 1
        puts "Fixed: #{contact.id} - #{contact.display_name} - roles: #{old_roles.join(',')} -> #{new_roles.join(',')}"
      rescue => e
        error_count += 1
        puts "Error fixing #{contact.id}: #{e.message}"
      end
    end

    puts
    puts "=" * 60
    puts "SUMMARY:"
    puts "  Fixed: #{fixed_count}"
    puts "  Errors: #{error_count}"
    puts "Done!"
  end
end
