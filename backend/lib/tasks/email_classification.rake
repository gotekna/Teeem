namespace :emails do
  desc "Backfill classification for existing emails"
  task backfill_classification: :environment do
    puts "\n========================================="
    puts "Email Classification Backfill"
    puts "=========================================\n"

    # Count total unclassified emails
    total = EmailWarehouse.where(email_classification: {}).count
    puts "Found #{total} unclassified emails\n"

    return if total.zero?

    processed = 0
    failed = 0

    # Process in batches of 100
    EmailWarehouse.where(email_classification: {}).find_in_batches(batch_size: 100) do |batch|
      batch.each do |email|
        begin
          EmailClassificationService.new(email).classify!
          processed += 1
          print "." if processed % 100 == 0
        rescue StandardError => e
          Rails.logger.error "[EmailClassification] Failed to classify email #{email.id}: #{e.message}"
          failed += 1
        end
      end
    end

    puts "\n\nBackfill complete!"
    puts "Processed: #{processed}"
    puts "Failed: #{failed}"

    # Report stats
    stats = EmailWarehouse.group("email_classification->>'email_type'").count
    puts "\n========================================="
    puts "Classification Breakdown:"
    puts "=========================================\n"
    stats.each do |type, count|
      puts "  #{(type || 'unclassified').ljust(20)} #{count}"
    end
    puts "\n"
  end

  desc "Show email classification statistics"
  task classification_stats: :environment do
    puts "\n========================================="
    puts "Email Classification Statistics"
    puts "=========================================\n"

    total = EmailWarehouse.count
    classified = EmailWarehouse.where.not(email_classification: {}).count
    unclassified = total - classified

    puts "Total emails: #{total}"
    puts "Classified: #{classified} (#{(classified.to_f / total * 100).round(1)}%)"
    puts "Unclassified: #{unclassified}\n\n"

    # Breakdown by type
    stats = EmailWarehouse
      .where.not(email_classification: {})
      .group("email_classification->>'email_type'")
      .count

    puts "Breakdown by type:"
    stats.each do |type, count|
      percentage = (count.to_f / classified * 100).round(1)
      puts "  #{type.ljust(20)} #{count.to_s.rjust(6)} (#{percentage}%)"
    end

    # Breakdown by method
    puts "\nBreakdown by classification method:"
    method_stats = EmailWarehouse
      .where.not(email_classification: {})
      .group("email_classification->>'method'")
      .count

    method_stats.each do |method, count|
      percentage = (count.to_f / classified * 100).round(1)
      puts "  #{method.ljust(20)} #{count.to_s.rjust(6)} (#{percentage}%)"
    end
    puts "\n"
  end
end

