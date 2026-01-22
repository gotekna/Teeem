# frozen_string_literal: true

# EmailStorageUploadService - SSoT for uploading emails to storage
#
# Provider-agnostic: Uses StorageConfiguration to determine Wasabi/S3 vs SharePoint
# Parallel processing: 5 threads for Wasabi (instant), sequential for SharePoint
#
# Usage:
#   service = EmailStorageUploadService.new(progress: progress)
#   result = service.upload_missing_emails          # Fetch from Outlook → Wasabi
#   result = service.migrate_from_sharepoint        # Download SharePoint → Wasabi
#   # => { uploaded: 66489, skipped: 830, errors: [] }
#
# Background Job:
#   UploadEmailsToStorageJob.perform_later(batch_size: 1000)
#
class EmailStorageUploadService
  attr_reader :progress

  def initialize(progress: nil)
    @storage_config = StorageConfiguration.instance
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
    # Order by ID to ensure consistent ordering across batches
    emails = SyncedEmail
      .where(storage_path: [nil, ""])
      .where(storage_email_path: [nil, ""])
      .where.not(outlook_id: [nil, ""])
      .where.not(mailbox_owner_email: [nil, ""])
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
    DocumentProviders.for_organization(Organization.first)
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error "[EmailUpload] Credential decryption failed - check encryption keys: #{e.message}"
    nil
  rescue => e
    Rails.logger.error "[EmailUpload] Failed to get storage provider: #{e.class} - #{e.message}"
    nil
  end

  # Parallel processing for S3/Wasabi (fast metadata operations)
  # ⚠️ Graph API has MailboxConcurrency limits - use only 2 threads to avoid 429 throttling
  def upload_parallel(emails)
    require "concurrent"

    # Use only 2 threads to stay within Microsoft Graph API's MailboxConcurrency limit
    # Higher concurrency causes 429 "ApplicationThrottled" errors
    thread_count = 2
    pool = Concurrent::FixedThreadPool.new(thread_count)
    processed = Concurrent::AtomicFixnum.new(0)
    cancelled = Concurrent::AtomicBoolean.new(false)

    # Load all email IDs first (faster than find_each for parallel)
    email_ids = emails.pluck(:id)

    Rails.logger.info "[EmailUpload] Starting parallel processing with #{thread_count} threads for #{email_ids.count} emails"

    futures = email_ids.map do |email_id|
      Concurrent::Future.execute(executor: pool) do
        # Check if cancelled before processing
        next if cancelled.true?

        begin
          # Each thread gets its own DB connection
          ActiveRecord::Base.connection_pool.with_connection do
            upload_single_email(email_id)

            count = processed.increment

            # Rate limiting: small delay every 10 emails to avoid bursting Graph API
            sleep(0.1) if count % 10 == 0

            if count % 100 == 0
              Rails.logger.info "[EmailUpload] Progress: #{count}/#{@stats[:total]}"
              @stats_mutex.synchronize do
                @progress&.update!(processed_items: count)
                # Check for cancellation
                if @progress&.reload&.status == "cancelled"
                  Rails.logger.info "[EmailUpload] Job cancelled, stopping"
                  cancelled.make_true
                end
              end
            end
          end
        rescue => e
          Rails.logger.error "[EmailUpload] Future failed for email #{email_id}: #{e.class} - #{e.message}"
          add_error!(email_id: email_id, error: "Future: #{e.message}")
        end
      end
    end

    # Wait for all to complete and check for exceptions
    futures.each do |future|
      future.wait
      if future.rejected?
        Rails.logger.error "[EmailUpload] Future rejected: #{future.reason}"
      end
    end

    pool.shutdown
    pool.wait_for_termination(30) # 30 second timeout

    if cancelled.true?
      Rails.logger.info "[EmailUpload] Parallel processing stopped (cancelled)"
    else
      Rails.logger.info "[EmailUpload] Parallel processing complete. Processed: #{processed.value}/#{email_ids.count}"
    end
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

    # Check provider is available
    unless @provider
      Rails.logger.error "[EmailUpload] Email #{email_id} - No storage provider available!"
      skip_email(email, "No storage provider")
      return
    end

    # Build storage path
    year = email.received_at&.year || email.created_at.year
    month = (email.received_at || email.created_at).strftime("%m")
    base_path = @storage_config.path_for(:email)
    folder_path = "#{base_path}/#{year}/#{month}"
    filename = "#{email.id}.eml"

    # Upload to storage
    result = @provider.upload_file(folder_path, mime_content, filename, content_type: "message/rfc822")

    # Update email record with provider-agnostic storage columns
    # Use update_columns to bypass uniqueness validation on internet_message_id
    # (duplicates exist in DB, but we still want to upload their .eml files)
    email.update_columns(
      storage_path: result[:path],
      storage_file_id: result[:id],
      storage_email_path: result[:path],
      storage_email_file_id: result[:id]
    )

    # SSoT: Create WarehouseDocument for virtual folder rendering (Phase 4)
    # This enables the File Warehouse to show emails in folder structure
    create_warehouse_document_for_email(email, result[:path], mime_content.bytesize)

    Rails.logger.info "[EmailUpload] Email #{email_id} - SUCCESS: #{result[:path]}"
    increment_uploaded!
    @progress&.increment!(success: true)
  rescue StandardError => e
    add_error!(email_id: email_id, error: e.message)
    @progress&.increment!(success: false, error: "Email #{email_id}: #{e.message}")
    Rails.logger.error "[EmailUpload] Error uploading email #{email_id}: #{e.class} - #{e.message}"
    Rails.logger.error e.backtrace.first(3).join("\n")
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
  #
  # @param email [SyncedEmail] The email record
  # @param storage_path [String] The S3 path where the .eml file is stored
  # @param file_size [Integer] Size of the .eml file in bytes
  def create_warehouse_document_for_email(email, storage_path, file_size)
    # Skip if warehouse_document already exists
    return if email.warehouse_document.present?

    # Find or create StorageBlob for this file
    blob = StorageBlob.find_or_create_by!(storage_path: storage_path) do |b|
      b.content_hash = Digest::SHA256.hexdigest("#{email.id}-#{storage_path}")
      b.file_size = file_size
      b.original_filename = "#{email.id}.eml"
      b.content_type = "message/rfc822"
      b.reference_count = 0
    end

    # Create WarehouseDocument with virtual folder path
    WarehouseDocument.create!(
      documentable: email,
      storage_blob: blob,
      source_type: "email",
      folder: email.virtual_folder_path,
      display_name: email.subject.presence || "No Subject",
      original_filename: "#{email.id}.eml",
      metadata: {
        subject: email.subject,
        from_email: email.from_email,
        received_at: email.received_at&.iso8601,
        mailbox: email.mailbox_owner_email
      }
    )

    # Increment blob reference count
    blob.increment!(:reference_count)

    Rails.logger.debug "[EmailUpload] Created WarehouseDocument for email #{email.id} in folder: #{email.virtual_folder_path}"
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
