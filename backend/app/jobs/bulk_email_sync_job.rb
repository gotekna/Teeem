# BulkEmailSyncJob - One-time bulk sync for large historical email imports
#
# Optimized for syncing 10+ years of emails (20,000+ emails, thousands of attachments)
# Features:
#   - No batch limits - processes ALL emails
#   - Progress tracking with checkpointing (resumes on failure)
#   - Memory-efficient batching with find_each
#   - Detailed progress logging
#   - Automatic resume from last successful email
#
# Usage:
#   BulkEmailSyncJob.perform_now(credential_id, sync_years: 10)
#   BulkEmailSyncJob.perform_now(credential_id, resume: true)  # Resume from checkpoint
#   BulkEmailSyncJob.perform_later(credential_id, sync_years: 10)
#
# Progress is stored in credential.bulk_sync_progress:
#   {
#     "status": "in_progress" | "completed" | "failed",
#     "started_at": "2024-01-01T00:00:00Z",
#     "last_checkpoint_at": "2024-01-01T01:00:00Z",
#     "emails_synced": 15000,
#     "emails_total": 20000,
#     "attachments_processed": 3000,
#     "attachments_uploaded": 2500,
#     "attachments_deduplicated": 500,
#     "last_processed_email_id": 12345,
#     "errors": []
#   }

