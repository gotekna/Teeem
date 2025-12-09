# Rake task to sync display_name column for all contacts
# SSoT: display_name should match:
#   - person/sole_trader: first_name + middle_name + last_name
#   - company/trust: company_name_or_trust
#   - price_only: display_name (no change needed)

namespace :contacts do
  desc "Sync display_name from source fields (first/last name for person, company_name_or_trust for company/trust)"
  task sync_display_names: :environment do
    puts "Syncing display_name for all contacts..."

    updated_count = 0
    error_count = 0

    Contact.unscoped.find_each do |contact|
      begin
        old_display_name = contact.display_name
        new_display_name = nil

        case contact.entity_type
        when "person", "sole_trader"
          # Construct from first + middle + last name
          name_parts = [ contact.first_name, contact.middle_name, contact.last_name ].map(&:presence).compact
          new_display_name = name_parts.join(" ") if name_parts.any?
        when "company", "trust"
          # Use company_name_or_trust
          new_display_name = contact.company_name_or_trust if contact.company_name_or_trust.present?
        when "price_only"
          # Already correct, no change needed (but ensure uppercase)
          if contact.display_name.present? && contact.display_name != contact.display_name.upcase
            new_display_name = contact.display_name.upcase
          end
        end

        # Update if different
        if new_display_name.present? && new_display_name != old_display_name
          contact.update_column(:display_name, new_display_name)
          puts "  Updated ##{contact.id}: '#{old_display_name}' -> '#{new_display_name}'"
          updated_count += 1
        end
      rescue => e
        puts "  ERROR on ##{contact.id}: #{e.message}"
        error_count += 1
      end
    end

    puts "\nDone!"
    puts "  Updated: #{updated_count}"
    puts "  Errors: #{error_count}"
  end
end
