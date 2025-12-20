# OrgEmailSyncJob - Sync emails for ALL users using Application permissions
# No per-user OAuth needed - uses org-wide app credentials
#
# SSoT Usage (preferred - org-scoped):
#   OrgEmailSyncJob.perform_now('incremental', organization_id: 1)
#   OrgEmailSyncJob.perform_now('full', organization_id: org.id)
#
# Legacy Usage (deprecated - logs warning):
#   OrgEmailSyncJob.perform_now           # Uses first active credential
#   OrgEmailSyncJob.perform_later         # Queue for background processing

class OrgEmailSyncJob < ApplicationJob
  queue_as :low

  # SSoT: Supports multi-org via organization_id (preferred)
  # Falls back to credential_id or org_name for legacy compatibility (with warning)
  def perform(sync_type = "incremental", organization_id: nil, credential_id: nil, org_name: nil)
    # SSoT: Find credential using org-scoped lookup
    @credential = find_credential(organization_id: organization_id, credential_id: credential_id, org_name: org_name)

    unless @credential&.status == "connected"
      Rails.logger.info "[OrgEmailSync] Skipping - org Microsoft app not connected"
      return
    end

    sync_config = @credential.sync_config || {}
    sync_all = sync_config["sync_all"] || false
    user_emails = sync_config["user_emails"] || []
    sync_years = sync_config["sync_years"] || 3
    sync_days = sync_config["sync_days"] # Optional: sync by days instead of years

    # Determine which users to sync
    if sync_all
      # Get all users from tenant
      client = MicrosoftAppGraphClient.new(@credential)
      tenant_users = client.list_users(select: "id,mail,userPrincipalName")
      user_emails = tenant_users.map { |u| u["mail"] || u["userPrincipalName"] }.compact
    end

    if user_emails.empty?
      Rails.logger.info "[OrgEmailSync] No users configured for sync"
      return
    end

    Rails.logger.info "[OrgEmailSync] Starting #{sync_type} sync for #{@credential.name}: #{user_emails.count} users"

    total_synced = 0
    errors = []

    user_emails.each do |user_email|
      begin
        synced = sync_user_emails(user_email, sync_type, sync_years, sync_days)
        total_synced += synced
        Rails.logger.info "[OrgEmailSync] Synced #{synced} emails for #{user_email}"
      rescue StandardError => e
        Rails.logger.error "[OrgEmailSync] Error syncing #{user_email}: #{e.message}"
        errors << { user: user_email, error: e.message }
      end
    end

    # Update last sync time
    @credential.update!(last_sync_at: Time.current)

    Rails.logger.info "[OrgEmailSync] Completed: #{total_synced} emails synced, #{errors.count} errors"

    { total_synced: total_synced, errors: errors }
  end

  private

  def sync_user_emails(user_email, sync_type, sync_years, sync_days = nil)
    client = MicrosoftAppGraphClient.new(@credential)
    total_synced = 0

    # Determine since date - prefer sync_days over sync_years if both are set
    lookback_time = if sync_days.present?
                      if sync_days == 0
                        Date.today.beginning_of_day  # Just today (from midnight)
                      else
                        sync_days.days.ago  # Last N days (24-hour periods)
                      end
    else
                      sync_years.years.ago
    end

    since = case sync_type
    when "full"
              lookback_time
    else
              # Incremental - use last_sync_at or fallback to configured lookback
              @credential.last_sync_at || lookback_time
    end

    # Get all mail folders
    folders = client.get_user_mail_folders(user_email)

    folders.each do |folder|
      synced = sync_folder(client, user_email, folder, since)
      total_synced += synced
    end

    # Auto-match unassigned emails after sync
    auto_match_user_emails(user_email)

    total_synced
  end

  def sync_folder(client, user_email, folder, since)
    synced = 0
    page = 0
    skip = 0
    max_pages = 200 # Increased from 50 to handle large mailboxes (200 * 100 = 20,000 emails per folder)

    loop do
      emails = client.get_user_emails(
        user_email,
        folder: folder[:id],
        top: 100,
        since: since,
        skip: skip
      )

      break if emails.empty?

      emails.each do |email_data|
        # Upsert into EmailWarehouse
        warehouse_email = upsert_email(email_data, user_email, folder[:name])
        synced += 1 if warehouse_email
      end

      page += 1
      skip += 100 # Move to next page
      break if page >= max_pages || emails.count < 100
    end

    Rails.logger.info "[OrgEmailSync] Synced #{synced} emails from #{folder[:name]} (#{page} pages)"
    synced
  end

  def upsert_email(email_data, owner_email, folder_name)
    # Transform Graph API response to our format
    internet_message_id = email_data["internetMessageId"] || email_data["id"]

    # Extract sender info first (needed for filtering)
    from_data = email_data["from"]&.dig("emailAddress") || {}
    from_email = from_data["address"]
    subject = email_data["subject"] || ""
    has_attachments = email_data["hasAttachments"] || false

    # ALWAYS FILTER: Draft emails (incomplete, no sender info)
    if folder_name == "Drafts"
      Rails.logger.debug "[OrgEmailSync] Skipping draft email: #{subject}"
      return nil
    end

    # ALWAYS FILTER: Junk/Spam emails (already classified as spam by email provider)
    if folder_name == "Junk Email"
      Rails.logger.debug "[OrgEmailSync] Skipping junk/spam email: #{subject} from #{from_email}"
      return nil
    end

    # NEVER FILTER: Sent items (unless internal)
    if folder_name == "Sent Items"
      # Skip internal emails in Sent Items (we'll get them from recipient's inbox)
      to_emails = (email_data["toRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact
      cc_emails = (email_data["ccRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact
      all_recipients = (to_emails + cc_emails).map { |email| email.downcase }
      org_domain = owner_email.split("@").last # e.g., "lyw.org.au"

      # If ALL recipients are internal (same domain), skip this sent email
      if all_recipients.any? && all_recipients.all? { |recipient| recipient.end_with?("@#{org_domain}") }
        Rails.logger.debug "[OrgEmailSync] Skipping internal sent email (will sync from inbox): #{subject}"
        return nil
      end
    # Otherwise, sync external sent emails
    # NEVER FILTER: Emails with attachments
    elsif has_attachments
    # Always sync emails with attachments (important business emails)
    # FILTER: Check against blacklist
    else
      # Use database-backed blacklist (supports incremental & full sync)
      if EmailBlacklistItem.should_filter?(
        from_email: from_email,
        from_name: from_data["name"],
        subject: subject
      )
        Rails.logger.debug "[OrgEmailSync] Skipping blacklisted email: #{subject} from #{from_email}"
        return nil
      end
    end

    # Find or create - use internet_message_id as unique identifier
    # Each email is stored once globally, regardless of which mailbox synced it
    email = EmailWarehouse.find_or_initialize_by(
      internet_message_id: internet_message_id
    )

    # Extract recipients
    to_emails = (email_data["toRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact
    cc_emails = (email_data["ccRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact

    # Extract body content
    body_data = email_data["body"] || {}
    body_content = body_data["content"]
    body_type = body_data["contentType"]&.downcase

    # Store body in both text and html based on content type
    if body_type == "html"
      body_html = body_content
      body_text = extract_text_from_html(body_content)
    else
      body_text = body_content
      body_html = nil
    end

    email.assign_attributes(
      outlook_id: email_data["id"],
      subject: email_data["subject"],
      from_email: from_data["address"],
      from_name: from_data["name"],
      to_emails: to_emails,
      cc_emails: cc_emails,
      received_at: email_data["receivedDateTime"],
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
      microsoft_credential_id: @credential&.id,  # Track which org this email came from
      mailbox_owner_email: owner_email  # Track which mailbox this email came from (for fetching attachments)
    )

    # Set first_synced_at if new record
    email.first_synced_at ||= Time.current

    # Set synced_by_user_id if we can match the owner to a TEEEM user
    unless email.synced_by_user_id
      teeem_user = User.find_by(email: owner_email)
      email.synced_by_user_id = teeem_user&.id
    end

    email.save!

    # Build recipient links (to Users and Contacts)
    if email.persisted?
      begin
        email.build_recipients!
        Rails.logger.info "[OrgEmailSync] Built recipients for email #{email.id}"
      rescue StandardError => e
        Rails.logger.error "[OrgEmailSync] Failed to build recipients for email #{email.id}: #{e.message}"
        # Continue even if recipient building fails - email is still saved
      end
    end

    email
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn "[OrgEmailSync] Failed to save email #{internet_message_id}: #{e.message}"
    nil
  end

  def auto_match_user_emails(user_email)
    # Find recently synced unassigned emails for this org
    recent_unassigned = EmailWarehouse
      .where(microsoft_credential_id: @credential.id, job_id: nil)
      .where("last_synced_at > ?", 1.hour.ago)

    recent_unassigned.find_each do |email|
      # Try to auto-match based on email addresses in the thread
      matched_job = find_matching_job(email)
      if matched_job
        email.update!(job_id: matched_job.id)
        Rails.logger.info "[OrgEmailSync] Auto-matched email #{email.id} to job #{matched_job.id}"
      end
    end
  end

  def find_matching_job(email)
    # Use the sophisticated matching logic from EmailWarehouse model
    # This includes: job ID patterns, contact matching, address matching, street matching
    # Plus: confidence scores and spam filtering
    matches = email.find_matching_jobs

    # Return highest confidence match if above threshold (0.8)
    best_match = matches.first
    return nil unless best_match && best_match[:confidence] >= 0.8

    Rails.logger.info "[OrgEmailSync] Matched email #{email.id} to job #{best_match[:job].id} (#{best_match[:match_type]}, confidence: #{best_match[:confidence]})"
    best_match[:job]
  end

  # SSoT: Find credential with proper org scoping
  # Priority: organization_id > credential_id > org_name > legacy fallback (with warning)
  def find_credential(organization_id: nil, credential_id: nil, org_name: nil)
    # 1. Organization ID (SSoT preferred method)
    if organization_id.present?
      org = Organization.find_by(id: organization_id)
      if org
        return MicrosoftCredential.active_for_org(org) ||
               OrganizationMicrosoftAppCredential.active_for_org(org)
      else
        Rails.logger.warn "[OrgEmailSync] Organization not found: #{organization_id}"
      end
    end

    # 2. Credential ID (direct lookup)
    if credential_id.present?
      cred = OrganizationMicrosoftAppCredential.find_by(id: credential_id) ||
             MicrosoftCredential.find_by(id: credential_id)
      return cred if cred
    end

    # 3. Organization name (lookup by name)
    if org_name.present?
      org = Organization.find_by_name_or_slug(org_name)
      if org
        return MicrosoftCredential.active_for_org(org) ||
               OrganizationMicrosoftAppCredential.active_for_org(org)
      else
        # Legacy fallback: lookup by name field on credential
        return OrganizationMicrosoftAppCredential.find_by_name(org_name)
      end
    end

    # 4. Legacy fallback (deprecated - logs warning)
    Rails.logger.warn "[OrgEmailSync] DEPRECATED: No organization context provided. " \
                      "Use organization_id parameter for proper org isolation. " \
                      "Falling back to first active credential."
    OrganizationMicrosoftAppCredential.active_credential
  end

  def extract_text_from_html(html_content)
    return nil if html_content.blank?

    # Simple HTML stripping - remove tags and decode entities
    text = html_content.gsub(/<[^>]*>/, "")  # Remove HTML tags
    text = CGI.unescapeHTML(text)             # Decode HTML entities (&nbsp;, etc.)
    text.strip
  end
end
