# frozen_string_literal: true

# EmailStorageUploadService - SSoT for uploading emails to storage
#
# Architecture (Jan 2026):
#   - Content-addressed storage: Files stored at Blobs/{hash-prefix}/{hash}.eml
#   - Deduplication: Same email content = same StorageBlob (saves space)
#   - Virtual folders: WarehouseDocument.folder_path stores UI path (e.g., "inbox@tekna.com.au/2026/01")
#   - Files NEVER move in S3 - only virtual folder paths change in database
#
# Provider-agnostic: Uses WarehouseProvider to determine Wasabi/S3 vs SharePoint
# Parallel processing: 2 threads (Microsoft Graph API MailboxConcurrency limit)
#
# Usage:
#   service = EmailStorageUploadService.new(progress: progress, tenant: tenant)
#   result = service.upload_missing_emails          # Fetch from Outlook → Wasabi
#   # => { uploaded: 66489, skipped: 830, errors: [] }
#
# Background Job:
#   UploadEmailsToStorageJob.perform_later(batch_size: 1000)
#
class EmailStorageUploadService
  attr_reader :progress, :tenant

  # SSoT: Requires explicit tenant or ActsAsTenant.current_tenant (Jan 2026 fix)
  def initialize(progress: nil, tenant: nil)
    @tenant = tenant || ActsAsTenant.current_tenant
    raise ::TenantNotFoundError, "Tenant required for EmailStorageUploadService" unless @tenant

    @storage_config = WarehouseProvider.for_tenant(@tenant)
    @provider = get_storage_provider
    @stats = { uploaded: 0, skipped: 0, errors: [], total: 0 }
    @stats_mutex = Mutex.new
    @progress = progress
  end

  # Thread-safe stat incrementers
  def increment_uploaded!
    @stats_mutex.synchronize { @stats[:uploaded] += 1 }
  end

  def increment_skipped!
    @stats_mutex.synchronize { @stats[:skipped] += 1 }
  end

  def add_error!(error_hash)
    @stats_mutex.synchronize { @stats[:errors] << error_hash }
  end

  def upload_missing_emails(batch_size: nil)
    # Find emails that need uploading
    # Must have outlook_id (to fetch from Graph API) and mailbox_owner_email (to know which mailbox)
    # Check both storage_path (new) and storage_email_path (legacy) columns
    # Exclude emails marked as content_unavailable (content cannot be retrieved from Microsoft)
    # Order by ID to ensure consistent ordering across batches
    emails = SyncedEmail
      .where(storage_path: [nil, ""])
      .where(storage_email_path: [nil, ""])
      .where.not(outlook_id: [nil, ""])
      .where.not(mailbox_owner_email: [nil, ""])
      .where(content_unavailable: false)  # SSoT: Skip permanently unavailable emails
      .order(:id)

    emails = emails.limit(batch_size) if batch_size.present?

    @stats[:total] = emails.count
    @progress&.set_total!(@stats[:total])

    Rails.logger.info "[EmailUpload] Starting upload of #{@stats[:total]} emails to #{@storage_config.provider_type}"

    return @stats if @stats[:total] == 0

    unless @provider
      fail_progress("No storage provider available")
      return error_result("No storage provider available")
    end

    if @storage_config.wasabi? || @storage_config.s3?
      upload_parallel(emails)
    else
      upload_sequential(emails)
    end

    complete_progress
    Rails.logger.info "[EmailUpload] Completed: #{@stats}"
    @stats
  rescue StandardError => e
    Rails.logger.error "[EmailUpload] Error: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    fail_progress(e.message)
    { success: false, error: e.message, stats: @stats }
  end

  private

  def error_result(message)
    Rails.logger.error "[EmailUpload] #{message}"
    { success: false, error: message, stats: @stats }
  end

  def get_storage_provider
    # SSoT: Use tenant for provider (Jan 2026 fix)
    DocumentProviders.for_tenant(@tenant)
  rescue ::TenantNotFoundError => e
    Rails.logger.error "[EmailUpload] No tenant for storage provider: #{e.message}"
    nil
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error "[EmailUpload] Credential decryption failed - check encryption keys: #{e.message}"
    nil
  rescue StandardError => e
    Rails.logger.error "[EmailUpload] Failed to get storage provider: #{e.class} - #{e.message}"
    nil
  end

  # Batch + Parallel processing for S3/Wasabi
  # FRC (Jan 2026): Optimized from individual HTTP calls to batch processing
  # - Batch fetch: 20 emails per Graph API call (was: 1 per call)
  # - 4 upload threads (was: 2) - S3 uploads don't hit Graph API limits
  # - Proper 429 handling in Graph client (was: crude sleep(0.1))
  # Result: ~10x faster (250 emails in ~30s instead of ~5 min)
  def upload_parallel(emails)
    require "concurrent"

    # Load emails with required fields for batching
    email_records = emails.select(:id, :mailbox_owner_email, :outlook_id, :microsoft_credential_id, :subject)
                          .to_a

    Rails.logger.info "[EmailUpload] Starting optimized batch processing for #{email_records.count} emails"

    # Step 1: Group emails by credential for efficient batching
    emails_by_credential = email_records.group_by { |e| e.microsoft_credential_id }

    # Step 2: Batch fetch MIME content from Graph API (biggest optimization)
    mime_contents = {}
    emails_by_credential.each do |cred_id, cred_emails|
      credential = cred_id ? MicrosoftCredential.find_by(id: cred_id) : MicrosoftCredential.active_credential
      next unless credential&.connected?

      begin
        client = MicrosoftAppGraphClient.new(credential)

        # Build batch requests (20 per API call)
        batch_requests = cred_emails.map do |email|
          { user_email: email.mailbox_owner_email, message_id: email.outlook_id, email_id: email.id }
        end

        Rails.logger.info "[EmailUpload] Batch fetching #{batch_requests.count} emails via credential #{cred_id || 'default'}"

        # This makes ceil(N/20) HTTP calls instead of N calls
        batch_results = client.batch_get_email_mime_content(batch_requests)

        # Map results back to email IDs
        batch_requests.each do |req|
          key = "#{req[:user_email]}:#{req[:message_id]}"
          mime_contents[req[:email_id]] = batch_results[key]
        end
      rescue => e
        Rails.logger.error "[EmailUpload] Batch fetch failed for credential #{cred_id}: #{e.message}"
        # Mark all emails in this batch as failed
        cred_emails.each { |email| add_error!(email_id: email.id, error: "Batch fetch: #{e.message}") }
      end
    end

    Rails.logger.info "[EmailUpload] Batch fetch complete: #{mime_contents.count} emails fetched"

    # Step 3: Upload to S3 in parallel (4 threads - S3 can handle more concurrency)
    thread_count = 4
    pool = Concurrent::FixedThreadPool.new(thread_count)
    processed = Concurrent::AtomicFixnum.new(0)
    cancelled = Concurrent::AtomicBoolean.new(false)

    futures = email_records.map do |email|
      Concurrent::Future.execute(executor: pool) do
        next if cancelled.true?

        begin
          ActiveRecord::Base.connection_pool.with_connection do
            ActsAsTenant.with_tenant(@tenant) do
              mime_content = mime_contents[email.id]
              upload_email_with_content(email.id, mime_content)
            end

            count = processed.increment
            if count % 50 == 0
              Rails.logger.info "[EmailUpload] Progress: #{count}/#{@stats[:total]}"
              @stats_mutex.synchronize do
                @progress&.update!(processed_items: count)
                if @progress&.reload&.status == "cancelled"
                  Rails.logger.info "[EmailUpload] Job cancelled, stopping"
                  cancelled.make_true
                end
              end
            end
          end
        rescue => e
          Rails.logger.error "[EmailUpload] Upload failed for email #{email.id}: #{e.class} - #{e.message}"
          add_error!(email_id: email.id, error: "Upload: #{e.message}")
        end
      end
    end

    # Wait for all uploads to complete
    futures.each do |future|
      future.wait
      Rails.logger.error "[EmailUpload] Future rejected: #{future.reason}" if future.rejected?
    end

    pool.shutdown
    pool.wait_for_termination(60)

    if cancelled.true?
      Rails.logger.info "[EmailUpload] Batch processing stopped (cancelled)"
    else
      Rails.logger.info "[EmailUpload] Batch processing complete. Processed: #{processed.value}/#{email_records.count}"
    end
  end

  # Upload a single email when MIME content is already fetched
  def upload_email_with_content(email_id, mime_content)
    email = SyncedEmail.find_by(id: email_id)
    return unless email

    # Skip if already uploaded
    if email.storage_path.present? || email.storage_email_path.present?
      increment_skipped!
      @progress&.increment!(success: true)
      return
    end

    # Handle batch fetch errors
    if mime_content.is_a?(Hash) && mime_content[:error]
      handle_fetch_error(email, mime_content[:error], mime_content[:status])
      return
    end

    # No content fetched
    unless mime_content.present?
      skip_email(email, "No MIME content from batch fetch")
      return
    end

    # Upload to StorageBlob (content-addressed)
    blob = StorageBlob.find_or_create_for_content!(
      mime_content,
      filename: "#{email.id}.eml",
      content_type: "message/rfc822"
    )

    email.update_columns(
      storage_path: blob.storage_path,
      storage_file_id: blob.id.to_s,
      storage_email_path: blob.storage_path,
      storage_email_file_id: blob.id.to_s
    )

    create_warehouse_document_for_email(email, blob)

    increment_uploaded!
    @progress&.increment!(success: true)
  rescue => e
    add_error!(email_id: email_id, error: e.message)
    @progress&.increment!(success: false, error: "Email #{email_id}: #{e.message}")
  end

  # Handle errors from batch fetch
  def handle_fetch_error(email, error_msg, status)
    permanent_error_patterns = [
      /ErrorItemNotFound/i, /ErrorInvalidUser/i, /MailboxNotEnabledForRESTAPI/i,
      /ErrorMailboxNotFound/i, /ResourceNotFound/i, /ErrorAccessDenied/i
    ]

    if permanent_error_patterns.any? { |p| error_msg.match?(p) } || status == 404
      mark_email_content_unavailable!(email, error_msg)
    else
      add_error!(email_id: email.id, error: error_msg)
    end
    @progress&.increment!(success: false, error: "Email #{email.id}: #{error_msg}")
  end

  # Sequential processing for SharePoint (rate limited)
  def upload_sequential(emails)
    emails.find_each.with_index do |email, index|
      # Check for cancellation every 100 emails
      if (index + 1) % 100 == 0
        if @progress&.reload&.status == "cancelled"
          Rails.logger.info "[EmailUpload] Job cancelled, stopping"
          break
        end
        Rails.logger.info "[EmailUpload] Progress: #{index + 1}/#{@stats[:total]}"
      end

      @progress&.processing!(email.subject.to_s.truncate(50))
      upload_single_email(email.id)
    end
  end

  def upload_single_email(email_id)
    email = SyncedEmail.find_by(id: email_id)
    unless email
      Rails.logger.warn "[EmailUpload] Email #{email_id} not found"
      return
    end

    # Skip if already uploaded (check both new and legacy columns)
    if email.storage_path.present? || email.storage_email_path.present?
      Rails.logger.info "[EmailUpload] Email #{email_id} already has path: #{email.email_storage_path}"
      increment_skipped!
      @progress&.increment!(success: true)
      return
    end

    # Get credential for this email
    credential = get_credential_for_email(email)
    unless credential&.connected?
      Rails.logger.warn "[EmailUpload] Email #{email_id} - No valid credential (cred_id=#{credential&.id}, connected=#{credential&.connected?})"
      skip_email(email, "No valid credential")
      return
    end

    # Fetch .eml content from Graph API
    Rails.logger.info "[EmailUpload] Email #{email_id} - Fetching content from #{email.mailbox_owner_email}"
    client = MicrosoftAppGraphClient.new(credential)
    mime_content = client.get_email_mime_content(email.mailbox_owner_email, email.outlook_id)

    unless mime_content.present?
      Rails.logger.warn "[EmailUpload] Email #{email_id} - Could not fetch content"
      skip_email(email, "Could not fetch email content")
      return
    end

    Rails.logger.info "[EmailUpload] Email #{email_id} - Got #{mime_content.bytesize} bytes, uploading..."

    # SSoT: Use StorageBlob for content-addressed storage (Jan 2026 fix)
    # Files stored at Blobs/{hash-prefix}/{hash}.eml for deduplication
    # Virtual folders in WarehouseDocument.folder_path enable UI organization
    blob = ActsAsTenant.with_tenant(@tenant) do
      StorageBlob.find_or_create_for_content!(
        mime_content,
        filename: "#{email.id}.eml",
        content_type: "message/rfc822"
      )
    end

    # Update email record with content-addressed path
    # Use update_columns to bypass uniqueness validation on internet_message_id
    # (duplicates exist in DB, but we still want to upload their .eml files)
    email.update_columns(
      storage_path: blob.storage_path,
      storage_file_id: blob.id.to_s,
      storage_email_path: blob.storage_path,
      storage_email_file_id: blob.id.to_s
    )

    # SSoT: Create WarehouseDocument for virtual folder rendering (Phase 4)
    # This enables the File Warehouse to show emails in folder structure
    # Virtual folder path (e.g., "inbox@tekna.com.au/Email Body/2026/01")
    # is stored in WarehouseDocument.folder_path - files never move in S3
    create_warehouse_document_for_email(email, blob)

    Rails.logger.info "[EmailUpload] Email #{email_id} - SUCCESS: #{blob.storage_path}"
    increment_uploaded!
    @progress&.increment!(success: true)
  rescue StandardError => e
    error_message = e.message

    # SSoT: Detect permanent Microsoft Graph errors (content cannot be retrieved)
    # These errors indicate the email or mailbox no longer exists in Microsoft 365
    # Note: Token refresh happens within with_retry, so if we get here, token isn't the issue
    permanent_error_patterns = [
      /ErrorItemNotFound/i,           # Email deleted from O365
      /ErrorInvalidUser/i,            # User account removed
      /MailboxNotEnabledForRESTAPI/i, # Mailbox disabled/soft-deleted
      /ErrorMailboxNotFound/i,        # Mailbox doesn't exist
      /ResourceNotFound/i,            # Resource (email/user) not found
      /MailboxMoveInProgress/i,       # Mailbox being migrated (retry later won't help if done)
      /ErrorAccessDenied/i,           # No permission to mailbox (credential lacks access)
    ]

    if permanent_error_patterns.any? { |pattern| error_message.match?(pattern) }
      # Mark as permanently unavailable to stop future retry attempts
      mark_email_content_unavailable!(email, error_message)
      Rails.logger.warn "[EmailUpload] Email #{email_id} marked as content_unavailable: #{error_message}"
    else
      # Transient error - will be retried on next batch
      add_error!(email_id: email_id, error: error_message)
      Rails.logger.error "[EmailUpload] Error uploading email #{email_id}: #{e.class} - #{error_message}"
      Rails.logger.error e.backtrace.first(3).join("\n")
    end

    @progress&.increment!(success: false, error: "Email #{email_id}: #{error_message}")
  end

  # Mark email as permanently unavailable (content cannot be retrieved from Microsoft)
  # Uses update_columns to bypass validations (duplicates may exist)
  def mark_email_content_unavailable!(email, reason)
    return unless email

    # Extract the error code from the message (e.g., "ErrorItemNotFound" from "...ErrorItemNotFound...")
    error_code = reason.match(/(Error\w+|MailboxNotEnabledForRESTAPI|ResourceNotFound)/i)&.[](1) || "Unknown"

    email.update_columns(
      content_unavailable: true,
      content_unavailable_reason: error_code
    )
    increment_skipped!  # Count as skipped, not error (won't be retried)
  end

  # SSoT: Get credential for an email
  # Priority: 1. Credential linked to email, 2. Any connected app credential
  def get_credential_for_email(email)
    # Try the credential that synced this email first
    if email.microsoft_credential_id.present?
      credential = MicrosoftCredential.find_by(id: email.microsoft_credential_id)
      return credential if credential&.connected?
    end

    # Fall back to any connected credential
    MicrosoftCredential.active_credential
  end

  def skip_email(email, reason)
    increment_skipped!
    @progress&.increment!(success: true) # Skipped counts as success
    Rails.logger.debug "[EmailUpload] Skipping email #{email.id}: #{reason}"
  end

  # SSoT: Create WarehouseDocument for email (Phase 4: Virtual File Warehouse)
  # This enables emails to appear in the File Warehouse folder structure.
  # The folder column is set to the virtual_folder_path, enabling instant reorganization.
  # Physical storage is content-addressed (Blobs/{hash}.eml) - virtual folders are DB-only.
  #
  # ⚠️ RACE CONDITION HANDLING (Jan 2026):
  # Parallel processing can cause two threads to create WarehouseDocument for the same email.
  # Use find_or_create_by! to handle this gracefully.
  #
  # @param email [SyncedEmail] The email record
  # @param blob [StorageBlob] The blob containing the .eml file (already uploaded)
  def create_warehouse_document_for_email(email, blob)
    # Skip if warehouse_document already exists (fast path)
    return if email.warehouse_document.present?

    # SSoT: Use find_or_create_by! to handle race conditions
    # Unique constraint is on (documentable_type, documentable_id)
    doc = WarehouseDocument.find_or_create_by!(
      documentable_type: "SyncedEmail",
      documentable_id: email.id
    ) do |d|
      d.storage_blob = blob
      d.source_type = "email"
      d.ui_name = email.subject.presence || "No Subject"  # SSoT: display_name renamed to ui_name (Feb 2026)
      d.original_filename = "#{email.id}.eml"
      d.tenant_id = @tenant.id  # SSoT: Always set tenant for multi-tenant support
      d.metadata = {
        subject: email.subject,
        from_email: email.from_email,
        received_at: email.received_at&.iso8601,
        mailbox: email.mailbox_owner_email
      }
    end

    # Only increment reference count if we created a new document
    # previously_new_record? returns true if this record was just created by find_or_create_by!
    if doc.previously_new_record?
      blob.increment!(:reference_count)
      Rails.logger.debug "[EmailUpload] Created WarehouseDocument for email #{email.id} in folder: #{email.virtual_folder_path}"
    else
      Rails.logger.debug "[EmailUpload] WarehouseDocument already exists for email #{email.id}"
    end
  rescue ActiveRecord::RecordNotUnique => e
    # Race condition fallback: another thread created the document between find and create
    Rails.logger.info "[EmailUpload] WarehouseDocument race condition for email #{email.id}, already created by another thread"
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error "[EmailUpload] Failed to create WarehouseDocument for email #{email.id}: #{e.message}"
  end

  # Progress tracking helpers
  def complete_progress
    return unless @progress
    message = "Uploaded #{@stats[:uploaded]} emails, skipped #{@stats[:skipped]}"
    message += ", #{@stats[:errors].count} errors" if @stats[:errors].any?
    @progress.complete!(message: message)
  end

  def fail_progress(message)
    return unless @progress
    @progress.fail!(message: message)
  end
end
