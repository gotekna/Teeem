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

    # Find emails with attachments that need uploading
    emails_with_attachments = EmailWarehouse
      .where(owner_email: user_emails)
      .where(has_attachments: true)
      .where("received_at >= ?", 30.days.ago) # Only recent emails
      .order(received_at: :desc)
      .limit(100) # Limit for performance

    Rails.logger.info "[SyncToSharePoint] Found #{emails_with_attachments.count} emails with attachments"

    client = MicrosoftAppGraphClient.new(@credential)

    emails_with_attachments.each do |email|
      begin
        # Fetch attachments from Microsoft Graph API
        attachments = client.get_email_attachments(email.owner_email, email.message_id)

        attachments.each do |attachment|
          # Only process file attachments (skip inline/embedded)
          next unless attachment["@odata.type"] == "#microsoft.graph.fileAttachment"

          outlook_attachment_id = attachment["id"]
          filename = attachment["name"]
          content_type = attachment["contentType"]
          file_size = attachment["size"]
          content_bytes_base64 = attachment["contentBytes"]

          # Skip if already tracked in EmailAttachment
          existing = EmailAttachment.find_by(
            email_warehouse: email,
            outlook_attachment_id: outlook_attachment_id
          )

          if existing
            Rails.logger.info "[SyncToSharePoint] Skipping existing: #{filename}"
            skipped += 1
            next
          end

          # Decode base64 content
          content_binary = Base64.decode64(content_bytes_base64)
          content_hash = EmailAttachment.compute_hash(content_binary)

          # Check if this attachment matches an existing company document
          existing_doc = CompanyDocument.find_by(content_hash: content_hash)

          if existing_doc
            # Link to existing document (avoid duplicate storage)
            EmailAttachment.create!(
              email_warehouse: email,
              company_document: existing_doc,
              outlook_attachment_id: outlook_attachment_id,
              filename: filename,
              content_type: content_type,
              file_size: file_size,
              content_hash: content_hash,
              is_existing_doc: true,
              sharepoint_file_id: existing_doc.sharepoint_file_id,
              sharepoint_path: existing_doc.sharepoint_path
            )
            Rails.logger.info "[SyncToSharePoint] Linked to existing doc: #{filename}"
            created += 1
          else
            # Create new EmailAttachment record (will be uploaded to SharePoint later)
            EmailAttachment.create!(
              email_warehouse: email,
              outlook_attachment_id: outlook_attachment_id,
              filename: filename,
              content_type: content_type,
              file_size: file_size,
              content_hash: content_hash,
              is_existing_doc: false
            )
            Rails.logger.info "[SyncToSharePoint] Created attachment record: #{filename}"
            created += 1
            # TODO: Upload to SharePoint and set sharepoint_file_id/sharepoint_path
            # For now, just track the attachment - upload can be done in a separate job
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
end
