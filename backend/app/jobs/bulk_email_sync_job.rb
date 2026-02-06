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
  include DocumentProviderAware

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
      # Phase 1: Sync emails from Outlook to SyncedEmail
      unless @progress["phase1_complete"]
        sync_emails_to_warehouse(sync_years)
        @progress["phase1_complete"] = true
        save_progress!
      end

      # Phase 2: Upload attachments to storage
      unless @progress["phase2_complete"]
        sync_attachments_to_storage
        @progress["phase2_complete"] = true
        save_progress!
      end

      # Phase 3: Upload email .eml files to storage
      # DISABLED - EML upload takes too long and times out on Heroku
      # unless @progress["phase3_complete"]
      #   sync_emails_to_storage
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

  # Phase 1: Sync emails from Outlook to SyncedEmail
  def sync_emails_to_warehouse(sync_years)
    Rails.logger.info "[BulkSync] Phase 1: Syncing emails to warehouse..."

    # Configure for full historical sync - MUST set sync_all: true for OrgEmailSyncJob
    original_config = @credential.sync_config || {}
    @credential.update!(
      sync_config: original_config.merge("sync_years" => sync_years, "sync_all" => true),
      last_sync_at: nil  # Force full sync
    )

    result = OrgEmailSyncJob.perform_now("full", org_name: @credential.name)

    # FRC (Jan 2026): Reload credential after long-running OrgEmailSyncJob
    # Root cause: During the sync (30+ mins), token refreshes update the credential's
    # lock_version in DB. Our @credential object becomes stale, causing StaleObjectError
    # on subsequent update! calls (like fetch_access_token! in Phase 2).
    @credential.reload

    # Handle nil result (job returned early - no users to sync)
    if result.nil?
      Rails.logger.warn "[BulkSync] OrgEmailSyncJob returned nil - no users configured?"
      @progress["emails_synced"] = 0
    else
      @progress["emails_synced"] = result[:total_synced]
    end
    @progress["emails_total"] = SyncedEmail.where(microsoft_credential_id: @credential.id).count
    save_progress!

    Rails.logger.info "[BulkSync] Phase 1 complete: #{@progress["emails_synced"]} emails synced"
  end

  # Phase 2: Upload attachments to storage (provider-agnostic)
  def sync_attachments_to_storage
    Rails.logger.info "[BulkSync] Phase 2: Uploading attachments to storage..."

    # SSoT: Use DocumentProviderAware for provider-agnostic storage
    setup_default_provider!
    unless document_provider_available?
      raise "Storage provider not configured"
    end

    # Get emails with unprocessed attachments
    # Note: email_attachments table DROPPED (Jan 2026) - use WarehouseDocument with source_type='email_attachment'
    scope = SyncedEmail
      .where(microsoft_credential_id: @credential.id)
      .where(has_attachments: true)
      .where.not(mailbox_owner_email: nil)
      .where("NOT EXISTS (SELECT 1 FROM warehouse_documents WHERE warehouse_documents.metadata->>'synced_email_id' = synced_emails.id::text AND warehouse_documents.source_type = 'email_attachment')")
      .order(:id)

    # Resume from checkpoint if available
    if @progress["last_processed_attachment_email_id"]
      scope = scope.where("synced_email.id > ?", @progress["last_processed_attachment_email_id"])
    end

    total_to_process = scope.count
    Rails.logger.info "[BulkSync] Found #{total_to_process} emails with unprocessed attachments"

    # Force fresh token for Graph API (to fetch attachments from Outlook)
    @credential.fetch_access_token!
    client = MicrosoftAppGraphClient.new(@credential)

    processed = 0
    scope.find_each(batch_size: EMAIL_BATCH_SIZE) do |email|
      begin
        process_email_attachments(email, client)
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

  # Note: email_attachments table DROPPED (Jan 2026) - use WarehouseDocument + StorageBlob
  def process_email_attachments(email, client)
    attachments = client.get_email_attachments(email.mailbox_owner_email, email.outlook_id)

    attachments.each do |attachment_data|
      # Filter out inline/embedded images (typically signatures)
      if attachment_data["isInline"] == true || attachment_data["contentId"].present?
        Rails.logger.debug "[BulkSync] Skipping inline attachment: #{attachment_data['name']}"
        next
      end

      filename = attachment_data["name"]
      content_type = attachment_data["contentType"]
      file_size = attachment_data["size"]
      content_bytes_base64 = attachment_data["contentBytes"]
      content_id = attachment_data["contentId"]  # For inline images

      content_binary = Base64.decode64(content_bytes_base64)
      content_hash = StorageBlob.compute_hash(content_binary)

      # SSoT: Use StorageBlob for deduplication (content-addressed storage)
      existing_blob = StorageBlob.find_by(content_hash: content_hash)

      if existing_blob
        # Deduplicate - just create WarehouseDocument link
        WarehouseDocument.find_or_create_by!(
          source_type: 'email_attachment',
          storage_blob_id: existing_blob.id,
          metadata: { 'synced_email_id' => email.id.to_s }
        ) do |doc|
          doc.documentable = email
          doc.ui_name = filename
          doc.original_filename = filename
          doc.folder = 'Emails/Attachments'
          doc.tenant_id = email.tenant_id
          doc.content_type = content_type || existing_blob.content_type
          doc.file_size = file_size || existing_blob.file_size
          doc.metadata = { 'synced_email_id' => email.id.to_s, 'content_id' => content_id }.compact
        end

        existing_blob.increment!(:reference_count)
        @progress["attachments_deduplicated"] += 1
      else
        # Upload new attachment via StorageBlob
        blob = StorageBlob.find_or_create_for_content!(
          content_binary,
          filename: filename,
          content_type: content_type
        )

        WarehouseDocument.create!(
          documentable: email,
          storage_blob_id: blob.id,
          ui_name: filename,  # SSoT: display_name renamed to ui_name (Feb 2026)
          original_filename: filename,
          folder: 'Emails/Attachments',
          source_type: 'email_attachment',
          tenant_id: email.tenant_id,
          content_type: content_type || blob.content_type,
          file_size: file_size || blob.file_size,
          metadata: { 'synced_email_id' => email.id.to_s, 'content_id' => content_id }.compact
        )

        blob.increment!(:reference_count)
        @progress["attachments_uploaded"] += 1
      end

      @progress["attachments_processed"] += 1
    end

    # Update attachment_count after processing all attachments for this email
    email.update!(attachment_count: email.attachment_documents.count)
  end

  def upload_attachment(filename, content, content_type, file_size, email_date, content_hash)
    year = email_date.year
    month = email_date.strftime("%m")
    # SSoT: Use centralized path sanitization
    org_name = SharePoint::FilenameSanitizer.sanitize_path_segment(@credential.name)
    # SSoT: Get base path from WarehouseProvider
    base_path = scope_folder_path(:email_attachments)
    folder_path = "#{base_path}/#{org_name}/#{year}/#{month}"

    hash_prefix = content_hash[0..7]
    # SSoT: Use centralized filename sanitization
    safe_filename = SharePoint::FilenameSanitizer.sanitize(filename)
    final_filename = "#{hash_prefix}_#{safe_filename}"

    # SSoT: Use provider-agnostic upload (provider handles large files automatically)
    result = upload_to_provider(folder_path, content, final_filename, content_type: content_type)

    # Ensure path is always set
    result[:path] ||= "#{folder_path}/#{final_filename}"
    result
  end

  # Phase 3: Upload email .eml files to storage (provider-agnostic)
  def sync_emails_to_storage
    Rails.logger.info "[BulkSync] Phase 3: Uploading emails to storage..."

    # SSoT: Use DocumentProviderAware for provider-agnostic storage
    # Provider was already set up in Phase 2, but ensure it's ready
    setup_default_provider! unless document_provider_available?
    unless document_provider_available?
      Rails.logger.info "[BulkSync] Storage provider not configured, skipping email upload"
      return
    end

    scope = SyncedEmail
      .where(microsoft_credential_id: @credential.id)
      .where(storage_email_file_id: nil)
      .where.not(mailbox_owner_email: nil)
      .order(:id)

    # Resume from checkpoint
    if @progress["last_uploaded_email_id"]
      scope = scope.where("id > ?", @progress["last_uploaded_email_id"])
    end

    total_to_process = scope.count
    Rails.logger.info "[BulkSync] Found #{total_to_process} emails to upload"

    return if total_to_process == 0

    # Graph API client to fetch email content from Outlook
    client = MicrosoftAppGraphClient.new(@credential)

    processed = 0
    scope.find_each(batch_size: EMAIL_BATCH_SIZE) do |email|
      begin
        upload_email_to_storage(email, client)
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

  def upload_email_to_storage(email, client)
    mime_content = client.get_email_mime_content(email.mailbox_owner_email, email.outlook_id)

    year = email.received_at.year
    month = email.received_at.strftime("%m")
    # SSoT: Use centralized path sanitization
    org_name = SharePoint::FilenameSanitizer.sanitize_path_segment(@credential.name)

    # SSoT: Get email storage path from WarehouseFolder (system-managed)
    folder_path = email_storage_path(
      org_name: org_name,
      year: year,
      month: month,
      mailbox: email.mailbox_owner_email,
      date: email.received_at
    )
    filename = "#{email.id}.eml"

    # SSoT: Use provider-agnostic upload (provider handles large files automatically)
    result = upload_to_provider(folder_path, mime_content, filename, content_type: "message/rfc822")

    # Ensure path is always set
    result[:path] ||= "#{folder_path}/#{filename}"

    email.update!(
      storage_email_file_id: result[:id],
      storage_email_path: result[:path]
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

  # SSoT (Feb 2026): Get email storage path from WarehouseFolder (system-managed)
  # Resolves templates like: "{{UserName}}/{{Year}}/{{Date}}" or "{{Mailbox}}/{{Year}}/{{Month}}"
  # Falls back to hardcoded path if WarehouseFolder doesn't exist
  #
  # Available placeholders:
  #   {{OrgName}}  - Organization name (sanitized)
  #   {{Year}}     - 4-digit year (e.g., "2025")
  #   {{Month}}    - 2-digit month (e.g., "01")
  #   {{Date}}     - Date in d-m-yy format (e.g., "9-12-25")
  #   {{Mailbox}}  - Email mailbox address (e.g., "robert@tekna.com.au")
  #   {{UserName}} - User's display name from mailbox (e.g., "Robert Harder")
  def email_storage_path(org_name:, year:, month:, mailbox: nil, date: nil)
    email_tab = WarehouseFolder.for_warehouse_type("email").find_by(tab_key: "email-storage")

    if email_tab&.full_folder_path.present?
      # Derive user name from mailbox email
      user = mailbox.present? ? User.find_by("LOWER(email) = ?", mailbox.downcase) : nil
      user_name = user&.display_name || mailbox&.split("@")&.first&.titleize || "Unknown"

      # Format date as d-m-yy (e.g., "9-12-25") to match frontend preview
      formatted_date = date.present? ? date.strftime("%-d-%-m-%y") : ""

      # Resolve placeholders in the template
      email_tab.full_folder_path
        .gsub("{{OrgName}}", org_name.to_s)
        .gsub("{{Year}}", year.to_s)
        .gsub("{{Month}}", month.to_s.rjust(2, "0"))
        .gsub("{{Date}}", formatted_date)
        .gsub("{{Mailbox}}", SharePoint::FilenameSanitizer.sanitize_path_segment(mailbox.to_s))
        .gsub("{{UserName}}", SharePoint::FilenameSanitizer.sanitize_path_segment(user_name))
    else
      # Fallback if WarehouseFolder doesn't exist - use WarehouseProvider SSoT
      base_path = WarehouseProvider.instance.path_for(:email)
      "#{base_path}/#{org_name}/#{year}/#{month}"
    end
  end

end
