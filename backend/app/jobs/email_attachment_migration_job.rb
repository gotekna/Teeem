# frozen_string_literal: true

# EmailAttachmentMigrationJob - Migrate single attachment from SharePoint to Wasabi
#
# Designed for parallel execution via SolidQueue. Each job handles ONE attachment,
# allowing multiple workers to process attachments concurrently.
#
# SharePoint API rate limit: ~10,000 requests per 10 minutes
# Safe concurrency: 5-10 workers (with retries)
#
# Usage:
#   # Single attachment
#   EmailAttachmentMigrationJob.perform_later(attachment_id)
#
#   # Batch enqueue (50 at a time for efficient queue management)
#   EmailAttachmentMigrationJob.enqueue_batch(1000)
#
#   # Monitor progress
#   EmailAttachmentMigrationJob.migration_status
#
class EmailAttachmentMigrationJob < ApplicationJob
  queue_as :default

  # Retry on transient SharePoint errors
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  class << self
    # Enqueue a batch of attachments for migration
    # @param limit [Integer] Max attachments to enqueue
    # @return [Integer] Number of jobs enqueued
    def enqueue_batch(limit = 1000)
      attachments = EmailAttachment
        .where(storage_blob_id: nil)
        .where.not(sharepoint_path: [nil, ""])
        .order(:id)
        .limit(limit)
        .pluck(:id)

      Rails.logger.info "[AttachmentMigrationJob] Enqueueing #{attachments.count} jobs"

      attachments.each do |id|
        perform_later(id)
      end

      attachments.count
    end

    # Check migration status
    def migration_status
      total = EmailAttachment.count
      migrated = EmailAttachment.where.not(storage_blob_id: nil).count
      pending = EmailAttachment.where(storage_blob_id: nil).where.not(sharepoint_path: [nil, ""]).count
      queued = SolidQueue::Job.where(class_name: "EmailAttachmentMigrationJob").where(finished_at: nil).count

      {
        total: total,
        migrated: migrated,
        pending: pending,
        queued_jobs: queued,
        progress_percent: (migrated.to_f / total * 100).round(1)
      }
    end
  end

  def perform(attachment_id)
    attachment = EmailAttachment.find_by(id: attachment_id)
    return unless attachment

    # Already migrated?
    return if attachment.storage_blob_id.present?

    # No SharePoint path?
    return if attachment.sharepoint_path.blank?

    Rails.logger.info "[AttachmentMigrationJob] Processing attachment #{attachment_id}"

    # Check for deduplication first
    if attachment.content_hash.present?
      existing_blob = StorageBlob.find_by(content_hash: attachment.content_hash)
      if existing_blob
        attachment.update!(storage_blob: existing_blob)
        existing_blob.increment_reference!
        Rails.logger.info "[AttachmentMigrationJob] Attachment #{attachment_id} deduplicated to blob #{existing_blob.id}"
        return
      end
    end

    # Get SharePoint provider
    provider = get_sharepoint_provider
    raise "Failed to get SharePoint provider" unless provider

    # Download from SharePoint (try path variations)
    content = download_from_sharepoint(provider, attachment)
    raise "Could not download attachment #{attachment_id} from SharePoint" unless content

    # Store with deduplication
    attachment.store_content!(content, filename: attachment.filename)

    Rails.logger.info "[AttachmentMigrationJob] Attachment #{attachment_id} migrated"
  end

  private

  def get_sharepoint_provider
    cred = MicrosoftCredential.sharepoint_credential
    return nil unless cred

    storage_config = StorageConfiguration.instance
    return nil unless storage_config&.drive_id.present?

    DocumentProviders::SharePoint.new(cred)
  end

  def download_from_sharepoint(provider, attachment)
    path_variations = generate_path_variations(attachment.sharepoint_path)

    path_variations.each do |path|
      begin
        content = provider.download_file(path)
        return content if content.present?
      rescue => e
        Rails.logger.debug "[AttachmentMigrationJob] Path #{path} failed: #{e.message}"
      end
    end

    nil
  end

  def generate_path_variations(path)
    variations = [path]

    # Case variations for folder names
    if path.start_with?("emails/")
      variations << path.sub(/^emails\/attachments/, "Emails/Attachments")
      variations << path.sub(/^emails/, "Emails")
    end

    if path.start_with?("Emails/")
      variations << path.sub(/^Emails\/Attachments/, "emails/attachments")
      variations << path.sub(/^Emails/, "emails")
    end

    # Some files were stored with + instead of spaces in filenames
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
end
