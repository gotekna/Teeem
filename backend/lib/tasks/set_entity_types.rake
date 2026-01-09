namespace :contacts do
  desc "Auto-set entity_type for contacts based on logic"
  task set_entity_types: :environment do
    puts "=" * 60
    puts "AUTO-SETTING ENTITY TYPES"
    puts "=" * 60
    puts

    # Find all contacts with no entity_type
    contacts = Contact.where(entity_type: [ nil, "" ]).order(:id)

    stats = {
      people_set: 0,
      companies_set: 0,
      unclear_skipped: 0
    }

    contacts.each do |c|
      name = c.full_name.to_s.strip

      # Company indicators
      has_abn = c.tax_number.present?
      has_acn = c.company_number.present?
      has_company_field = c.company_name_or_trust.present?

      # Person indicators
      has_first_last = c.first_name.present? && c.last_name.present?

      # Name pattern analysis
      words = name.split
      looks_like_person_name = false

      if words.count == 2
        looks_like_person_name = words[0][0] == words[0][0].upcase && words[1][0] == words[1][0].upcase
      elsif words.count >= 3
        all_title_case = words.all? { |w| w[0] == w[0].upcase }
        looks_like_person_name = all_title_case && words.none? { |w| w.downcase == "pty" || w.downcase == "ltd" }
      end

      # Decide and update
      if has_first_last || (looks_like_person_name && !has_abn && !has_acn && !has_company_field)
        c.update_column(:entity_type, "person")
        stats[:people_set] += 1
      elsif has_abn || has_acn || has_company_field || name.match?(/pty|ltd|limited|group|services|solutions|constructions|installations/i)
        c.update_column(:entity_type, "company")
        stats[:companies_set] += 1
      else
        stats[:unclear_skipped] += 1
      end
    end

    puts
    puts "=" * 60
    puts "UPDATE COMPLETE"
    puts "=" * 60
    puts "People set:        #{stats[:people_set]}"
    puts "Companies set:     #{stats[:companies_set]}"
    puts "Unclear skipped:   #{stats[:unclear_skipped]}"
    puts
  end
end
