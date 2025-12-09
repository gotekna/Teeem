namespace :contacts do
  desc "Fix sole_trader entity types - convert those with companies to 'person'"
  task fix_sole_trader_entity_types: :environment do
    puts "=" * 60
    puts "FIXING SOLE_TRADER ENTITY TYPES"
    puts "=" * 60
    puts

    sole_traders = Contact.where(entity_type: "sole_trader").order(:id)
    puts "Found #{sole_traders.count} sole_trader contacts"
    puts

    stats = {
      converted_to_person: 0,
      left_as_sole_trader: 0
    }

    sole_traders.each do |contact|
      if contact.primary_company_id.present?
        # Has a company linked - should be 'person' not 'sole_trader'
        company = Contact.find_by(id: contact.primary_company_id)
        contact.update_column(:entity_type, "person")
        puts "✓ [#{contact.id}] #{contact.full_name} → 'person' (works for #{company&.full_name})"
        stats[:converted_to_person] += 1
      else
        # No company - might be legitimate sole trader
        puts "ℹ️  [#{contact.id}] #{contact.full_name} → left as 'sole_trader' (no company linked)"
        stats[:left_as_sole_trader] += 1
      end
    end

    puts
    puts "=" * 60
    puts "COMPLETE"
    puts "=" * 60
    puts "Converted to 'person':     #{stats[:converted_to_person]}"
    puts "Left as 'sole_trader':     #{stats[:left_as_sole_trader]}"
    puts
  end
end
