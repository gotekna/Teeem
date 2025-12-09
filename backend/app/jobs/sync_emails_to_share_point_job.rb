# SyncEmailsToSharePointJob - Sync emails to EmailWarehouse and upload attachments to SharePoint
#
# Usage:
#   SyncEmailsToSharePointJob.perform_later(credential_id)
#
# This job:
# 1. Syncs all emails from the org's users to EmailWarehouse using OrgEmailSyncJob
# 2. Uploads email attachments to SharePoint in a dedicated folder structure

class SyncEmailsToSharePointJob < ApplicationJob
  queue_as :low

  def perform(credential_id)
    @credential = OrganizationMicrosoftAppCredential.find_by(id: credential_id)

    unless @credential&.status == "connected"
      Rails.logger.info "[SyncToSharePoint] Skipping - org #{credential_id} not connected"
      return
    end

    Rails.logger.info "[SyncToSharePoint] Starting sync for #{@credential.name}"

    # Step 1: Sync emails to EmailWarehouse
    Rails.logger.info "[SyncToSharePoint] Step 1: Syncing emails to warehouse..."
    email_result = OrgEmailSyncJob.perform_now("incremental", org_name: @credential.name)
    Rails.logger.info "[SyncToSharePoint] Synced #{email_result[:total_synced]} emails"

    # Step 2: Upload attachments to SharePoint
    Rails.logger.info "[SyncToSharePoint] Step 2: Uploading attachments to SharePoint..."
    attachment_result = sync_attachments_to_sharepoint
    Rails.logger.info "[SyncToSharePoint] Uploaded #{attachment_result[:uploaded]} attachments"

    Rails.logger.info "[SyncToSharePoint] Completed for #{@credential.name}"

    {
      emails_synced: email_result[:total_synced],
      attachments_processed: attachment_result[:uploaded],
      attachments_created: attachment_result[:created],
      attachments_skipped: attachment_result[:skipped]
    }
  rescue StandardError => e
    Rails.logger.error "[SyncToSharePoint] Error: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    raise
  end

  private

  def sync_attachments_to_sharepoint
    uploaded = 0
    skipped = 0
    created = 0

    # Get recent emails with attachments from this org that haven't been uploaded yet
    sync_config = @credential.sync_config || {}
    user_emails = get_user_emails_for_org(sync_config)

    if user_emails.empty?
      Rails.logger.info "[SyncToSharePoint] No user emails configured"
      return { uploaded: 0, skipped: 0, created: 0 }
    end

    # Find emails with attachments from this org's mailboxes (both sent and received)
    # Use mailbox_owner_email to find emails that belong to this org
    emails_with_attachments = EmailWarehouse
      .where(microsoft_credential_id: @credential.id)
      .where(has_attachments: true)
      .where.not(mailbox_owner_email: nil)  # Only emails with mailbox owner tracked
      # .where("received_at >= ?", 30.days.ago) # Time filter commented out for historical data
      .order(received_at: :desc)
      .limit(100) # Limit for performance

    Rails.logger.info "[SyncToSharePoint] Found #{emails_with_attachments.count} emails with attachments"

    client = MicrosoftAppGraphClient.new(@credential)

    emails_with_attachments.each do |email|
      begin
        # Fetch attachments from Microsoft Graph API using the mailbox owner
        # (the mailbox where this email is stored, not the sender)
        attachments = client.get_email_attachments(email.mailbox_owner_email, email.outlook_id)

        attachments.each do |attachment_data|
          # Only process file attachments (skip inline/embedded)
          next unless attachment_data["@odata.type"] == "#microsoft.graph.fileAttachment"

          outlook_attachment_id = attachment_data["id"]
          filename = attachment_data["name"]
          content_type = attachment_data["contentType"]
          file_size = attachment_data["size"]
          content_bytes_base64 = attachment_data["contentBytes"]

          # Decode content
          content_binary = Base64.decode64(content_bytes_base64)
          content_hash = Attachment.compute_hash(content_binary)

          # Check if attachment already exists globally (by content_hash)
          existing_attachment = Attachment.find_by(content_hash: content_hash)

          if existing_attachment
            # File already exists in SharePoint - just create link
            link = EmailAttachment.find_or_create_by(
              email_warehouse: email,
              attachment: existing_attachment
            ) do |l|
              l.outlook_attachment_id = outlook_attachment_id
            end

            Rails.logger.info "[SyncToSharePoint] Linked existing attachment: #{filename} (#{content_hash[0..7]})"
            skipped += 1
          else
            # New file - upload to SharePoint
            result = upload_attachment_to_sharepoint(
              client,
              filename,
              content_binary,
              content_type,
              file_size,
              email.received_at
            )

            # Create attachment record
            attachment = Attachment.create!(
              sharepoint_file_id: result[:id],
              sharepoint_path: result[:path],
              filename: filename,
              content_type: content_type,
              file_size: file_size,
              content_hash: content_hash,
              organization_microsoft_app_credential: @credential
            )

            # Create link
            EmailAttachment.create!(
              email_warehouse: email,
              attachment: attachment,
              outlook_attachment_id: outlook_attachment_id
            )

            Rails.logger.info "[SyncToSharePoint] Uploaded new attachment: #{filename} (#{content_hash[0..7]})"
            created += 1
          end

          uploaded += 1
        end
      rescue StandardError => e
        Rails.logger.error "[SyncToSharePoint] Error processing email #{email.id}: #{e.message}"
        skipped += 1
      end
    end

    { uploaded: uploaded, skipped: skipped, created: created }
  end

  def get_user_emails_for_org(sync_config)
    if sync_config["sync_all"]
      # Get all users from tenant
      client = MicrosoftAppGraphClient.new(@credential)
      tenant_users = client.list_users(select: "mail,userPrincipalName")
      tenant_users.map { |u| u["mail"] || u["userPrincipalName"] }.compact
    else
      # Use configured user emails
      sync_config["user_emails"] || []
    end
  end

  def upload_attachment_to_sharepoint(client, filename, content, content_type, file_size, email_date)
    # Check SharePoint configuration (TEEEM's single SharePoint)
    sp_config = OrganizationMicrosoftAppCredential.teeem_sharepoint_config
    unless sp_config
      raise "SharePoint not configured. Please configure TEEEM's SharePoint site and drive."
    end

    # Use TEEEM's SharePoint credential for upload
    teeem_client = MicrosoftAppGraphClient.new(sp_config[:credential])

    # Build folder path: /Email Attachments/{org_name}/{year}/{month}
    folder_path = build_folder_path(email_date)

    # Build filename: {content_hash}_{original_filename}
    content_hash = Attachment.compute_hash(content)
    hash_prefix = content_hash[0..7]  # First 8 chars
    safe_filename = sanitize_filename(filename)
    final_filename = "#{hash_prefix}_#{safe_filename}"

    # Upload based on size (to TEEEM's SharePoint)
    if teeem_client.large_file?(file_size)
      # Large file upload (>= 4MB)
      Rails.logger.info "[SyncToSharePoint] Large file detected (#{file_size} bytes), using upload session"

      session = teeem_client.create_upload_session(
        sp_config[:site_id],
        sp_config[:drive_id],
        folder_path,
        final_filename
      )

      result = teeem_client.upload_large_file(session["uploadUrl"], content)
    else
      # Small file upload (< 4MB)
      result = teeem_client.upload_file_content(
        sp_config[:site_id],
        sp_config[:drive_id],
        folder_path,
        final_filename,
        content
      )
    end

    result
  end

  def build_folder_path(email_date)
    year = email_date.year
    month = email_date.strftime("%m")
    "#{@credential.attachment_root_path}/#{year}/#{month}"
  end

  def sanitize_filename(filename)
    # Remove or replace invalid SharePoint characters: <>:"/\|?*
    filename.gsub(/[<>:"\/\\|?*]/, "_")
  end
end
