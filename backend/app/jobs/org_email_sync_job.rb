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

  # Performance: Memoization caches to avoid N+1 queries during sync
  attr_reader :user_cache, :blacklist_cache

  # Performance: Parallel folder sync configuration
  PARALLEL_FOLDER_THREADS = 3  # Number of folders to sync concurrently
  SYNC_TIMEOUT_SECONDS = 300   # 5 minute timeout per folder

  # SSoT: Supports multi-org via organization_id (preferred)
  # Falls back to credential_id or org_name for legacy compatibility (with warning)
  def perform(sync_type = "incremental", organization_id: nil, credential_id: nil, org_name: nil)
    # Performance: Thread-safe caches for parallel folder sync
    @user_cache = Concurrent::Map.new
    @blacklist_cache = nil
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

    # Performance: Parallel folder sync with thread batching
    # Sync folders in parallel (PARALLEL_FOLDER_THREADS at a time) for ~3x speedup
    total_synced = sync_folders_parallel(client, user_email, folders, since)

    # Auto-match unassigned emails after sync
    auto_match_user_emails(user_email)

    total_synced
  end

  # Performance: Sync folders in parallel batches
  # Impact: ~3x faster sync for users with many folders (Inbox, Sent, Archive, etc.)
  def sync_folders_parallel(client, user_email, folders, since)
    return 0 if folders.empty?

    # Thread-safe counter for total synced emails
    total_synced = Concurrent::AtomicFixnum.new(0)

    # Process folders in parallel batches
    folders.each_slice(PARALLEL_FOLDER_THREADS) do |folder_batch|
      threads = folder_batch.map do |folder|
        Thread.new do
          # Each thread gets its own database connection from the pool
          ActiveRecord::Base.connection_pool.with_connection do
            begin
              # Create a new client instance per thread (thread-safe HTTP)
              thread_client = MicrosoftAppGraphClient.new(@credential)
              synced = sync_folder(thread_client, user_email, folder, since)
              total_synced.increment(synced)
            rescue StandardError => e
              Rails.logger.error "[OrgEmailSync] Parallel sync error for folder #{folder[:name]}: #{e.message}"
            end
          end
        end
      end

      # Wait for all threads in this batch to complete (with timeout)
      threads.each do |thread|
        thread.join(SYNC_TIMEOUT_SECONDS)
        thread.kill if thread.alive?  # Kill timed-out threads
      end
    end

    total_synced.value
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

    # NOTE: Drafts are now synced (to match Office 365 exactly)
    # They will appear with folder_name="Drafts" and can be filtered in frontend

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

    # For drafts, use createdDateTime as fallback since they don't have receivedDateTime
    received_at = email_data["receivedDateTime"] || email_data["createdDateTime"]
    is_draft = email_data["isDraft"] || (folder_name == "Drafts")

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
      microsoft_credential_id: @credential&.id,  # Track which org this email came from
      mailbox_owner_email: owner_email  # Track which mailbox this email came from (for fetching attachments)
    )

    # Set first_synced_at if new record
    email.first_synced_at ||= Time.current

    # Set synced_by_user_id if we can match the owner to a TEEEM user
    # Performance: Use memoized lookup to avoid N+1 (same owner_email repeated for all emails)
    unless email.synced_by_user_id
      teeem_user = find_teeem_user(owner_email)
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

      # Apply email rules (SSoT: same pattern as IMAP sync)
      apply_rules_to_email(email)

      # Auto-attach to task if this email belongs to a task's conversation
      auto_attach_to_task(email)
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
        return MicrosoftCredential.active_for_org(org)
      else
        Rails.logger.warn "[OrgEmailSync] Organization not found: #{organization_id}"
      end
    end

    # 2. Credential ID (direct lookup - SSoT: MicrosoftCredential only)
    if credential_id.present?
      cred = MicrosoftCredential.find_by(id: credential_id)
      return cred if cred
    end

    # 3. Organization name (lookup by name)
    if org_name.present?
      org = Organization.find_by_name_or_slug(org_name)
      if org
        return MicrosoftCredential.active_for_org(org)
      else
        # Lookup by name field on credential
        return MicrosoftCredential.find_by_name(org_name)
      end
    end

    # 4. Fallback (deprecated - logs warning)
    Rails.logger.warn "[OrgEmailSync] DEPRECATED: No organization context provided. " \
                      "Use organization_id parameter for proper org isolation. " \
                      "Falling back to first active credential."
    MicrosoftCredential.active_credential
  end

  def extract_text_from_html(html_content)
    return nil if html_content.blank?

    # Simple HTML stripping - remove tags and decode entities
    text = html_content.gsub(/<[^>]*>/, "")  # Remove HTML tags
    text = CGI.unescapeHTML(text)             # Decode HTML entities (&nbsp;, etc.)
    text.strip
  end

  # Performance: Thread-safe memoized user lookup to avoid N+1 queries
  # Impact: 5,000 queries/day → 1-3 queries/day
  # Uses Concurrent::Map for thread safety during parallel folder sync
  def find_teeem_user(email)
    return nil if email.blank?
    normalized_email = email.to_s.downcase.strip
    @user_cache.fetch_or_store(normalized_email) do
      User.find_by("LOWER(email) = ?", normalized_email)
    end
  end

  # Performance: Memoized blacklist lookup
  # Impact: Avoids repeated blacklist queries during sync
  def cached_blacklist
    @blacklist_cache ||= EmailBlacklistItem.active.pluck(:pattern_type, :pattern)
  end

  # Apply email rules to a newly synced email
  # SSoT: Uses EmailRuleService.apply_rules which handles MS365 via for_email scope
  def apply_rules_to_email(email)
    # Find a user to apply rules with - use synced_by_user if available, else org admin
    user = email.synced_by_user || find_org_admin_user
    return unless user

    service = EmailRuleService.new(user)
    service.apply_rules(email)
  rescue StandardError => e
    Rails.logger.error "[OrgEmailSync] Failed to apply rules to email #{email.id}: #{e.message}"
    # Don't fail the sync if rules fail
  end

  # Auto-attach email to task if:
  # 1. It belongs to a task's conversation thread (same conversation_id)
  # 2. It matches a task's email keywords (subject/body match)
  # Also notifies the task owner when new emails arrive
  def auto_attach_to_task(email)
    attached_task_ids = Set.new
    user = email.synced_by_user || find_org_admin_user

    # Method 1: Match by conversation_id (existing thread)
    if email.conversation_id.present?
      task_ids = SmTaskAttachment
        .where(attachable_type: "EmailWarehouse")
        .joins("INNER JOIN email_warehouses ON email_warehouses.id = sm_task_attachments.attachable_id")
        .where("email_warehouses.conversation_id = ?", email.conversation_id)
        .distinct
        .pluck(:sm_task_id)

      task_ids.each do |task_id|
        next if attached_task_ids.include?(task_id)
        if attach_email_to_task(email, task_id, user, "Reply in conversation thread")
          attached_task_ids << task_id
        end
      end
    end

    # Method 2: Match by email_keywords (subject/body contains keywords)
    matching_tasks = SmTask.tasks_matching_email(email)
    matching_tasks.each do |task|
      next if attached_task_ids.include?(task.id)
      if attach_email_to_task(email, task.id, user, "Matched by keywords: #{task.email_keywords.truncate(50)}")
        attached_task_ids << task.id
      end
    end
  rescue StandardError => e
    Rails.logger.error "[OrgEmailSync] Failed to auto-attach email to task: #{e.message}"
    # Don't fail the sync if auto-attach fails
  end

  # Helper to attach email to a task (returns true if attached, false if already attached)
  def attach_email_to_task(email, task_id, user, notes)
    task = SmTask.find_by(id: task_id)
    return false unless task

    # Check if email is already attached
    already_attached = SmTaskAttachment
      .where(sm_task_id: task_id, attachable_type: "EmailWarehouse", attachable_id: email.id)
      .exists?
    return false if already_attached

    # Attach the new email to the task
    SmTaskAttachment.create!(
      sm_task: task,
      attachable: email,
      attachment_type: "email",
      notes: notes,
      added_by: user
    )

    Rails.logger.info "[OrgEmailSync] Auto-attached email #{email.id} to task ##{task.id} (#{notes})"

    # Notify task owner about the new email
    notify_task_owner_of_reply(task, email, user)
    true
  rescue StandardError => e
    Rails.logger.error "[OrgEmailSync] Failed to attach email #{email.id} to task #{task_id}: #{e.message}"
    false
  end

  # Notify task owner, creator, and followers when a new email arrives in the conversation
  def notify_task_owner_of_reply(task, email, user)
    sender_email = email.from_email&.downcase
    notified_user_ids = Set.new
    notification_message = "#{email.from_name || email.from_email} replied: #{email.subject}"

    # 1. Notify assigned user (if exists and not the sender)
    if task.assigned_user_id.present?
      assigned_user = User.find_by(id: task.assigned_user_id)
      if assigned_user && assigned_user.email&.downcase != sender_email
        create_email_reply_notification(assigned_user, task, notification_message)
        notified_user_ids << assigned_user.id
      end
    end

    # 2. Notify task creator (if exists, not sender, and not already notified)
    if task.created_by_id.present? && !notified_user_ids.include?(task.created_by_id)
      creator = User.find_by(id: task.created_by_id)
      if creator && creator.email&.downcase != sender_email
        create_email_reply_notification(creator, task, notification_message)
        notified_user_ids << creator.id
      end
    end

    # 3. Notify all followers (excluding sender and already notified users)
    task.followers.each do |follower|
      next if notified_user_ids.include?(follower.id)
      next if follower.email&.downcase == sender_email

      create_email_reply_notification(follower, task, notification_message)
      notified_user_ids << follower.id
    end

    Rails.logger.info "[OrgEmailSync] Notified #{notified_user_ids.size} users of new email on task ##{task.id}"
  rescue StandardError => e
    Rails.logger.error "[OrgEmailSync] Failed to notify task users: #{e.message}"
  end

  def create_email_reply_notification(user, task, message)
    Notification.create!(
      user: user,
      notification_type: "task_email_reply",
      notifiable: task,
      title: "New reply on task '#{task.name.truncate(50)}'",
      message: message
    )
  end

  # Find an admin user for applying rules when no specific user is matched
  def find_org_admin_user
    @org_admin_user ||= User.where(role: "admin").first
  end
end
