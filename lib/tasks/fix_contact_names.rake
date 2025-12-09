namespace :contacts do
  desc "Smart cleanup: Split names in first_name field based on entity type"
  task fix_names: :environment do
    puts "=" * 60
    puts "SMART CONTACT NAME CLEANUP"
    puts "=" * 60
    puts

    # Find contacts with spaces in first_name but null/empty last_name
    contacts = Contact.where("first_name LIKE ?", "% %")
                      .where("last_name IS NULL OR last_name = ''")

    puts "Found #{contacts.count} contacts to process"
    puts

    stats = {
      persons_split: 0,
      companies_moved: 0,
      entity_type_detected: 0,
      skipped: 0,
      errors: 0
    }

    # Company indicators for auto-detection
    COMPANY_INDICATORS = [
      /\bpty\.?\s*ltd\.?\b/i,
      /\bltd\.?\b/i,
      /\blimited\b/i,
      /\binc\.?\b/i,
      /\bcorp\.?\b/i,
      /\bllc\b/i,
      /\btrust\b/i,
      /\bgroup\b/i,
      /\bholdings\b/i,
      /\bco\.?\b/i,
      /\bcompany\b/i,
      /\bpartners\b/i,
      /\benterprises?\b/i,
      /\bsolutions?\b/i,
      /\bservices?\b/i
    ].freeze

    contacts.find_each do |contact|
      begin
        current_first_name = contact.first_name.to_s.strip
        next if current_first_name.blank?

        # Detect entity type ONLY if missing (trust existing entity_type)
        # SSoT: Valid entity_type values are: person, company, trust, sole_trader
        if contact.entity_type.nil? || contact.entity_type.blank?
          is_company = COMPANY_INDICATORS.any? { |pattern| current_first_name.match?(pattern) }
          contact.entity_type = is_company ? "company" : "person"
          stats[:entity_type_detected] += 1
          puts "  → Detected entity_type: #{contact.entity_type}"
        end

        # Trust the entity_type (either existing or newly detected)
        if contact.entity_type == "person"
          # PERSON: Split "FirstName LastName"
          parts = current_first_name.split(/\s+/, 2) # Split on first space only
          new_first_name = parts[0].to_s.strip
          new_last_name = parts[1].to_s.strip

          if new_first_name.present?
            contact.first_name = new_first_name
            contact.last_name = new_last_name if new_last_name.present?
            contact.full_name = "#{new_first_name} #{new_last_name}".strip
            contact.save!
            stats[:persons_split] += 1
            puts "✓ PERSON [#{contact.id}] Split: '#{current_first_name}' → first='#{new_first_name}' last='#{new_last_name}'"
          end

        elsif contact.entity_type.in?([ "company", "trust" ])
          # COMPANY: Move to full_name, clear first_name/last_name
          contact.full_name = current_first_name
          contact.first_name = nil
          contact.last_name = nil
          contact.company_name_or_trust = current_first_name
          contact.save!
          stats[:companies_moved] += 1
          puts "✓ COMPANY [#{contact.id}] Moved: '#{current_first_name}' → full_name"

        else
          stats[:skipped] += 1
          puts "⊘ SKIPPED [#{contact.id}] Unknown entity_type: #{contact.entity_type}"
        end

      rescue => e
        stats[:errors] += 1
        puts "✗ ERROR [#{contact.id}] #{e.message}"
      end
    end

    puts
    puts "=" * 60
    puts "CLEANUP COMPLETE"
    puts "=" * 60
    puts "Persons split:         #{stats[:persons_split]}"
    puts "Companies moved:       #{stats[:companies_moved]}"
    puts "Entity types detected: #{stats[:entity_type_detected]}"
    puts "Skipped:               #{stats[:skipped]}"
    puts "Errors:                #{stats[:errors]}"
    puts
  end

  desc "Preview name cleanup (dry run)"
  task preview_fix_names: :environment do
    contacts = Contact.where("first_name LIKE ?", "% %")
                      .where("last_name IS NULL OR last_name = ''")
                      .limit(20)

    puts "PREVIEW: First 20 contacts that would be changed:"
    puts

    COMPANY_INDICATORS = [
      /\bpty\.?\s*ltd\.?\b/i,
      /\bltd\.?\b/i,
      /\blimited\b/i,
      /\binc\.?\b/i,
      /\bcorp\.?\b/i,
      /\btrust\b/i,
      /\bgroup\b/i
    ].freeze

    contacts.each do |c|
      entity_type = c.entity_type || "NULL"

      # Only detect if entity_type is missing
      # SSoT: Valid entity_type values are: person, company, trust, sole_trader
      final_type = if entity_type == "NULL"
        is_company = COMPANY_INDICATORS.any? { |p| c.first_name.to_s.match?(p) }
        is_company ? "company" : "person"
      else
        entity_type
      end

      puts "ID #{c.id}: '#{c.first_name}'"
      puts "  Current entity_type: #{entity_type}"
      puts "  Will use type: #{final_type}"

      if final_type == "person"
        parts = c.first_name.to_s.split(/\s+/, 2)
        puts "  → Would split to: first='#{parts[0]}' last='#{parts[1]}'"
      else
        puts "  → Would move to: full_name='#{c.first_name}'"
      end
      puts
    end
  end
end
