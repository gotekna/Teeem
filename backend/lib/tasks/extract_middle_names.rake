namespace :contacts do
  desc "Extract middle names from last_name field for person contacts"
  task extract_middle_names: :environment do
    puts "=" * 60
    puts "MIDDLE NAME EXTRACTION"
    puts "=" * 60
    puts

    # Find person contacts with spaces in last_name
    contacts = Contact.where("last_name LIKE ?", "% %")
                      .where(entity_type: "person")
                      .order(:id)

    puts "Found #{contacts.count} person contacts with spaces in last_name"
    puts

    stats = {
      middle_names_extracted: 0,
      changed_to_company: 0,
      skipped: 0,
      errors: 0
    }

    # Indicators that this might be a business, not a person
    BUSINESS_INDICATORS = [
      /\b(building|centre|center|services?|solutions?|systems?)\b/i,
      /\b(plumbing|electrical|tiling|flooring|landscaping)\b/i,
      /\b(council|department|team|office|admin)\b/i,
      /\b(concrete|steel|timber|hire|transport)\b/i,
      /\b(design|contract|trade|supply)\b/i,
      /\&/  # "Smith & Jones" style business names
    ].freeze

    contacts.find_each do |contact|
      begin
        last_name = contact.last_name.to_s.strip
        first_name = contact.first_name.to_s.strip

        next if last_name.blank?

        # Check if this looks like a business name
        is_likely_business = BUSINESS_INDICATORS.any? { |pattern|
          "#{first_name} #{last_name}".match?(pattern)
        }

        if is_likely_business
          puts "⚠️  BUSINESS? [#{contact.id}] #{first_name} #{last_name}"
          puts "   → Likely a business, not a person. Consider changing to entity_type='company'"
          stats[:skipped] += 1
          next
        end

        # Split last_name into middle + last
        parts = last_name.split(/\s+/)

        if parts.length == 2
          # Simple case: "Middle Last"
          middle_name = parts[0]
          new_last_name = parts[1]

          contact.middle_name = middle_name
          contact.last_name = new_last_name
          contact.full_name = [ first_name, middle_name, new_last_name ].compact.join(" ")
          contact.save!

          puts "✓ [#{contact.id}] #{first_name} #{last_name}"
          puts "  → Split: first='#{first_name}' middle='#{middle_name}' last='#{new_last_name}'"
          stats[:middle_names_extracted] += 1

        elsif parts.length > 2
          # Complex case: "Middle1 Middle2 Last" or "van de Last"
          middle_name = parts[0..-2].join(" ")
          new_last_name = parts[-1]

          contact.middle_name = middle_name
          contact.last_name = new_last_name
          contact.full_name = [ first_name, middle_name, new_last_name ].compact.join(" ")
          contact.save!

          puts "✓ [#{contact.id}] #{first_name} #{last_name}"
          puts "  → Split: first='#{first_name}' middle='#{middle_name}' last='#{new_last_name}'"
          stats[:middle_names_extracted] += 1
        end

      rescue => e
        stats[:errors] += 1
        puts "✗ ERROR [#{contact.id}] #{e.message}"
      end
    end

    puts
    puts "=" * 60
    puts "EXTRACTION COMPLETE"
    puts "=" * 60
    puts "Middle names extracted: #{stats[:middle_names_extracted]}"
    puts "Skipped (likely business): #{stats[:skipped]}"
    puts "Errors: #{stats[:errors]}"
    puts
  end

  desc "Preview middle name extraction"
  task preview_middle_names: :environment do
    contacts = Contact.where("last_name LIKE ?", "% %")
                      .where(entity_type: "person")
                      .limit(30)

    puts "PREVIEW: What would change"
    puts

    BUSINESS_INDICATORS = [
      /\b(building|centre|center|services?|solutions?|systems?)\b/i,
      /\b(plumbing|electrical|tiling|flooring|landscaping)\b/i,
      /\b(council|department|team|office|admin)\b/i,
      /\b(concrete|steel|timber|hire|transport)\b/i,
      /\b(design|contract|trade|supply)\b/i,
      /\&/
    ].freeze

    contacts.each do |c|
      full_name = "#{c.first_name} #{c.last_name}"
      is_business = BUSINESS_INDICATORS.any? { |p| full_name.match?(p) }

      if is_business
        puts "⚠️  [#{c.id}] #{full_name}"
        puts "   → SKIP (likely business)"
      else
        parts = c.last_name.to_s.split(/\s+/)
        if parts.length >= 2
          middle = parts.length == 2 ? parts[0] : parts[0..-2].join(" ")
          last = parts[-1]
          puts "✓ [#{c.id}] #{c.first_name} #{c.last_name}"
          puts "  → Would become: first='#{c.first_name}' middle='#{middle}' last='#{last}'"
        end
      end
      puts
    end
  end

  desc "Fix specific contact with middle name (e.g., rails contacts:fix_middle_name[2184])"
  task :fix_middle_name, [ :contact_id ] => :environment do |t, args|
    contact = Contact.find(args[:contact_id])

    puts "Current: #{contact.first_name} #{contact.last_name}"

    if contact.last_name.to_s.include?(" ")
      parts = contact.last_name.split(/\s+/)
      middle = parts.length == 2 ? parts[0] : parts[0..-2].join(" ")
      last = parts[-1]

      contact.middle_name = middle
      contact.last_name = last
      contact.full_name = [ contact.first_name, middle, last ].join(" ")
      contact.save!

      puts "✓ Fixed: #{contact.first_name} #{contact.middle_name} #{contact.last_name}"
    else
      puts "⚠️  No spaces in last_name - nothing to split"
    end
  end
end