namespace :cases do
  desc "Audit marketing emails in cases (generates report)"
  task audit_marketing_emails: :environment do
    puts "\n========================================="
    puts "Case Marketing Email Audit"
    puts "=========================================\n"

    marketing_case_emails = CaseEmail
      .joins(:email_warehouse)
      .where("email_warehouse.email_classification->>'email_type' IN (?)",
             [ "marketing", "spam" ])
      .where("email_warehouse.email_classification->>'confidence' > ?", 0.5)

    if marketing_case_emails.empty?
      puts "No marketing emails found in cases. All clean!"
      return
    end

    puts "Found #{marketing_case_emails.count} marketing emails in cases\n"

    report = marketing_case_emails.group_by(&:case_id).map do |case_id, emails|
      case_record = CaseRecord.find(case_id)
      {
        case_id: case_id,
        case_title: case_record.title,
        marketing_emails: emails.count,
        subjects: emails.map { |e| e.email_warehouse.subject }
      }
    end

    # Save report to file
    filename = "tmp/marketing_emails_audit_#{Time.current.strftime('%Y%m%d_%H%M%S')}.json"
    File.write(filename, JSON.pretty_generate(report))

    puts "Audit report saved to: #{filename}"
    puts "\nSummary by case:"
    report.each do |case_info|
      puts "\n  Case ##{case_info[:case_id]}: #{case_info[:case_title]}"
      puts "  Marketing emails: #{case_info[:marketing_emails]}"
      case_info[:subjects].first(3).each do |subject|
        puts "    - #{subject.truncate(60)}"
      end
      puts "    ..." if case_info[:subjects].size > 3
    end
    puts "\n"
  end

  desc "Remove marketing emails from cases (run audit first!)"
  task remove_marketing_emails: :environment do
    dry_run = ENV["DRY_RUN"] != "false"

    puts "\n========================================="
    puts "Remove Marketing Emails from Cases"
    puts "=========================================\n"

    if dry_run
      puts "DRY RUN MODE - No changes will be made"
      puts "Set DRY_RUN=false to actually remove emails\n"
    else
      puts "LIVE MODE - Marketing emails will be marked as irrelevant\n"
    end

    marketing_case_emails = CaseEmail
      .joins(:email_warehouse)
      .where("email_warehouse.email_classification->>'email_type' IN (?)",
             [ "marketing", "spam" ])
      .where("email_warehouse.email_classification->>'confidence' > ?", 0.5)

    if marketing_case_emails.empty?
      puts "No marketing emails found in cases"
      return
    end

    puts "Found #{marketing_case_emails.count} marketing emails to process\n"

    if dry_run
      # Show what would be removed
      marketing_case_emails.limit(10).each do |case_email|
        email = case_email.email_warehouse
        classification = email.email_classification
        puts "  Would mark as irrelevant:"
        puts "    Case: #{case_email.case_id}"
        puts "    Subject: #{email.subject.truncate(60)}"
        puts "    Type: #{classification['email_type']} (#{(classification['confidence'] * 100).to_i}% confidence)"
        puts ""
      end
      puts "  ... and #{marketing_case_emails.count - 10} more" if marketing_case_emails.count > 10
    else
      # Actually remove them
      count = 0
      marketing_case_emails.find_each do |case_email|
        email_type = case_email.email_warehouse.email_classification["email_type"]
        case_email.update(
          relevance: "irrelevant",
          notes: "[AUTO-REMOVED] Classified as #{email_type} email by EmailClassificationService"
        )
        count += 1
        print "." if count % 50 == 0
      end
      puts "\n\nMarked #{count} marketing emails as irrelevant"
    end
    puts "\n"
  end

  desc "Show cases with the most marketing emails"
  task cases_with_most_spam: :environment do
    puts "\n========================================="
    puts "Cases with Most Marketing/Spam Emails"
    puts "=========================================\n"

    results = CaseEmail
      .joins(:email_warehouse)
      .where("email_warehouse.email_classification->>'email_type' IN (?)",
             [ "marketing", "spam" ])
      .where("email_warehouse.email_classification->>'confidence' > ?", 0.5)
      .group(:case_id)
      .count
      .sort_by { |_case_id, count| -count }
      .first(20)

    if results.empty?
      puts "No marketing emails found in cases!"
      return
    end

    results.each_with_index do |(case_id, count), index|
      case_record = CaseRecord.find(case_id)
      puts "#{(index + 1).to_s.rjust(3)}. Case ##{case_id}: #{case_record.title.truncate(50)}"
      puts "     Marketing emails: #{count}"
    end
    puts "\n"
  end

  desc "Preview ephemeral emails that would be cleaned up"
  task preview_ephemeral_cleanup: :environment do
    puts "\n========================================="
    puts "Ephemeral Email Cleanup Preview"
    puts "=========================================\n"

    # Show what's currently marked as ephemeral
    ephemeral_emails = EmailWarehouse
      .where("email_classification->>'ephemeral' = ?", "true")

    puts "Total ephemeral emails: #{ephemeral_emails.count}\n"

    # Group by type
    by_type = ephemeral_emails.group("email_classification->>'ephemeral_type'").count
    puts "\nBy type:"
    by_type.each do |type, count|
      puts "  #{type}: #{count}"
    end

    # Show expired
    expired = ephemeral_emails.where("(email_classification->>'expires_at')::timestamp < ?", Time.current)
    puts "\nExpired (would be deleted): #{expired.count}"

    if expired.count > 0
      puts "\nSample expired emails:"
      expired.limit(10).each do |email|
        expires_at = email.email_classification["expires_at"]
        type = email.email_classification["ephemeral_type"]
        puts "  - [#{type}] #{email.subject.to_s.truncate(50)} (expired #{expires_at})"
      end
    end

    puts "\nTo actually clean up, run: rails emails:cleanup_ephemeral"
    puts "To also delete from Outlook: rails emails:cleanup_ephemeral_with_outlook\n"
  end

  desc "Clean up expired ephemeral emails (database only)"
  task cleanup_ephemeral: :environment do
    CleanupEphemeralEmailsJob.execute!(delete_from_outlook: false)
  end

  desc "Clean up expired ephemeral emails (database AND Outlook)"
  task cleanup_ephemeral_with_outlook: :environment do
    CleanupEphemeralEmailsJob.execute!(delete_from_outlook: true)
  end

  desc "Reclassify all emails currently marked as spam (to fix false positives)"
  task reclassify_spam: :environment do
    puts "\n========================================="
    puts "Reclassifying Spam Emails"
    puts "=========================================\n"

    spam_emails = EmailWarehouse.spam
    total = spam_emails.count
    puts "Found #{total} emails currently classified as spam\n"

    return if total.zero?

    reclassified = 0
    still_spam = 0
    failed = 0

    spam_emails.find_each do |email|
      # Clear the current classification and reclassify
      old_type = email.email_classification["email_type"]
      result = EmailClassificationService.new(email).classify!

      if result[:email_type] != "spam"
        reclassified += 1
        puts "  ✓ Reclassified: #{email.from_email} - #{email.subject.to_s.truncate(50)} → #{result[:email_type]}"
      else
        still_spam += 1
      end
    rescue StandardError => e
      Rails.logger.error "[EmailClassification] Failed to reclassify email #{email.id}: #{e.message}"
      failed += 1
    end

    puts "\n========================================="
    puts "Reclassification Results:"
    puts "=========================================\n"
    puts "  Reclassified (no longer spam): #{reclassified}"
    puts "  Still spam: #{still_spam}"
    puts "  Failed: #{failed}"

    # Show updated stats
    puts "\n========================================="
    puts "Updated Classification Breakdown:"
    puts "=========================================\n"
    stats = EmailWarehouse.group("email_classification->>'email_type'").count
    stats.each do |type, count|
      puts "  #{(type || 'unclassified').ljust(20)} #{count}"
    end
    puts "\n"
  end
end
