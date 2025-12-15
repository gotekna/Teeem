class FindMissingAbnsJob < ApplicationJob
  queue_as :default

  def perform
    # Focus on companies and trusts without ABNs
    contacts_without_abn = Contact.where(tax_number: [ nil, "" ])
                                 .where(entity_type: [ 'company', 'trust' ])
                                 .where.not(display_name: [ nil, "" ])

    total = contacts_without_abn.count
    Rails.logger.info "Finding missing ABNs for #{total} companies/trusts..."

    found = 0
    not_found = 0
    multiple_matches = 0
    errors = 0

    service = AbrApiService.new

    contacts_without_abn.find_each.with_index do |contact, index|
      begin
        results = service.search_by_name(contact.display_name)

        if results.empty?
          not_found += 1
          Rails.logger.info "#{index + 1}/#{total}: #{contact.display_name} - NOT FOUND"
        elsif results.length == 1
          # Single match - auto-populate
          match = results.first
          contact.update_columns(tax_number: match[:abn])
          found += 1
          Rails.logger.info "#{index + 1}/#{total}: #{contact.display_name} - FOUND: #{match[:abn_formatted]}"

          # Auto-verify the new ABN
          sleep(0.5)
          contact.verify_abn! rescue nil
        else
          # Multiple matches - auto-select best match (highest score)
          best_match = results.first
          contact.update_columns(tax_number: best_match[:abn])
          multiple_matches += 1
          found += 1
          Rails.logger.info "#{index + 1}/#{total}: #{contact.display_name} - BEST MATCH: #{best_match[:abn_formatted]} (#{results.length} options)"
          results.first(3).each { |m| Rails.logger.info "  - #{m[:abn_formatted]}: #{m[:name]} (score: #{m[:score]})" }

          # Auto-verify the new ABN
          sleep(0.5)
          contact.verify_abn! rescue nil
        end
      rescue => e
        errors += 1
        Rails.logger.error "#{index + 1}/#{total}: #{contact.display_name} - ERROR: #{e.message}"
      end

      # Rate limiting
      sleep(0.5)
    end

    Rails.logger.info "=== ABN Search Complete ==="
    Rails.logger.info "Found: #{found} (includes #{multiple_matches} with multiple matches)"
    Rails.logger.info "Not found: #{not_found}"
    Rails.logger.info "Errors: #{errors}"
    Rails.logger.info "Coverage: #{((found.to_f / total) * 100).round(1)}%"

    # Return summary for potential notification
    {
      found: found,
      not_found: not_found,
      multiple_matches: multiple_matches,
      errors: errors
    }
  end
end
