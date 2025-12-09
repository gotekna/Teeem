namespace :xero do
  desc "Validate all contacts for Xero sync compatibility"
  task validate_contacts: :environment do
    puts "=" * 80
    puts "XERO CONTACT VALIDATION REPORT"
    puts "=" * 80
    puts ""

    # Get all contacts that should potentially sync to Xero
    all_contacts = Contact.all.to_a
    total_contacts = all_contacts.count

    puts "Total contacts in database: #{total_contacts}"
    puts ""

    # Initialize counters
    valid_count = 0
    invalid_count = 0
    skipped_count = 0
    validation_errors_by_field = Hash.new(0)

    # Get sync config for validation rules
    sync_configs = SyncConfiguration.all.to_a
    if sync_configs.empty?
      puts "⚠️  No sync configurations found. Creating default config for validation..."
      sync_config = SyncConfiguration.create!(
        xero_tenant_id: "validation-only",
        xero_tenant_name: "Validation",
        sync_enabled: false
      )
    else
      sync_config = sync_configs.first
    end

    puts "Sync Rules:"
    puts "  - Skip employees: #{sync_config.skip_sync_employees?}"
    puts "  - Skip suppliers: #{sync_config.skip_sync_default_suppliers?}"
    puts ""

    # Group errors for reporting
    invalid_contacts = []

    # Validate each contact
    all_contacts.each do |contact|
      validator = XeroContactValidator.new(contact)

      # Check if contact should be synced based on business rules
      if !sync_config.should_sync_contact?(contact)
        skipped_count += 1
        next
      end

      # Validate contact data
      if validator.valid?
        valid_count += 1
      else
        invalid_count += 1
        invalid_contacts << {
          id: contact.id,
          name: contact.display_name,
          entity_type: contact.entity_type,
          errors: validator.errors
        }

        # Count errors by field
        validator.errors.each do |error|
          validation_errors_by_field[error[:field]] += 1
        end
      end
    end

    # Print summary
    puts "=" * 80
    puts "SUMMARY"
    puts "=" * 80
    puts ""
    puts "✅ Valid contacts:     #{valid_count} (#{(valid_count.to_f / total_contacts * 100).round(1)}%)"
    puts "❌ Invalid contacts:   #{invalid_count} (#{(invalid_count.to_f / total_contacts * 100).round(1)}%)"
    puts "⏭️  Skipped by rules:  #{skipped_count} (#{(skipped_count.to_f / total_contacts * 100).round(1)}%)"
    puts ""

    # Print errors by field
    if validation_errors_by_field.any?
      puts "=" * 80
      puts "VALIDATION ERRORS BY FIELD"
      puts "=" * 80
      puts ""
      validation_errors_by_field.sort_by { |_, count| -count }.each do |field, count|
        puts "  #{field}: #{count} contacts"
      end
      puts ""
    end

    # Print detailed errors for invalid contacts (limit to first 20)
    if invalid_contacts.any?
      puts "=" * 80
      puts "INVALID CONTACTS (showing first 20)"
      puts "=" * 80
      puts ""

      invalid_contacts.first(20).each do |invalid|
        puts "Contact ID: #{invalid[:id]}"
        puts "Name: #{invalid[:name]}"
        puts "Entity Type: #{invalid[:entity_type]}"
        puts "Errors:"
        invalid[:errors].each do |error|
          puts "  - [#{error[:field]}] #{error[:message]}"
        end
        puts ""
      end

      if invalid_contacts.count > 20
        puts "... and #{invalid_contacts.count - 20} more invalid contacts"
        puts ""
      end

      # Offer to export full report to CSV
      puts "=" * 80
      puts "EXPORT FULL REPORT"
      puts "=" * 80
      puts ""
      puts "To export a full CSV report of all invalid contacts, run:"
      puts "  rails xero:export_validation_report"
      puts ""
    end

    puts "=" * 80
    puts "RECOMMENDATIONS"
    puts "=" * 80
    puts ""

    if invalid_count > 0
      puts "⚠️  You have #{invalid_count} contacts with validation errors."
      puts ""
      puts "To fix these issues:"
      puts "  1. Review the error messages above"
      puts "  2. Update the contacts in TEEEM to fix the validation errors"
      puts "  3. Run this validation again to confirm fixes"
      puts "  4. Then run Xero sync to push changes"
      puts ""
    else
      puts "✅ All contacts that should sync to Xero are valid!"
      puts ""
    end
  end

  desc "Export full validation report to CSV"
  task export_validation_report: :environment do
    require "csv"

    # Get all contacts
    all_contacts = Contact.all.to_a

    # Get sync config
    sync_config = SyncConfiguration.first || SyncConfiguration.create!(
      xero_tenant_id: "validation-only",
      xero_tenant_name: "Validation",
      sync_enabled: false
    )

    # Prepare CSV
    timestamp = Time.current.strftime("%Y%m%d_%H%M%S")
    filename = "tmp/xero_contact_validation_#{timestamp}.csv"

    CSV.open(filename, "w") do |csv|
      # Header
      csv << [ "Contact ID", "Name", "Entity Type", "Should Sync?", "Valid?", "Error Fields", "Error Messages" ]

      # Data
      all_contacts.each do |contact|
        validator = XeroContactValidator.new(contact)
        should_sync = sync_config.should_sync_contact?(contact)
        valid = validator.valid?

        error_fields = validator.errors.map { |e| e[:field] }.join("; ")
        error_messages = validator.errors.map { |e| e[:message] }.join("; ")

        csv << [
          contact.id,
          contact.display_name,
          contact.entity_type,
          should_sync ? "Yes" : "No (#{sync_config.skip_reason(contact)})",
          valid ? "Yes" : "No",
          error_fields,
          error_messages
        ]
      end
    end

    puts "✅ Validation report exported to: #{filename}"
    puts ""
    puts "You can open this file in Excel or Google Sheets to review all contacts."
  end

  desc "Fix common validation issues automatically"
  task fix_validation_issues: :environment do
    puts "=" * 80
    puts "FIXING COMMON VALIDATION ISSUES"
    puts "=" * 80
    puts ""

    fixed_count = 0
    contacts_updated = []

    Contact.find_each do |contact|
      validator = XeroContactValidator.new(contact)
      next if validator.valid?

      updates = {}

      # Fix 1: Generate full_name if blank but first/last name exists
      validator.errors.each do |error|
        case error[:field]
        when :name
          if contact.full_name.blank? && contact.first_name.present?
            updates[:full_name] = "#{contact.first_name} #{contact.last_name}".strip
          end
        when :entity_type
          if contact.entity_type.blank?
            # Guess entity type based on available data
            if contact.company_name_or_trust.present?
              updates[:entity_type] = "company"
            elsif contact.first_name.present?
              updates[:entity_type] = "person"
            end
          end
        end
      end

      if updates.any?
        contact.update!(updates)
        fixed_count += 1
        contacts_updated << {
          id: contact.id,
          name: contact.display_name,
          updates: updates
        }
      end
    end

    puts "✅ Fixed #{fixed_count} contacts"
    puts ""

    if contacts_updated.any?
      puts "Updated contacts:"
      contacts_updated.first(10).each do |updated|
        puts "  - #{updated[:name]} (ID: #{updated[:id]})"
        updated[:updates].each do |field, value|
          puts "    #{field}: #{value}"
        end
      end

      if contacts_updated.count > 10
        puts "  ... and #{contacts_updated.count - 10} more"
      end
    end

    puts ""
    puts "Run 'rails xero:validate_contacts' again to see remaining issues."
  end
end
