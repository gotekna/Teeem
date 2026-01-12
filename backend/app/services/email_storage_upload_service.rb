# frozen_string_literal: true

# EmailStorageUploadService - SSoT for uploading emails to storage
#
# Provider-agnostic: Uses StorageConfiguration to determine Wasabi/S3 vs SharePoint
# Parallel processing: 20 threads for Wasabi (instant), sequential for SharePoint
#
# Usage:
#   service = EmailStorageUploadService.new(progress: progress)
#   result = service.upload_missing_emails
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
    emails = EmailWarehouse
      .where(sharepoint_email_path: [nil, ""])
      .where.not(outlook_id: [nil, ""])
      .where.not(mailbox_owner_email: [nil, ""])

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
    case @storage_config.provider_type
    when "wasabi", "s3"
      credential = S3CompatibleCredential.active.first
      unless credential
        Rails.logger.error "[EmailUpload] No active S3CompatibleCredential found"
        return nil
      end
      DocumentProviders::S3Compatible.new(credential)
    when "sharepoint"
      credential = MicrosoftCredential.sharepoint_credential
      unless credential
        Rails.logger.error "[EmailUpload] No active MicrosoftCredential found for SharePoint"
        return nil
      end
      DocumentProviders::SharePoint.new(credential)
    else
      Rails.logger.error "[EmailUpload] Unknown provider type: #{@storage_config.provider_type}"
      nil
    end
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error "[EmailUpload] Credential decryption failed - check encryption keys: #{e.message}"
    nil
  rescue => e
    Rails.logger.error "[EmailUpload] Failed to get storage provider: #{e.class} - #{e.message}"
    nil
  end

  # Parallel processing for S3/Wasabi (fast metadata operations)
  def upload_parallel(emails)
    require "concurrent"

    # Thread pool with 20 concurrent workers (S3 handles this easily)
    pool = Concurrent::FixedThreadPool.new(20)
    processed = Concurrent::AtomicFixnum.new(0)

    # Load all email IDs first (faster than find_each for parallel)
    email_ids = emails.pluck(:id)

    Rails.logger.info "[EmailUpload] Starting parallel processing with 20 threads"

    futures = email_ids.map do |email_id|
      Concurrent::Future.execute(executor: pool) do
        # Each thread gets its own DB connection
        ActiveRecord::Base.connection_pool.with_connection do
          upload_single_email(email_id)

          count = processed.increment
          if count % 500 == 0
            Rails.logger.info "[EmailUpload] Progress: #{count}/#{@stats[:total]}"
            @stats_mutex.synchronize do
              @progress&.update!(processed_count: count)
            end
          end
        end
      end
    end

    # Wait for all to complete
    futures.each(&:wait)
    pool.shutdown
    pool.wait_for_termination

    Rails.logger.info "[EmailUpload] Parallel processing complete"
  end

  # Sequential processing for SharePoint (rate limited)
  def upload_sequential(emails)
    emails.find_each.with_index do |email, index|
      @progress&.processing!(email.subject.to_s.truncate(50))
      upload_single_email(email.id)

      if (index + 1) % 100 == 0
        Rails.logger.info "[EmailUpload] Progress: #{index + 1}/#{@stats[:total]}"
      end
    end
  end

  def upload_single_email(email_id)
    email = EmailWarehouse.find_by(id: email_id)
    return unless email

    # Skip if already uploaded
    if email.sharepoint_email_path.present?
      increment_skipped!
      @progress&.increment!(success: true)
      return
    end

    # Get credential for this email
    credential = get_credential_for_email(email)
    unless credential&.connected?
      skip_email(email, "No valid credential")
      return
    end

    # Fetch .eml content from Graph API
    client = MicrosoftAppGraphClient.new(credential)
    mime_content = client.get_email_mime_content(email.mailbox_owner_email, email.outlook_id)

    unless mime_content.present?
      skip_email(email, "Could not fetch email content")
      return
    end

    # Build storage path
    year = email.received_at&.year || email.created_at.year
    month = (email.received_at || email.created_at).strftime("%m")
    base_path = @storage_config.path_for(:email) || "Emails/eml"
    folder_path = "#{base_path}/#{year}/#{month}"
    filename = "#{email.id}.eml"

    # Upload to storage
    result = @provider.upload_file(folder_path, mime_content, filename, content_type: "message/rfc822")

    # Update email record
    email.update!(
      sharepoint_email_path: result[:path],
      sharepoint_email_file_id: result[:id]
    )

    increment_uploaded!
    @progress&.increment!(success: true)
  rescue StandardError => e
    add_error!(email_id: email_id, error: e.message)
    @progress&.increment!(success: false, error: "Email #{email_id}: #{e.message}")
    Rails.logger.warn "[EmailUpload] Error uploading email #{email_id}: #{e.message}"
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
