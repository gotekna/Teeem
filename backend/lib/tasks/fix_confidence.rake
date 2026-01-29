namespace :xero do
  desc "Recalculate match_confidence for ALL Xero contact links (fix stale values)"
  task recalculate_all_confidence: :environment do
    puts "=" * 80
    puts "Recalculating Match Confidence for ALL Xero Contact Links"
    puts "=" * 80
    puts ""

    links = ContactExternalLink.where(source: 'xero').includes(:contact)
    total = links.count
    fixed = 0
    unchanged = 0
    skipped = 0

    links.find_each.with_index do |link, index|
      unless link.contact && link.external_name.present? && link.contact.display_name.present?
        skipped += 1
        next
      end

      old_confidence = link.match_confidence || 0
      new_confidence = link.send(:calculate_match_confidence)
      diff = (new_confidence - old_confidence).abs

      if diff > 0.01
        link.update_column(:match_confidence, new_confidence)
        fixed += 1

        # Only log significant changes
        if diff > 0.1
          puts "#{link.contact.display_name}"
          puts "  vs Xero: #{link.external_name}"
          puts "  #{(old_confidence * 100).round(1)}% → #{(new_confidence * 100).round(1)}%"
          puts ""
        end
      else
        unchanged += 1
      end

      # Progress indicator
      if (index + 1) % 100 == 0
        puts "... processed #{index + 1}/#{total}"
      end
    end

    puts ""
    puts "=" * 80
    puts "Summary:"
    puts "  Total links: #{total}"
    puts "  Fixed: #{fixed}"
    puts "  Unchanged: #{unchanged}"
    puts "  Skipped (missing data): #{skipped}"
    puts "=" * 80
  end

  desc "Fix incorrect confidence scores on pending review links"
  task fix_confidence: :environment do
    service = XeroContactSyncService.new(tenant_id: "audit")
    fixed = 0

    ContactExternalLink.xero.pending_review.find_each do |link|
      next unless link.external_name.present? && link.contact.present?

      actual_score = service.send(:calculate_name_similarity,
        link.external_name.downcase,
        link.contact.display_name.downcase
      )

      if link.match_confidence && (link.match_confidence - actual_score).abs > 0.01
        old_conf = (link.match_confidence * 100).round
        new_conf = (actual_score * 100).round
        puts "#{link.external_name} -> #{link.contact.display_name}: #{old_conf}% -> #{new_conf}%"
        link.update!(match_confidence: actual_score)
        fixed += 1
      end
    end

    puts ""
    puts "Fixed #{fixed} links with incorrect confidence"
  end

  desc "Auto-approve pending review links with 95%+ confidence"
  task auto_approve_high_confidence: :environment do
    approved = 0

    ContactExternalLink.xero.pending_review.where("match_confidence >= 0.95").find_each do |link|
      next unless link.contact.present?

      puts "Auto-approving: #{link.external_name} -> #{link.contact.display_name} (#{(link.match_confidence * 100).round}%)"
      link.update!(needs_review: false)
      approved += 1
    end

    puts ""
    puts "Auto-approved #{approved} high-confidence links"
  end
end
