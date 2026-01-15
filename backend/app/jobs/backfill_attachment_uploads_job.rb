# BackfillAttachmentUploadsJob - Upload existing EmailAttachment records to SharePoint
#
# This job migrates legacy EmailAttachment records (created before the schema refactor)
# to the new architecture where attachments are stored in SharePoint with deduplication.
#
# Usage:
#   BackfillAttachmentUploadsJob.perform_later(credential_id)
#
# This job:
# 1. Finds EmailAttachment records with attachment_id = nil (not yet migrated)
# 2. Fetches attachment content from Microsoft Graph API
# 3. Checks for existing attachment by content_hash (deduplication)
# 4. If new, uploads to TEEEM's SharePoint
# 5. Creates Attachment record and links via EmailAttachment
#
class BackfillAttachmentUploadsJob < ApplicationJob
  queue_as :low

  def perform(credential_id)
    # SSoT: Use MicrosoftCredential
    @credential = MicrosoftCredential.find_by(id: credential_id)

    unless @credential&.status == "connected"
      Rails.logger.info "[BackfillAttachments] Skipping - org #{credential_id} not connected"
      return
    end

    unless MicrosoftCredential.sharepoint_configured?
      Rails.logger.error "[BackfillAttachments] SharePoint not configured. Please configure TEEEM's SharePoint first."
      return
    end

    Rails.logger.info "[BackfillAttachments] Starting backfill for #{@credential.name}"

    # Get existing email_attachments records that haven't been migrated yet
    # Note: The old schema had these columns which were removed in the refactor migration:
    # - filename, content_type, file_size, content_hash, sharepoint_file_id, sharepoint_path
    # However, since attachment_id is now added, records with attachment_id = nil are pending migration
    #
    # IMPORTANT: This assumes the old columns still exist OR we're fetching from Graph API
    legacy_attachments = EmailAttachment
      .joins(:email_warehouse)
      .where(email_warehouse: { microsoft_credential_id: @credential.id })
      .where(attachment_id: nil)  # Not yet migrated

    total = legacy_attachments.count
    Rails.logger.info "[BackfillAttachments] Found #{total} attachments to process"

    return { uploaded: 0, skipped: 0, errors: 0 } if total.zero?

    uploaded = 0
    skipped = 0
    errors = 0

    sp_config = MicrosoftCredential.teeem_sharepoint_config
    teeem_client = MicrosoftAppGraphClient.new(sp_config[:credential])

    legacy_attachments.find_each do |legacy|
      begin
        email = legacy.email_warehouse

        # Fetch attachment content from Microsoft Graph API
        # Use the mailbox owner (where the email is stored)
        unless email.mailbox_owner_email.present?
          Rails.logger.warn "[BackfillAttachments] Skipping email #{email.id} - no mailbox_owner_email"
          errors += 1
          next
        end

        client = MicrosoftAppGraphClient.new(@credential)
        attachments = client.get_email_attachments(email.mailbox_owner_email, email.outlook_id)

        # Find the specific attachment by outlook_attachment_id
        attachment_data = attachments.find { |a| a["id"] == legacy.outlook_attachment_id }

        unless attachment_data
          Rails.logger.warn "[BackfillAttachments] Could not find attachment #{legacy.outlook_attachment_id} in email #{email.id}"
          errors += 1
          next
        end

        # SSoT: Use EmailAttachmentFilterService to skip signatures/embedded/non-file attachments
        if EmailAttachmentFilterService.should_skip?(attachment_data)
          Rails.logger.info "[BackfillAttachments] Skipping attachment: #{attachment_data['name']} (inline: #{attachment_data['isInline']}, size: #{attachment_data['size']})"
          skipped += 1
          next
        end

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
          # File already exists in SharePoint - just link it
          legacy.update!(attachment: existing_attachment)
          Rails.logger.info "[BackfillAttachments] Linked existing: #{filename} (#{content_hash[0..7]})"
          skipped += 1
        else
          # New file - upload to TEEEM's SharePoint
          result = upload_to_sharepoint(
            teeem_client,
            sp_config,
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

          # Link to email
          legacy.update!(attachment: attachment)

          Rails.logger.info "[BackfillAttachments] Uploaded new: #{filename} (#{content_hash[0..7]})"
          uploaded += 1
        end

        # Log progress every 10 files
        if (uploaded + skipped) % 10 == 0
          Rails.logger.info "[BackfillAttachments] Progress: #{uploaded + skipped}/#{total} (#{uploaded} uploaded, #{skipped} skipped, #{errors} errors)"
        end
      rescue StandardError => e
        Rails.logger.error "[BackfillAttachments] Error processing attachment #{legacy.id}: #{e.message}"
        Rails.logger.error e.backtrace[0..5].join("\n")
        errors += 1
      end
    end

    Rails.logger.info "[BackfillAttachments] Completed for #{@credential.name}: #{uploaded} uploaded, #{skipped} skipped, #{errors} errors"

    { uploaded: uploaded, skipped: skipped, errors: errors }
  rescue StandardError => e
    Rails.logger.error "[BackfillAttachments] Fatal error: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    raise
  end

  private

  def upload_to_sharepoint(client, sp_config, filename, content, content_type, file_size, email_date)
    # Build folder path: /emails/attachments/{org_name}/{year}/{month}
    folder_path = build_folder_path(email_date)

    # Build filename: {content_hash}_{original_filename}
    content_hash = Attachment.compute_hash(content)
    hash_prefix = content_hash[0..7]
    safe_filename = sanitize_filename(filename)
    final_filename = "#{hash_prefix}_#{safe_filename}"

    # Upload based on size (to TEEEM's SharePoint)
    if client.large_file?(file_size)
      Rails.logger.info "[BackfillAttachments] Large file detected (#{file_size} bytes), using upload session"

      session = client.create_upload_session(
        sp_config[:site_id],
        sp_config[:drive_id],
        folder_path,
        final_filename
      )

      client.upload_large_file(session["uploadUrl"], content)
    else
      client.upload_file_content(
        sp_config[:site_id],
        sp_config[:drive_id],
        folder_path,
        final_filename,
        content
      )
    end
  end

  def build_folder_path(email_date)
    year = email_date.year
    month = email_date.strftime("%m")
    "#{@credential.attachment_root_path}/#{year}/#{month}"
  end

  # SSoT: Use centralized SharePoint filename sanitization
  # See lib/sharepoint/filename_sanitizer.rb for rules
  def sanitize_filename(filename)
    SharePoint::FilenameSanitizer.sanitize(filename)
  end

end
