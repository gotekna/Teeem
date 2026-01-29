namespace :xero do
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
end
