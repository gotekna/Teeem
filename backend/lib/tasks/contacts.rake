namespace :contacts do
  desc "Fix company contacts - set entity_type and company_name_or_trust, clear first_name/last_name"
  task fix_companies: :environment do
    # Use same patterns as XeroContactSyncService
    company_patterns = XeroContactSyncService::COMPANY_INDICATORS

    def is_company?(name, patterns)
      return false if name.blank?
      patterns.any? { |pattern| name.match?(pattern) }
    end

    fixed = 0
    errors = []

    Contact.find_each do |c|
      next unless is_company?(c.full_name, company_patterns)
      next if c.entity_type == 'company' # Already correct

      begin
        updates = { entity_type: 'company' }

        # Set company_name_or_trust if blank
        updates[:company_name_or_trust] = c.full_name if c.company_name_or_trust.blank?

        # If first_name has company name (indicating it was incorrectly set), clear it
        if c.first_name.present? && is_company?(c.first_name, company_patterns)
          updates[:first_name] = nil
          updates[:last_name] = nil
        end

        c.update_columns(updates)
        fixed += 1
        puts "Fixed: #{c.id} - #{c.full_name}" if fixed <= 20
      rescue => e
        errors << "#{c.id}: #{e.message}"
      end
    end

    puts "..." if fixed > 20
    puts "=" * 50
    puts "Total fixed: #{fixed}"
    puts "Errors: #{errors.count}"
    errors.first(5).each { |e| puts "  - #{e}" } if errors.any?
  end

  desc "Show contacts with company indicators that are not entity_type=company"
  task check_companies: :environment do
    company_patterns = XeroContactSyncService::COMPANY_INDICATORS

    mismatched = Contact.where.not(entity_type: 'company').select do |c|
      company_patterns.any? { |p| c.full_name.to_s.match?(p) }
    end

    puts "Contacts with company indicators but not entity_type='company': #{mismatched.count}"
    mismatched.first(20).each do |c|
      puts "  #{c.id}: #{c.full_name} - entity: #{c.entity_type}, first: #{c.first_name.inspect}"
    end
    puts "  ..." if mismatched.count > 20

    puts "\nEntity type distribution:"
    puts "  Company: #{Contact.where(entity_type: 'company').count}"
    puts "  Person:  #{Contact.where(entity_type: 'person').count}"
    puts "  Nil:     #{Contact.where(entity_type: nil).count}"
  end
end
