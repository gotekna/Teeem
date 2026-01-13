# frozen_string_literal: true

# EmailAttachmentMigrationService - Migrate email attachments from SharePoint to Wasabi
#
# Downloads attachments from SharePoint and uploads to Wasabi with deduplication
# via StorageBlob. Same attachment sent to multiple users = 1 storage copy.
#
# IMPORTANT: Uses TEEEM SharePoint site's Documents drive.
#
# Usage:
#   service = EmailAttachmentMigrationService.new
#   result = service.migrate_attachments(batch_size: 100)
#   # => { migrated: 50, skipped: 10, deduplicated: 20, errors: [] }
#
class EmailAttachmentMigrationService
  # TEEEM SharePoint site ID
  TEEEM_SITE_ID = "gotekna.sharepoint.com,d551d458-8c0e-4e22-98b0-434ba9b0e85d,5892a9c8-67f7-4d87-92ca-b1c9a6dd327c"

  attr_reader :stats

  def initialize(progress: nil)
    @stats = { migrated: 0, skipped: 0, deduplicated: 0, errors: [], total: 0 }
    @stats_mutex = Mutex.new
    @progress = progress
  end

  def migrate_attachments(batch_size: nil)
    # Find attachments that need migration (have SharePoint path but no blob)
    attachments = EmailAttachment
      .where(storage_blob_id: nil)
      .where.not(sharepoint_path: [nil, ""])
      .order(:id)

    attachments = attachments.limit(batch_size) if batch_size.present?

    @stats[:total] = attachments.count
    @progress&.set_total!(@stats[:total])

    Rails.logger.info "[AttachmentMigration] Starting migration of #{@stats[:total]} attachments"

    return @stats if @stats[:total] == 0

    # Get providers
    @sharepoint_provider = get_sharepoint_provider
    unless @sharepoint_provider
      message = "Failed to get SharePoint provider"
      Rails.logger.error "[AttachmentMigration] #{message}"
      @progress&.fail!(message: message)
      return { success: false, error: message, stats: @stats }
    end

    # Process sequentially (SharePoint has rate limits)
    attachments.find_each.with_index do |attachment, index|
      migrate_single_attachment(attachment)

      if (index + 1) % 50 == 0
        Rails.logger.info "[AttachmentMigration] Progress: #{index + 1}/#{@stats[:total]}"
        @progress&.update!(processed_count: index + 1)
      end
    end

    @progress&.complete!(message: "Migrated #{@stats[:migrated]}, deduplicated #{@stats[:deduplicated]}, errors #{@stats[:errors].count}")
    Rails.logger.info "[AttachmentMigration] Completed: #{@stats}"
    @stats
  rescue StandardError => e
    Rails.logger.error "[AttachmentMigration] Error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    @progress&.fail!(message: e.message)
    { success: false, error: e.message, stats: @stats }
  end

  private

  def get_sharepoint_provider
    cred = MicrosoftCredential.sharepoint_credential
    return nil unless cred

    # Verify StorageConfiguration has drive_id (SSoT)
    storage_config = StorageConfiguration.instance
    unless storage_config&.drive_id.present?
      Rails.logger.error "[AttachmentMigration] StorageConfiguration missing drive_id"
      return nil
    end

    provider = DocumentProviders::SharePoint.new(cred)
    Rails.logger.info "[AttachmentMigration] Using drive: #{storage_config.drive_name} (#{storage_config.drive_id})"

    provider
  rescue => e
    Rails.logger.error "[AttachmentMigration] Failed to get SharePoint provider: #{e.message}"
    nil
  end

  def migrate_single_attachment(attachment)
    # Skip if already has blob
    if attachment.storage_blob_id.present?
      increment_skipped!
      return
    end

    # Check if we already have a blob with same content_hash (deduplication)
    if attachment.content_hash.present?
      existing_blob = StorageBlob.find_by(content_hash: attachment.content_hash)
      if existing_blob
        # Just link to existing blob - no download/upload needed!
        attachment.update!(storage_blob: existing_blob)
        existing_blob.increment_reference!
        increment_deduplicated!
        Rails.logger.info "[AttachmentMigration] Attachment #{attachment.id} deduplicated to blob #{existing_blob.id}"
        return
      end
    end

    # Download from SharePoint
    content = download_from_sharepoint(attachment)
    unless content
      add_error!(attachment_id: attachment.id, error: "Could not download from SharePoint")
      return
    end

    # Store with deduplication (this handles upload + blob creation)
    # Note: content_type is derived from filename by StorageBlob
    attachment.store_content!(
      content,
      filename: attachment.filename
    )

    increment_migrated!
    Rails.logger.info "[AttachmentMigration] Attachment #{attachment.id} migrated"
  rescue StandardError => e
    add_error!(attachment_id: attachment.id, error: e.message)
    Rails.logger.error "[AttachmentMigration] Error migrating attachment #{attachment.id}: #{e.message}"
  end

  def download_from_sharepoint(attachment)
    # Download using path with case correction
    return nil unless attachment.sharepoint_path.present?

    path_variations = generate_path_variations(attachment.sharepoint_path)

    path_variations.each do |path|
      begin
        content = @sharepoint_provider.download_file(path)
        return content if content.present?
      rescue => e
        Rails.logger.debug "[AttachmentMigration] Path #{path} failed: #{e.message}"
      end
    end

    nil
  end

  def generate_path_variations(path)
    variations = [path]

    # emails/attachments/... -> Emails/Attachments/...
    if path.start_with?("emails/")
      variations << path.sub(/^emails\/attachments/, "Emails/Attachments")
      variations << path.sub(/^emails/, "Emails")
    end

    # Emails/Attachments/... -> emails/attachments/...
    if path.start_with?("Emails/")
      variations << path.sub(/^Emails\/Attachments/, "emails/attachments")
      variations << path.sub(/^Emails/, "emails")
    end

    # CRITICAL: Some files were stored with + instead of spaces in filenames
    # Add variations with spaces replaced by + in filename portion
    plus_variations = variations.map do |v|
      parts = v.split("/")
      filename = parts.last
      if filename.include?(" ")
        parts[0..-2].join("/") + "/" + filename.gsub(" ", "+")
      else
        nil
      end
    end.compact

    (variations + plus_variations).uniq
  end

  def increment_migrated!
    @stats_mutex.synchronize { @stats[:migrated] += 1 }
    @progress&.increment!(success: true)
  end

  def increment_skipped!
    @stats_mutex.synchronize { @stats[:skipped] += 1 }
    @progress&.increment!(success: true)
  end

  def increment_deduplicated!
    @stats_mutex.synchronize { @stats[:deduplicated] += 1 }
    @progress&.increment!(success: true)
  end

  def add_error!(error_hash)
    @stats_mutex.synchronize { @stats[:errors] << error_hash }
    @progress&.increment!(success: false, error: error_hash[:error])
  end
end
