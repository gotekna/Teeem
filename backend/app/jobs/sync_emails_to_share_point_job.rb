# SyncEmailsToSharePointJob - Sync emails to EmailWarehouse and upload emails + attachments to SharePoint
#
# Usage:
#   SyncEmailsToSharePointJob.perform_later(credential_id)
#
# This job:
# 1. Syncs all emails from the org's users to EmailWarehouse using OrgEmailSyncJob
# 2. Uploads email attachments to SharePoint in folder structure: /Email Attachments/{org_name}/{year}/{month}/
# 3. Uploads email messages (.eml) to SharePoint in folder structure: /Emails/{org_name}/{year}/{month}/

class SyncEmailsToSharePointJob < ApplicationJob
  queue_as :low

  def perform(credential_id)
    @credential = OrganizationMicrosoftAppCredential.find_by(id: credential_id)

    unless @credential&.status == "connected"
      Rails.logger.info "[SyncToSharePoint] Skipping - org #{credential_id} not connected"
      return
    end

    Rails.logger.info "[SyncToSharePoint] Starting sync for #{@credential.name}"

    # Step 1: Sync emails to EmailWarehouse (use 'full' to respect sync_days config)
    # TEMPORARILY SKIPPED - there's a bug where running email sync before attachment processing
    # causes 404 errors even though manual tests work. Processing existing emails instead.
    # Rails.logger.info "[SyncToSharePoint] Step 1: Syncing emails to warehouse..."
    # email_result = OrgEmailSyncJob.perform_now("full", org_name: @credential.name)
    # Rails.logger.info "[SyncToSharePoint] Synced #{email_result[:total_synced]} emails"
    # @credential.reload
    email_result = { total_synced: 0 }
    Rails.logger.info "[SyncToSharePoint] Step 1: SKIPPED (processing existing emails)"

    # Step 2: Upload attachments to SharePoint
    Rails.logger.info "[SyncToSharePoint] Step 2: Uploading attachments to SharePoint..."
    attachment_result = sync_attachments_to_sharepoint
    Rails.logger.info "[SyncToSharePoint] Uploaded #{attachment_result[:uploaded]} attachments"

    # Step 3: Upload email messages to SharePoint
    Rails.logger.info "[SyncToSharePoint] Step 3: Uploading email messages to SharePoint..."
    email_upload_result = sync_emails_to_sharepoint
    Rails.logger.info "[SyncToSharePoint] Uploaded #{email_upload_result[:uploaded]} emails"

    Rails.logger.info "[SyncToSharePoint] Completed for #{@credential.name}"

    {
      emails_synced: email_result[:total_synced],
      attachments_processed: attachment_result[:uploaded],
      attachments_created: attachment_result[:created],
      attachments_skipped: attachment_result[:skipped],
      emails_uploaded: email_upload_result[:uploaded],
      emails_skipped: email_upload_result[:skipped]
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

    # TEMPORARILY SKIP user email fetching - directly process all emails with attachments for this org
    # This is to isolate the 404 bug

    # Find emails with attachments that haven't been processed yet
    # Simple approach: process emails where has_attachments=true but no EmailAttachment records exist
    emails_with_attachments = EmailWarehouse
      .where(microsoft_credential_id: @credential.id)
      .where(has_attachments: true)
      .where.not(mailbox_owner_email: nil)  # Only emails with mailbox owner tracked
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })  # No attachments processed yet
      .order(received_at: :desc)
      .limit(100) # Limit for performance

    Rails.logger.info "[SyncToSharePoint] Found #{emails_with_attachments.count} emails with unprocessed attachments"

    # Debug: Log which credential we're using for attachment fetch
    Rails.logger.info "[SyncToSharePoint] Creating client with credential ID #{@credential.id}, tenant: #{@credential.tenant_id}"
    # Force fresh token fetch before creating client
    @credential.fetch_access_token!
    client = MicrosoftAppGraphClient.new(@credential)
    Rails.logger.info "[SyncToSharePoint] Client created with fresh token, credential tenant: #{@credential.tenant_id}"

    emails_with_attachments.each do |email|
      begin
        # Debug: Log exactly what we're requesting
        Rails.logger.info "[SyncToSharePoint] Fetching attachments for email #{email.id}"
        Rails.logger.info "[SyncToSharePoint]   mailbox_owner_email: #{email.mailbox_owner_email}"
        Rails.logger.info "[SyncToSharePoint]   outlook_id: #{email.outlook_id}"
        Rails.logger.info "[SyncToSharePoint]   received_at: #{email.received_at}"
        Rails.logger.info "[SyncToSharePoint]   microsoft_credential_id: #{email.microsoft_credential_id}"

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
              l.filename = filename
              l.sharepoint_path = existing_attachment.sharepoint_path
              l.content_hash = content_hash
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

            # Create link with denormalized fields for easy viewing
            EmailAttachment.create!(
              email_warehouse: email,
              attachment: attachment,
              outlook_attachment_id: outlook_attachment_id,
              filename: filename,
              sharepoint_path: result[:path],
              content_hash: content_hash
            )

            Rails.logger.info "[SyncToSharePoint] Uploaded new attachment: #{filename} (#{content_hash[0..7]})"
            created += 1
          end

          uploaded += 1
        end

        # Update attachment_count after processing all attachments for this email
        email.update!(attachment_count: email.email_attachments.count)
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
    "Documents/Emails/Attachments/#{@credential.name}/#{year}/#{month}"
  end

  def sync_emails_to_sharepoint
    uploaded = 0
    skipped = 0

    # Check SharePoint configuration
    sp_config = OrganizationMicrosoftAppCredential.teeem_sharepoint_config
    unless sp_config
      Rails.logger.info "[SyncEmailsToSharePoint] SharePoint not configured, skipping email upload"
      return { uploaded: 0, skipped: 0 }
    end

    # Get emails from this org that haven't been uploaded yet
    # Simple approach: process emails without sharepoint_email_file_id
    emails_to_upload = EmailWarehouse
      .where(microsoft_credential_id: @credential.id)
      .where(sharepoint_email_file_id: nil)  # Not yet uploaded
      .where.not(mailbox_owner_email: nil)   # Only emails with mailbox owner tracked
      .order(received_at: :desc)
      .limit(100)  # Limit for performance

    Rails.logger.info "[SyncEmailsToSharePoint] Found #{emails_to_upload.count} emails to upload"

    return { uploaded: 0, skipped: 0 } if emails_to_upload.empty?

    client = MicrosoftAppGraphClient.new(@credential)
    teeem_client = MicrosoftAppGraphClient.new(sp_config[:credential])

    emails_to_upload.each do |email|
      begin
        # Skip if already uploaded
        if email.sharepoint_email_file_id.present?
          skipped += 1
          next
        end

        # Fetch email in MIME format (.eml)
        email_mime_content = client.get_email_mime_content(email.mailbox_owner_email, email.outlook_id)

        # Upload to SharePoint
        result = upload_email_to_sharepoint(
          teeem_client,
          email,
          email_mime_content
        )

        # Update email record with SharePoint file info
        email.update!(
          sharepoint_email_file_id: result[:id],
          sharepoint_email_path: result[:path]
        )

        Rails.logger.info "[SyncEmailsToSharePoint] Uploaded email #{email.id}: #{result[:path]}"
        uploaded += 1

        # Throttle to avoid rate limits
        sleep(0.1) if uploaded % 10 == 0
      rescue StandardError => e
        Rails.logger.error "[SyncEmailsToSharePoint] Error uploading email #{email.id}: #{e.message}"
        skipped += 1
      end
    end

    { uploaded: uploaded, skipped: skipped }
  end

  def upload_email_to_sharepoint(teeem_client, email, mime_content)
    sp_config = OrganizationMicrosoftAppCredential.teeem_sharepoint_config

    # Build folder path: Documents/Emails/eml/{org_name}/{year}/{month}
    year = email.received_at.year
    month = email.received_at.strftime("%m")
    folder_path = "Documents/Emails/eml/#{@credential.name}/#{year}/#{month}"

    # Build filename: {email_id}.eml
    filename = "#{email.id}.eml"

    # Upload email
    if mime_content.bytesize >= 4 * 1024 * 1024
      # Large email (>= 4MB) - use chunked upload
      session = teeem_client.create_upload_session(
        sp_config[:site_id],
        sp_config[:drive_id],
        folder_path,
        filename
      )
      result = teeem_client.upload_large_file(session["uploadUrl"], mime_content)
    else
      # Small email (< 4MB)
      result = teeem_client.upload_file_content(
        sp_config[:site_id],
        sp_config[:drive_id],
        folder_path,
        filename,
        mime_content
      )
    end

    result
  end

  def sanitize_filename(filename)
    # Remove or replace invalid SharePoint characters: <>:"/\|?*
    filename.gsub(/[<>:"\/\\|?*]/, "_")
  end
end
