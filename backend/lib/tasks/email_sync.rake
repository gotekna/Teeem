namespace :email_warehouse do
  # DEPRECATED: Per-user Outlook credentials have been removed
  # Email sync now uses org-wide credentials via OrgEmailSyncJob
  desc "DEPRECATED - Run full sync (use OrgEmailSyncJob instead)"
  task full_sync: :environment do
    puts "DEPRECATED: Per-user Outlook sync has been removed."
    puts "Email sync now runs automatically via OrgEmailSyncJob every 15 minutes."
    puts ""
    puts "To manually trigger org sync, run:"
    puts "  OrgEmailSyncJob.perform_now('full')"
    puts ""
    puts "Total emails in warehouse: #{EmailWarehouse.count}"
    puts "Assigned to jobs: #{EmailWarehouse.assigned.count}"
    puts "Unassigned: #{EmailWarehouse.unassigned.count}"
  end

  # DEPRECATED: Per-user Outlook credentials have been removed
  desc "DEPRECATED - Refresh tokens (handled by RefreshIntegrationTokensJob)"
  task refresh_tokens: :environment do
    puts "DEPRECATED: Per-user Outlook tokens have been removed."
    puts "Org credentials are automatically refreshed by RefreshIntegrationTokensJob every 15 minutes."
  end

  desc "Show warehouse stats"
  task stats: :environment do
    puts "Email Warehouse Stats"
    puts "====================="
    puts "Total emails: #{EmailWarehouse.count}"
    puts "Assigned to jobs: #{EmailWarehouse.assigned.count}"
    puts "Unassigned: #{EmailWarehouse.unassigned.count}"
    puts "Unique conversations: #{EmailWarehouse.distinct.count(:conversation_id)}"
    puts "Oldest email: #{EmailWarehouse.minimum(:received_at)}"
    puts "Newest email: #{EmailWarehouse.maximum(:received_at)}"
  end

  desc "Clear stuck sync status"
  task clear_status: :environment do
    EmailSyncStatus.find_each do |status|
      status.update(
        status: "completed",
        last_sync_at: Time.current,
        total_emails_synced: EmailWarehouse.count
      )
      puts "Cleared status for user #{status.user_id}"
    end
    puts "Done. Total emails in warehouse: #{EmailWarehouse.count}"
  end

  desc "Backfill body_text from body_html for existing emails"
  task backfill_body_text: :environment do
    require "cgi"

    # Find emails with HTML body but no text body
    emails_to_fix = EmailWarehouse.where(body_text: [ nil, "" ]).where.not(body_html: [ nil, "" ])
    total = emails_to_fix.count

    puts "Found #{total} emails with HTML body but no text body"
    puts "Processing..."

    fixed = 0
    errors = 0

    emails_to_fix.find_each.with_index do |email, index|
      if (index + 1) % 500 == 0
        puts "  Progress: #{index + 1}/#{total} (#{fixed} fixed, #{errors} errors)"
      end

      begin
        html = email.body_html
        next if html.blank?

        # Extract text from HTML (same logic as sync service)
        text = html.gsub(/<script[^>]*>.*?<\/script>/mi, "")
        text = text.gsub(/<style[^>]*>.*?<\/style>/mi, "")
        text = text.gsub(/<br\s*\/?>/i, "\n")
        text = text.gsub(/<\/(p|div|tr|li|h[1-6])>/i, "\n")
        text = text.gsub(/<[^>]+>/, "")
        text = CGI.unescapeHTML(text)
        text = text.gsub(/\r\n/, "\n")
        text = text.gsub(/[ \t]+/, " ")
        text = text.gsub(/\n{3,}/, "\n\n")
        text = text.strip

        if text.present?
          email.update_column(:body_text, text)
          fixed += 1
        end
      rescue => e
        errors += 1
        puts "  Error processing email #{email.id}: #{e.message}" if errors <= 10
      end
    end

    puts ""
    puts "Backfill complete!"
    puts "  Total processed: #{total}"
    puts "  Fixed: #{fixed}"
    puts "  Errors: #{errors}"

    # Show new stats
    with_body = EmailWarehouse.where.not(body_text: [ nil, "" ]).count
    total_emails = EmailWarehouse.count
    puts ""
    puts "New stats:"
    puts "  Emails with body_text: #{with_body}/#{total_emails} (#{(with_body.to_f / total_emails * 100).round(1)}%)"
  end

  desc "Auto-match all unassigned emails to jobs"
  task auto_match: :environment do
    unassigned = EmailWarehouse.unassigned
    total = unassigned.count
    matched = 0

    puts "Auto-matching #{total} unassigned emails..."

    unassigned.find_each.with_index do |email, index|
      if (index + 1) % 100 == 0
        puts "  Progress: #{index + 1}/#{total} (#{matched} matched so far)"
      end

      begin
        job = email.auto_assign_to_job!(min_confidence: 0.7)
        matched += 1 if job
      rescue => e
        puts "  Error matching email #{email.id}: #{e.message}"
      end
    end

    puts ""
    puts "Auto-matching complete!"
    puts "  Total processed: #{total}"
    puts "  Matched to jobs: #{matched}"
    puts "  Still unassigned: #{EmailWarehouse.unassigned.count}"
  end
end
