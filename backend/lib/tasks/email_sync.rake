namespace :email_warehouse do
  desc "Run full sync for all connected Outlook users"
  task full_sync: :environment do
    users_with_outlook = User.joins(:outlook_credential).to_a
    puts "Found #{users_with_outlook.count} users with Outlook connected"

    users_with_outlook.each do |user|
      puts "\nSyncing for user #{user.id}: #{user.email}"
      begin
        service = EmailWarehouseSyncService.new(user)
        count = service.full_sync!
        puts "  Synced #{count} emails"
      rescue => e
        puts "  ERROR: #{e.class} - #{e.message}"
        puts "  Backtrace: #{e.backtrace.first(5).join("\n  ")}"
      end
    end

    puts "\n"
    puts "Total emails in warehouse: #{EmailWarehouse.count}"
    puts "Assigned to jobs: #{EmailWarehouse.assigned.count}"
    puts "Unassigned: #{EmailWarehouse.unassigned.count}"
  end

  desc "Refresh all Outlook tokens"
  task refresh_tokens: :environment do
    users_with_outlook = User.joins(:outlook_credential).to_a
    puts "Found #{users_with_outlook.count} users with Outlook credentials"

    users_with_outlook.each do |user|
      cred = user.outlook_credential
      puts "\nUser #{user.id}: #{user.email}"
      puts "  Expired: #{cred.expired?}"
      puts "  Expires at: #{cred.expires_at}"

      if cred.expired?
        puts "  Refreshing token..."
        result = cred.refresh!
        puts "  Refresh result: #{result}"
        cred.reload
        puts "  New expires at: #{cred.expires_at}"
        puts "  Now expired: #{cred.expired?}"
      end
    end
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