class BulkEmailSyncJob < ApplicationJob
  queue_as :low

  # Batch sizes for memory efficiency
  EMAIL_BATCH_SIZE = 100
  CHECKPOINT_INTERVAL = 50  # Save progress every N emails

  def perform(credential_id, sync_years: 10, resume: false)
    # SSoT: Use MicrosoftCredential
    @credential = MicrosoftCredential.find_by(id: credential_id)

    unless @credential&.status == "connected"
      Rails.logger.info "[BulkSync] Skipping - org #{credential_id} not connected"
      return
    end

    # Initialize or resume progress tracking
    @progress = init_progress(sync_years, resume)
    save_progress!

    Rails.logger.info "[BulkSync] Starting bulk sync for #{@credential.name}"
    Rails.logger.info "[BulkSync] Sync years: #{sync_years}, Resume: #{resume}"

    begin
      # Phase 1: Sync emails from Outlook to EmailWarehouse
      unless @progress["phase1_complete"]
        sync_emails_to_warehouse(sync_years)
        @progress["phase1_complete"] = true
        save_progress!
      end

      # Phase 2: Upload attachments to SharePoint
      unless @progress["phase2_complete"]
        sync_attachments_to_sharepoint
        @progress["phase2_complete"] = true
        save_progress!
      end

      # Phase 3: Upload email .eml files to SharePoint
      # DISABLED - EML upload takes too long and times out on Heroku
      # unless @progress["phase3_complete"]
      #   sync_emails_to_sharepoint
      #   @progress["phase3_complete"] = true
      #   save_progress!
      # end

      # Mark complete
      @progress["status"] = "completed"
      @progress["completed_at"] = Time.current.iso8601
      save_progress!

      Rails.logger.info "[BulkSync] COMPLETED for #{@credential.name}"
      log_final_stats

      @progress
    rescue StandardError => e
      @progress["status"] = "failed"
      @progress["error"] = e.message
      @progress["failed_at"] = Time.current.iso8601
      save_progress!

      Rails.logger.error "[BulkSync] FAILED: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")
      raise
    end
  end

  private

  def init_progress(sync_years, resume)
    existing = @credential.bulk_sync_progress || {}

    if resume && existing["status"] == "in_progress"
      Rails.logger.info "[BulkSync] Resuming from checkpoint..."
      existing
    else
      {
        "status" => "in_progress",
        "started_at" => Time.current.iso8601,
        "sync_years" => sync_years,
        "phase1_complete" => false,
        "phase2_complete" => false,
        "phase3_complete" => false,
        "emails_synced" => 0,
        "emails_total" => 0,
        "attachments_processed" => 0,
        "attachments_uploaded" => 0,
        "attachments_deduplicated" => 0,
        "emails_uploaded_to_sharepoint" => 0,
        "last_processed_email_id" => nil,
        "last_processed_attachment_email_id" => nil,
        "last_uploaded_email_id" => nil,
        "errors" => []
      }
    end
  end

  def save_progress!
    @progress["last_checkpoint_at"] = Time.current.iso8601
    @credential.update_column(:bulk_sync_progress, @progress)
  end

  # Phase 1: Sync emails from Outlook to EmailWarehouse
  def sync_emails_to_warehouse(sync_years)
    Rails.logger.info "[BulkSync] Phase 1: Syncing emails to warehouse..."

    # Configure for full historical sync - MUST set sync_all: true for OrgEmailSyncJob
    original_config = @credential.sync_config || {}
    @credential.update!(
      sync_config: original_config.merge("sync_years" => sync_years, "sync_all" => true),
      last_sync_at: nil  # Force full sync
    )

    result = OrgEmailSyncJob.perform_now("full", org_name: @credential.name)

    # Handle nil result (job returned early - no users to sync)
    if result.nil?
      Rails.logger.warn "[BulkSync] OrgEmailSyncJob returned nil - no users configured?"
      @progress["emails_synced"] = 0
    else
      @progress["emails_synced"] = result[:total_synced]
    end
    @progress["emails_total"] = EmailWarehouse.where(microsoft_credential_id: @credential.id).count
    save_progress!

    Rails.logger.info "[BulkSync] Phase 1 complete: #{@progress["emails_synced"]} emails synced"
  end

  # Phase 2: Upload attachments to SharePoint
  def sync_attachments_to_sharepoint
    Rails.logger.info "[BulkSync] Phase 2: Uploading attachments to SharePoint..."

    # SSoT: Use MicrosoftCredential for SharePoint config
    sp_config = MicrosoftCredential.teeem_sharepoint_config
    unless sp_config
      raise "SharePoint not configured"
    end

    # Get emails with unprocessed attachments
    scope = EmailWarehouse
      .where(microsoft_credential_id: @credential.id)
      .where(has_attachments: true)
      .where.not(mailbox_owner_email: nil)
      .left_joins(:email_attachments)
      .where(email_attachments: { id: nil })
      .order(:id)

    # Resume from checkpoint if available
    if @progress["last_processed_attachment_email_id"]
      scope = scope.where("email_warehouse.id > ?", @progress["last_processed_attachment_email_id"])
    end

    total_to_process = scope.count
    Rails.logger.info "[BulkSync] Found #{total_to_process} emails with unprocessed attachments"

    # Force fresh token
    @credential.fetch_access_token!
    client = MicrosoftAppGraphClient.new(@credential)
    teeem_client = MicrosoftAppGraphClient.new(sp_config[:credential])

    processed = 0
    scope.find_each(batch_size: EMAIL_BATCH_SIZE) do |email|
      begin
        process_email_attachments(email, client, teeem_client, sp_config)
        @progress["last_processed_attachment_email_id"] = email.id
        processed += 1

        # Checkpoint periodically
        if processed % CHECKPOINT_INTERVAL == 0
          save_progress!
          log_attachment_progress(processed, total_to_process)
        end
      rescue StandardError => e
        log_error("attachment", email.id, e.message)
      end
    end

    save_progress!
    Rails.logger.info "[BulkSync] Phase 2 complete: #{@progress['attachments_uploaded']} uploaded, #{@progress['attachments_deduplicated']} deduplicated"
  end

  def process_email_attachments(email, client, teeem_client, sp_config)
    attachments = client.get_email_attachments(email.mailbox_owner_email, email.outlook_id)

    attachments.each do |attachment_data|
      # SSoT: Use EmailAttachmentFilterService for filtering signatures/embedded images
      if EmailAttachmentFilterService.should_skip?(attachment_data)
        Rails.logger.debug "[BulkSync] Skipping attachment: #{attachment_data['name']} (inline: #{attachment_data['isInline']}, size: #{attachment_data['size']})"
        next
      end

      outlook_attachment_id = attachment_data["id"]
      filename = attachment_data["name"]
      content_type = attachment_data["contentType"]
      file_size = attachment_data["size"]
      content_bytes_base64 = attachment_data["contentBytes"]

      content_binary = Base64.decode64(content_bytes_base64)
      content_hash = Attachment.compute_hash(content_binary)

      existing_attachment = Attachment.find_by(content_hash: content_hash)

      if existing_attachment
        # Deduplicate - just create link
        EmailAttachment.find_or_create_by(
          email_warehouse: email,
          attachment: existing_attachment
        ) do |ea|
          ea.outlook_attachment_id = outlook_attachment_id
          ea.filename = filename
          ea.sharepoint_path = existing_attachment.sharepoint_path
          ea.content_hash = content_hash
        end

        @progress["attachments_deduplicated"] += 1
      else
        # Upload new attachment
        result = upload_attachment(teeem_client, sp_config, filename, content_binary, content_type, file_size, email.received_at, content_hash)

        attachment = Attachment.create!(
          sharepoint_file_id: result[:id],
          sharepoint_path: result[:path],
          filename: filename,
          content_type: content_type,
          file_size: file_size,
          content_hash: content_hash,
          organization_microsoft_app_credential: @credential
        )

        EmailAttachment.create!(
          email_warehouse: email,
          attachment: attachment,
          outlook_attachment_id: outlook_attachment_id,
          filename: filename,
          sharepoint_path: result[:path],
          content_hash: content_hash
        )

        @progress["attachments_uploaded"] += 1
      end

      @progress["attachments_processed"] += 1
    end

    # Update attachment_count after processing all attachments for this email
    email.update!(attachment_count: email.email_attachments.count)
  end

  def upload_attachment(teeem_client, sp_config, filename, content, content_type, file_size, email_date, content_hash)
    year = email_date.year
    month = email_date.strftime("%m")
    # SSoT: Use centralized SharePoint path sanitization
    org_name = SharePoint::FilenameSanitizer.sanitize_path_segment(@credential.name)
    # SSoT: Get base path from StorageConfiguration
    base_path = StorageConfiguration.instance.path_for(:email_attachments)
    folder_path = "#{base_path}/#{org_name}/#{year}/#{month}"

    hash_prefix = content_hash[0..7]
    # SSoT: Use centralized SharePoint filename sanitization
    safe_filename = SharePoint::FilenameSanitizer.sanitize(filename)
    final_filename = "#{hash_prefix}_#{safe_filename}"

    result = if file_size >= 4 * 1024 * 1024
      session = teeem_client.create_upload_session(sp_config[:site_id], sp_config[:drive_id], folder_path, final_filename)
      teeem_client.upload_large_file(session["uploadUrl"], content)
    else
      teeem_client.upload_file_content(sp_config[:site_id], sp_config[:drive_id], folder_path, final_filename, content)
    end

    # Ensure path is always set (large file upload may not include it)
    result[:path] ||= "#{folder_path}/#{final_filename}"
    result
  end

  # Phase 3: Upload email .eml files to SharePoint
  def sync_emails_to_sharepoint
    Rails.logger.info "[BulkSync] Phase 3: Uploading emails to SharePoint..."

    # SSoT: Use MicrosoftCredential for SharePoint config
    sp_config = MicrosoftCredential.teeem_sharepoint_config
    unless sp_config
      Rails.logger.info "[BulkSync] SharePoint not configured, skipping email upload"
      return
    end

    scope = EmailWarehouse
      .where(microsoft_credential_id: @credential.id)
      .where(sharepoint_email_file_id: nil)
      .where.not(mailbox_owner_email: nil)
      .order(:id)

    # Resume from checkpoint
    if @progress["last_uploaded_email_id"]
      scope = scope.where("id > ?", @progress["last_uploaded_email_id"])
    end

    total_to_process = scope.count
    Rails.logger.info "[BulkSync] Found #{total_to_process} emails to upload"

    return if total_to_process == 0

    client = MicrosoftAppGraphClient.new(@credential)
    teeem_client = MicrosoftAppGraphClient.new(sp_config[:credential])

    processed = 0
    scope.find_each(batch_size: EMAIL_BATCH_SIZE) do |email|
      begin
        upload_email_to_sharepoint(email, client, teeem_client, sp_config)
        @progress["last_uploaded_email_id"] = email.id
        @progress["emails_uploaded_to_sharepoint"] += 1
        processed += 1

        # Checkpoint periodically
        if processed % CHECKPOINT_INTERVAL == 0
          save_progress!
          log_email_upload_progress(processed, total_to_process)
        end

        # Throttle to avoid rate limits (every 10 emails)
        sleep(0.1) if processed % 10 == 0
      rescue StandardError => e
        log_error("email_upload", email.id, e.message)
      end
    end

    save_progress!
    Rails.logger.info "[BulkSync] Phase 3 complete: #{@progress['emails_uploaded_to_sharepoint']} emails uploaded"
  end

  def upload_email_to_sharepoint(email, client, teeem_client, sp_config)
    mime_content = client.get_email_mime_content(email.mailbox_owner_email, email.outlook_id)

    year = email.received_at.year
    month = email.received_at.strftime("%m")
    # SSoT: Use centralized SharePoint path sanitization
    org_name = SharePoint::FilenameSanitizer.sanitize_path_segment(@credential.name)

    # SSoT: Get email storage path from EntityTab (system-managed)
    folder_path = email_storage_path(
      org_name: org_name,
      year: year,
      month: month,
      mailbox: email.mailbox_owner_email,
      date: email.received_at
    )
    filename = "#{email.id}.eml"

    result = if mime_content.bytesize >= 4 * 1024 * 1024
      session = teeem_client.create_upload_session(sp_config[:site_id], sp_config[:drive_id], folder_path, filename)
      teeem_client.upload_large_file(session["uploadUrl"], mime_content)
    else
      teeem_client.upload_file_content(sp_config[:site_id], sp_config[:drive_id], folder_path, filename, mime_content)
    end

    # Ensure path is always set (large file upload may not include it)
    result[:path] ||= "#{folder_path}/#{filename}"

    email.update!(
      sharepoint_email_file_id: result[:id],
      sharepoint_email_path: result[:path]
    )
  end

  def log_error(type, id, message)
    error = { "type" => type, "id" => id, "message" => message, "at" => Time.current.iso8601 }
    @progress["errors"] << error
    @progress["errors"] = @progress["errors"].last(100)  # Keep last 100 errors
    Rails.logger.error "[BulkSync] Error (#{type}) for #{id}: #{message}"
  end

  def log_attachment_progress(processed, total)
    pct = total > 0 ? (processed.to_f / total * 100).round(1) : 0
    Rails.logger.info "[BulkSync] Attachments: #{processed}/#{total} emails processed (#{pct}%) - #{@progress['attachments_uploaded']} uploaded, #{@progress['attachments_deduplicated']} deduplicated"
  end

  def log_email_upload_progress(processed, total)
    pct = total > 0 ? (processed.to_f / total * 100).round(1) : 0
    Rails.logger.info "[BulkSync] Email uploads: #{processed}/#{total} (#{pct}%)"
  end

  def log_final_stats
    duration = Time.current - Time.parse(@progress["started_at"])
    hours = (duration / 3600).floor
    minutes = ((duration % 3600) / 60).floor

    Rails.logger.info "=" * 60
    Rails.logger.info "[BulkSync] FINAL STATS for #{@credential.name}"
    Rails.logger.info "=" * 60
    Rails.logger.info "Duration: #{hours}h #{minutes}m"
    Rails.logger.info "Emails synced to warehouse: #{@progress['emails_synced']}"
    Rails.logger.info "Attachments processed: #{@progress['attachments_processed']}"
    Rails.logger.info "  - Uploaded (new): #{@progress['attachments_uploaded']}"
    Rails.logger.info "  - Deduplicated: #{@progress['attachments_deduplicated']}"
    Rails.logger.info "Emails uploaded to SharePoint: #{@progress['emails_uploaded_to_sharepoint']}"
    Rails.logger.info "Errors: #{@progress['errors'].count}"
    Rails.logger.info "=" * 60
  end

  # SSoT: Get email storage path from EntityTab (system-managed)
  # Resolves templates like: "{{UserName}}/{{Year}}/{{Date}}" or "{{Mailbox}}/{{Year}}/{{Month}}"
  # Falls back to hardcoded path if EntityTab doesn't exist
  #
  # Available placeholders:
  #   {{OrgName}}  - Organization name (sanitized)
  #   {{Year}}     - 4-digit year (e.g., "2025")
  #   {{Month}}    - 2-digit month (e.g., "01")
  #   {{Date}}     - Date in d-m-yy format (e.g., "9-12-25")
  #   {{Mailbox}}  - Email mailbox address (e.g., "robert@tekna.com.au")
  #   {{UserName}} - User's display name from mailbox (e.g., "Robert Harder")
  def email_storage_path(org_name:, year:, month:, mailbox: nil, date: nil)
    email_tab = EntityTab.find_by(scope: "email", tab_key: "email-storage")

    if email_tab&.storage_folder_path.present?
      # Derive user name from mailbox email
      user = mailbox.present? ? User.find_by("LOWER(email) = ?", mailbox.downcase) : nil
      user_name = user&.display_name || mailbox&.split("@")&.first&.titleize || "Unknown"

      # Format date as d-m-yy (e.g., "9-12-25") to match frontend preview
      formatted_date = date.present? ? date.strftime("%-d-%-m-%y") : ""

      # Resolve placeholders in the template
      email_tab.storage_folder_path
        .gsub("{{OrgName}}", org_name.to_s)
        .gsub("{{Year}}", year.to_s)
        .gsub("{{Month}}", month.to_s.rjust(2, "0"))
        .gsub("{{Date}}", formatted_date)
        .gsub("{{Mailbox}}", SharePoint::FilenameSanitizer.sanitize_path_segment(mailbox.to_s))
        .gsub("{{UserName}}", SharePoint::FilenameSanitizer.sanitize_path_segment(user_name))
    else
      # Fallback if EntityTab doesn't exist - use StorageConfiguration SSoT
      base_path = StorageConfiguration.instance.path_for(:email)
      "#{base_path}/#{org_name}/#{year}/#{month}"
    end
  end

end
