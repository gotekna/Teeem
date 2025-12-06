# OrgEmailSyncJob - Sync emails for ALL users using Application permissions
# No per-user OAuth needed - uses org-wide app credentials
#
# Usage:
#   OrgEmailSyncJob.perform_now           # Sync all configured users
#   OrgEmailSyncJob.perform_now('full')   # Full sync (goes back 3 years)
#   OrgEmailSyncJob.perform_later         # Queue for background processing

class OrgEmailSyncJob < ApplicationJob
  queue_as :low

  def perform(sync_type = "incremental")
    credential = OrganizationMicrosoftAppCredential.active_credential

    unless credential&.status == "connected"
      Rails.logger.info "[OrgEmailSync] Skipping - org Microsoft app not connected"
      return
    end

    sync_config = credential.sync_config || {}
    sync_all = sync_config["sync_all"] || false
    user_emails = sync_config["user_emails"] || []
    sync_years = sync_config["sync_years"] || 3

    # Determine which users to sync
    if sync_all
      # Get all users from tenant
      client = MicrosoftAppGraphClient.new
      tenant_users = client.list_users(select: "id,mail,userPrincipalName")
      user_emails = tenant_users.map { |u| u["mail"] || u["userPrincipalName"] }.compact
    end

    if user_emails.empty?
      Rails.logger.info "[OrgEmailSync] No users configured for sync"
      return
    end

    Rails.logger.info "[OrgEmailSync] Starting #{sync_type} sync for #{user_emails.count} users"

    total_synced = 0
    errors = []

    user_emails.each do |user_email|
      begin
        synced = sync_user_emails(user_email, sync_type, sync_years)
        total_synced += synced
        Rails.logger.info "[OrgEmailSync] Synced #{synced} emails for #{user_email}"
      rescue StandardError => e
        Rails.logger.error "[OrgEmailSync] Error syncing #{user_email}: #{e.message}"
        errors << { user: user_email, error: e.message }
      end
    end

    # Update last sync time
    credential.update!(last_sync_at: Time.current)

    Rails.logger.info "[OrgEmailSync] Completed: #{total_synced} emails synced, #{errors.count} errors"

    { total_synced: total_synced, errors: errors }
  end

  private

  def sync_user_emails(user_email, sync_type, sync_years)
    client = MicrosoftAppGraphClient.new
    total_synced = 0

    # Determine since date
    since = case sync_type
    when "full"
              sync_years.years.ago
    else
              # Incremental - check last sync for this user or default to 24 hours
              last_email = EmailWarehouse.where(owner_email: user_email).order(received_at: :desc).first
              last_email&.received_at || 24.hours.ago
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
    max_pages = 50 # Safety limit

    loop do
      emails = client.get_user_emails(
        user_email,
        folder: folder[:id],
        top: 100,
        since: since
      )

      break if emails.empty?

      emails.each do |email_data|
        # Upsert into EmailWarehouse
        warehouse_email = upsert_email(email_data, user_email, folder[:name])
        synced += 1 if warehouse_email
      end

      page += 1
      break if page >= max_pages || emails.count < 100
    end

    synced
  end

  def upsert_email(email_data, owner_email, folder_name)
    # Transform Graph API response to our format
    message_id = email_data["internetMessageId"] || email_data["id"]

    # Find or create
    email = EmailWarehouse.find_or_initialize_by(message_id: message_id)

    # Extract sender info
    from_data = email_data["from"]&.dig("emailAddress") || {}

    # Extract recipients
    to_recipients = (email_data["toRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact
    cc_recipients = (email_data["ccRecipients"] || []).map { |r| r.dig("emailAddress", "address") }.compact

    email.assign_attributes(
      outlook_id: email_data["id"],
      subject: email_data["subject"],
      sender_email: from_data["address"],
      sender_name: from_data["name"],
      to_recipients: to_recipients,
      cc_recipients: cc_recipients,
      received_at: email_data["receivedDateTime"],
      has_attachments: email_data["hasAttachments"] || false,
      body_preview: email_data["bodyPreview"],
      conversation_id: email_data["conversationId"],
      folder_name: folder_name,
      owner_email: owner_email,
      is_read: email_data["isRead"] || false,
      synced_at: Time.current
    )

    # Set synced_by_user_id if we can match the owner to a TEEEM user
    unless email.synced_by_user_id
      teeem_user = User.find_by(email: owner_email)
      email.synced_by_user_id = teeem_user&.id
    end

    email.save!
    email
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn "[OrgEmailSync] Failed to save email #{message_id}: #{e.message}"
    nil
  end

  def auto_match_user_emails(user_email)
    # Find recently synced unassigned emails for this user
    recent_unassigned = EmailWarehouse
      .where(owner_email: user_email, construction_id: nil)
      .where("synced_at > ?", 1.hour.ago)

    recent_unassigned.find_each do |email|
      # Try to auto-match based on email addresses in the thread
      matched_job = find_matching_job(email)
      if matched_job
        email.update!(construction_id: matched_job.id)
        Rails.logger.info "[OrgEmailSync] Auto-matched email #{email.id} to job #{matched_job.id}"
      end
    end
  end

  def find_matching_job(email)
    # Collect all email addresses involved
    addresses = [ email.sender_email, email.to_recipients, email.cc_recipients ].flatten.compact.uniq

    # Find contacts with these emails
    contacts = Contact.where(email: addresses).or(Contact.where(email_secondary: addresses))

    # Find jobs associated with these contacts
    job_ids = JobContact.where(contact_id: contacts.pluck(:id)).pluck(:construction_id).uniq

    # Return the most recent job if multiple matches
    Construction.where(id: job_ids).order(created_at: :desc).first
  end
end
