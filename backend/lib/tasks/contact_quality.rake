# frozen_string_literal: true

namespace :contacts do
  namespace :quality do
    desc "Scan all contacts for quality issues and populate review queue"
    task scan: :environment do
      puts "=" * 80
      puts "CONTACT QUALITY SCAN"
      puts "=" * 80
      puts ""

      total_contacts = Contact.count
      issues_found = 0
      by_issue_type = Hash.new(0)

      puts "Scanning #{total_contacts} contacts..."
      puts ""

      # Clear stale pending reviews (older than 30 days)
      stale_count = ContactQualityReview.pending.where("created_at < ?", 30.days.ago).count
      ContactQualityReview.pending.where("created_at < ?", 30.days.ago).destroy_all
      puts "Cleared #{stale_count} stale pending reviews" if stale_count > 0

      Contact.find_each.with_index do |contact, index|
        print "\rProcessing #{index + 1}/#{total_contacts}..." if (index + 1) % 100 == 0

        begin
          service = ContactDataQualityService.new(contact)
          analysis = service.analyze

          if analysis[:recommended_action] != :no_action && analysis[:issues].any?
            issue_type = analysis[:issues].first[:type] || "unknown"

            review = ContactQualityReview.find_or_initialize_by(
              contact: contact,
              issue_type: issue_type
            )

            # Only create/update if pending or new
            if review.new_record? || review.status == "pending"
              review.assign_attributes(
                suggested_company_id: analysis[:existing_company_match]&.id,
                recommended_action: analysis[:recommended_action].to_s,
                confidence_score: analysis[:confidence],
                analysis_data: analysis,
                abr_data: analysis[:abr_data],
                email_domain: analysis[:domain_analysis]&.dig(:domain),
                derived_company_name: analysis[:domain_analysis]&.dig(:derived_company_name),
                status: "pending"
              )
              review.save!

              issues_found += 1
              by_issue_type[issue_type] += 1
            end
          end
        rescue StandardError => e
          puts "\nError processing contact #{contact.id}: #{e.message}"
        end
      end

      puts ""
      puts "=" * 80
      puts "RESULTS"
      puts "=" * 80
      puts "Total contacts scanned: #{total_contacts}"
      puts "Issues found: #{issues_found}"
      puts ""
      puts "By issue type:"
      by_issue_type.sort_by { |_k, v| -v }.each do |type, count|
        puts "  #{type}: #{count}"
      end
      puts ""
      puts "Review pending issues at: /contacts/quality-review"
      puts "Or run: rake contacts:quality:status"
      puts "=" * 80
    end

    desc "Show quality review status summary"
    task status: :environment do
      puts "=" * 80
      puts "CONTACT QUALITY REVIEW STATUS"
      puts "=" * 80
      puts ""

      total = ContactQualityReview.count
      pending = ContactQualityReview.pending.count
      approved = ContactQualityReview.approved.count
      rejected = ContactQualityReview.rejected.count

      puts "Total reviews: #{total}"
      puts "  Pending:  #{pending}"
      puts "  Approved: #{approved}"
      puts "  Rejected: #{rejected}"
      puts ""

      if pending > 0
        puts "Pending by issue type:"
        ContactQualityReview.pending.group(:issue_type).count.sort_by { |_k, v| -v }.each do |type, count|
          label = ContactQualityReview::ISSUE_TYPE_LABELS[type] || type.humanize
          puts "  #{label}: #{count}"
        end
        puts ""

        puts "High confidence reviews (>= 80%):"
        high_conf = ContactQualityReview.pending.high_confidence.count
        puts "  #{high_conf} reviews ready for bulk approval"
        puts ""

        puts "Top 5 pending reviews:"
        ContactQualityReview.pending.order(confidence_score: :desc).limit(5).each do |review|
          puts "  - #{review.contact.display_name} (#{review.issue_type_label}, #{review.confidence_score}%)"
        end
      end

      puts ""
      puts "=" * 80
    end

    desc "Approve all high-confidence reviews (>= 80% confidence)"
    task approve_high_confidence: :environment do
      puts "=" * 80
      puts "BULK APPROVE HIGH-CONFIDENCE REVIEWS"
      puts "=" * 80
      puts ""

      reviews = ContactQualityReview.pending.high_confidence
      total = reviews.count

      if total == 0
        puts "No high-confidence reviews pending."
        puts "=" * 80
        exit
      end

      puts "Found #{total} high-confidence reviews to approve."
      print "Proceed? (y/n): "
      response = $stdin.gets&.chomp&.downcase

      unless response == "y"
        puts "Aborted."
        exit
      end

      approved = 0
      failed = 0

      reviews.find_each do |review|
        begin
          ActiveRecord::Base.transaction do
            ContactQualityActionService.new(review).execute!
            review.update!(status: "approved", reviewed_at: Time.current)
          end
          approved += 1
          puts "  Approved: #{review.contact.display_name} - #{review.issue_type_label}"
        rescue StandardError => e
          failed += 1
          puts "  FAILED: #{review.contact.display_name} - #{e.message}"
        end
      end

      puts ""
      puts "=" * 80
      puts "RESULTS"
      puts "=" * 80
      puts "Approved: #{approved}"
      puts "Failed: #{failed}"
      puts "=" * 80
    end

    desc "Analyze a single contact for quality issues"
    task :analyze, [:contact_id] => :environment do |_t, args|
      contact_id = args[:contact_id]

      if contact_id.blank?
        puts "Usage: rake contacts:quality:analyze[CONTACT_ID]"
        exit 1
      end

      contact = Contact.find(contact_id)
      puts "=" * 80
      puts "QUALITY ANALYSIS: #{contact.display_name}"
      puts "=" * 80
      puts ""

      service = ContactDataQualityService.new(contact)
      analysis = service.analyze

      puts "Current Entity Type: #{contact.entity_type}"
      puts "Email: #{contact.email}"
      puts "ABN: #{contact.tax_number || 'None'}"
      puts ""

      if analysis[:issues].any?
        puts "Issues Found:"
        analysis[:issues].each do |issue|
          puts "  - [#{issue[:severity]}] #{issue[:message]}"
        end
        puts ""

        puts "Suggested Entity Type: #{analysis[:suggested_entity_type]}"
        puts "Recommended Action: #{analysis[:recommended_action]}"
        puts "Confidence: #{analysis[:confidence]}%"
        puts ""

        if analysis[:existing_company_match]
          puts "Existing Company Match: #{analysis[:existing_company_match].display_name}"
        end

        if analysis[:domain_analysis]
          puts "Domain Analysis:"
          puts "  Domain: #{analysis[:domain_analysis][:domain]}"
          puts "  Derived Company Name: #{analysis[:domain_analysis][:derived_company_name]}"
          puts "  Other contacts with same domain: #{analysis[:domain_analysis][:contacts_with_same_domain]}"
        end
      else
        puts "No issues found - contact looks good!"
      end

      puts ""
      puts "=" * 80
    rescue ActiveRecord::RecordNotFound
      puts "Contact #{contact_id} not found."
      exit 1
    end

    desc "Clear all pending quality reviews"
    task clear_pending: :environment do
      count = ContactQualityReview.pending.count
      print "This will delete #{count} pending reviews. Proceed? (y/n): "
      response = $stdin.gets&.chomp&.downcase

      if response == "y"
        ContactQualityReview.pending.destroy_all
        puts "Deleted #{count} pending reviews."
      else
        puts "Aborted."
      end
    end
  end
end
