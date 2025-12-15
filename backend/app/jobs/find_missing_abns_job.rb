class FindMissingAbnsJob < ApplicationJob
  queue_as :default

  def perform
    # Get contacts without ABNs (excluding individuals)
    contacts_without_abn = Contact.where(tax_number: [ nil, "" ])
                                 .where.not(display_name: [ nil, "" ])

    total = contacts_without_abn.count
    Rails.logger.info "Finding missing ABNs for #{total} contacts..."

    found = 0
    not_found = 0
    multiple_matches = 0
    skipped = 0
    errors = 0

    service = AbrApiService.new

    contacts_without_abn.find_each.with_index do |contact, index|
      # Skip if display_name looks like a person's name
      if contact.display_name.match?(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
        skipped += 1
        Rails.logger.info "#{index + 1}/#{total}: #{contact.display_name} - SKIPPED (individual)"
        next
      end

      begin
        results = service.search_by_name(contact.display_name)

        if results.empty?
          not_found += 1
          Rails.logger.info "#{index + 1}/#{total}: #{contact.display_name} - NOT FOUND"
        elsif results.length == 1
          # Single match - high confidence
          match = results.first
          contact.update!(tax_number: match[:abn])
          found += 1
          Rails.logger.info "#{index + 1}/#{total}: #{contact.display_name} - FOUND: #{match[:abn_formatted]}"

          # Auto-verify the new ABN
          sleep(0.5)
          contact.verify_abn! rescue nil
        else
          # Multiple matches - log for manual review
          multiple_matches += 1
          Rails.logger.info "#{index + 1}/#{total}: #{contact.display_name} - MULTIPLE (#{results.length})"
          results.first(3).each { |m| Rails.logger.info "  - #{m[:abn_formatted]}: #{m[:name]}" }
        end
      rescue => e
        errors += 1
        Rails.logger.error "#{index + 1}/#{total}: #{contact.display_name} - ERROR: #{e.message}"
      end

      # Rate limiting
      sleep(0.5)
    end

    Rails.logger.info "=== ABN Search Complete ==="
    Rails.logger.info "Found: #{found}"
    Rails.logger.info "Not found: #{not_found}"
    Rails.logger.info "Multiple matches: #{multiple_matches}"
    Rails.logger.info "Skipped: #{skipped}"
    Rails.logger.info "Errors: #{errors}"

    # Return summary for potential notification
    {
      found: found,
      not_found: not_found,
      multiple_matches: multiple_matches,
      skipped: skipped,
      errors: errors
    }
  end
end
