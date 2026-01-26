namespace :synced_email do
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
    puts "Total emails in warehouse: #{SyncedEmail.count}"
    puts "Assigned to jobs: #{SyncedEmail.assigned.count}"
    puts "Unassigned: #{SyncedEmail.unassigned.count}"
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
    puts "Total emails: #{SyncedEmail.count}"
    puts "Assigned to jobs: #{SyncedEmail.assigned.count}"
    puts "Unassigned: #{SyncedEmail.unassigned.count}"
    puts "Unique conversations: #{SyncedEmail.distinct.count(:conversation_id)}"
    puts "Oldest email: #{SyncedEmail.minimum(:received_at)}"
    puts "Newest email: #{SyncedEmail.maximum(:received_at)}"
  end

  desc "Clear stuck sync status"
  task clear_status: :environment do
    EmailSyncStatus.find_each do |status|
      status.update(
        status: "completed",
        last_sync_at: Time.current,
        total_emails_synced: SyncedEmail.count
      )
      puts "Cleared status for user #{status.user_id}"
    end
    puts "Done. Total emails in warehouse: #{SyncedEmail.count}"
  end

  desc "Backfill body_text from body_html for existing emails"
  task backfill_body_text: :environment do
    require "cgi"

    # Find emails with HTML body but no text body
    emails_to_fix = SyncedEmail.where(body_text: [ nil, "" ]).where.not(body_html: [ nil, "" ])
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
    with_body = SyncedEmail.where.not(body_text: [ nil, "" ]).count
    total_emails = SyncedEmail.count
    puts ""
    puts "New stats:"
    puts "  Emails with body_text: #{with_body}/#{total_emails} (#{(with_body.to_f / total_emails * 100).round(1)}%)"
  end

  desc "Full sync subfolder emails (no timeout, sequential)"
  task sync_subfolders: :environment do
    # This task syncs ALL emails from ALL subfolders for configured users
    # Unlike OrgEmailSyncJob, this runs sequentially without timeout to handle large folders
    #
    # Usage:
    #   rails synced_email:sync_subfolders
    #   YEARS=5 rails synced_email:sync_subfolders  # 5 year lookback
    #   USER=robert@tekna.com.au rails synced_email:sync_subfolders  # Single user

    years = (ENV["YEARS"] || 3).to_i
    target_user = ENV["USER"]

    credential = MicrosoftCredential.active_credential
    unless credential&.status == "connected"
      puts "No active Microsoft credential found"
      exit 1
    end

    client = MicrosoftAppGraphClient.new(credential)
    sync_config = credential.sync_config || {}
    user_emails = sync_config["user_emails"] || []

    if sync_config["sync_all"]
      tenant_users = client.list_users(select: "id,mail,userPrincipalName")
      user_emails = tenant_users.map { |u| u["mail"] || u["userPrincipalName"] }.compact
    end

    # Filter to single user if specified
    user_emails = user_emails.select { |e| e.downcase == target_user.downcase } if target_user

    if user_emails.empty?
      puts "No users to sync"
      exit 1
    end

    since = years.years.ago
    total_synced = 0

    puts "Syncing subfolder emails for #{user_emails.count} user(s)"
    puts "Lookback: #{years} years (since #{since.strftime('%Y-%m-%d')})"
    puts ""

    user_emails.each do |user_email|
      puts "=" * 60
      puts "User: #{user_email}"

      folders = client.get_user_mail_folders(user_email)
      # Filter to subfolders only (depth > 0)
      subfolders = folders.select { |f| f[:depth] && f[:depth] > 0 }

      puts "Found #{subfolders.count} subfolders"

      subfolders.each do |folder|
        folder_name = folder[:name]
        folder_id = folder[:id]
        total_items = folder[:total_items] || 0

        puts "  #{folder_name}: #{total_items} emails in MS365"

        # Skip empty folders
        next if total_items == 0

        # Check how many are already in warehouse
        existing = SyncedEmail.where(folder_name: folder_name, mailbox_owner_email: user_email).count
        puts "    Already in warehouse: #{existing}"

        # Sync folder (no timeout, sequential)
        synced = 0
        page = 0
        skip = 0

        loop do
          emails = client.get_user_emails(
            user_email,
            folder: folder_id,
            top: 100,
            since: since,
            skip: skip
          )

          break if emails.empty?

          emails.each do |email_data|
            warehouse_email = upsert_email_for_sync(email_data, user_email, folder_name, credential)
            synced += 1 if warehouse_email
          end

          page += 1
          skip += 100
          print "." if page % 5 == 0

          break if emails.count < 100
        end

        puts ""
        puts "    Synced: #{synced} emails (#{page} pages)"
        total_synced += synced
      end
    end

    puts ""
    puts "=" * 60
    puts "COMPLETE: Synced #{total_synced} subfolder emails"
  end

  # Helper for sync_subfolders task
  def upsert_email_for_sync(email_data, owner_email, folder_name, credential)
    internet_message_id = email_data["internetMessageId"] || email_data["id"]
    from_data = email_data["from"]&.dig("emailAddress") || {}
    from_email = from_data["address"]
    subject = email_data["subject"] || ""
    has_attachments = email_data["hasAttachments"] || false

    # Skip junk
    return nil if folder_name == "Junk Email"

    # Skip internal sent items
    if folder_name.include?("Sent")
      to_emails = (email_data["toRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact
      cc_emails = (email_data["ccRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact
      all_recipients = (to_emails + cc_emails).map(&:downcase)
      org_domain = owner_email.split("@").last
      return nil if all_recipients.any? && all_recipients.all? { |r| r.end_with?("@#{org_domain}") }
    end

    # Skip blacklisted (unless has attachments)
    unless has_attachments
      if EmailBlacklistItem.should_filter?(from_email: from_email, from_name: from_data["name"], subject: subject)
        return nil
      end
    end

    email = SyncedEmail.find_or_initialize_by(internet_message_id: internet_message_id)

    to_emails = (email_data["toRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact
    cc_emails = (email_data["ccRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact

    body_data = email_data["body"] || {}
    body_content = body_data["content"]
    body_type = body_data["contentType"]&.downcase

    if body_type == "html"
      body_html = body_content
      body_text = body_content&.gsub(/<[^>]*>/, "")&.then { |t| CGI.unescapeHTML(t) }&.strip
    else
      body_text = body_content
      body_html = nil
    end

    received_at = email_data["receivedDateTime"] || email_data["createdDateTime"]

    email.assign_attributes(
      outlook_id: email_data["id"],
      subject: email_data["subject"],
      from_email: from_data["address"],
      from_name: from_data["name"],
      to_emails: to_emails,
      cc_emails: cc_emails,
      received_at: received_at,
      sent_at: email_data["sentDateTime"],
      has_attachments: email_data["hasAttachments"] || false,
      body_preview: email_data["bodyPreview"],
      body_text: body_text,
      body_html: body_html,
      conversation_id: email_data["conversationId"],
      folder_name: folder_name,
      is_read: email_data["isRead"] || false,
      importance: email_data["importance"],
      in_reply_to: email_data["inReplyTo"],
      references: email_data["references"],
      last_synced_at: Time.current,
      microsoft_credential_id: credential&.id,
      mailbox_owner_email: owner_email
    )

    email.first_synced_at ||= Time.current
    email.save!
    email
  rescue ActiveRecord::RecordInvalid => e
    puts "    Error saving email: #{e.message}"
    nil
  end

  desc "Auto-match all unassigned emails to jobs"
  task auto_match: :environment do
    unassigned = SyncedEmail.unassigned
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
    puts "  Still unassigned: #{SyncedEmail.unassigned.count}"
  end
end
