# frozen_string_literal: true

# EmailAttachmentMigrationJob - Migrate single attachment from Microsoft Graph to Wasabi
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Downloads from Microsoft Graph API (primary)               ║
# ║  Falls back to SharePoint if Graph fails                          ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Designed for parallel execution via SolidQueue. Each job handles ONE attachment,
# allowing multiple workers to process attachments concurrently.
#
# Download priority:
#   1. Microsoft Graph API using outlook_attachment_id (SSoT for email attachments)
#   2. SharePoint using sharepoint_path (legacy fallback)
#
# Storage API rate limit: ~10,000 requests per 10 minutes
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
  include DocumentProviderAware

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
        .where.not(storage_path: [nil, ""])
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
      pending = EmailAttachment.where(storage_blob_id: nil).where.not(storage_path: [nil, ""]).count
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

    # SSoT: Try Microsoft Graph API first (primary source)
    content = download_from_graph(attachment)

    # Fallback to SharePoint if Graph fails and storage_path exists
    if content.blank? && attachment.storage_path.present?
      Rails.logger.info "[AttachmentMigrationJob] Graph failed, trying SharePoint for #{attachment_id}"
      begin
        setup_sharepoint_provider_for_migration!
        content = download_from_storage(attachment)
      rescue => e
        Rails.logger.debug "[AttachmentMigrationJob] SharePoint fallback failed: #{e.message}"
      end
    end

    unless content
      # Mark as unrecoverable if no source available
      if attachment.outlook_attachment_id.blank? && attachment.storage_path.blank?
        Rails.logger.warn "[AttachmentMigrationJob] Attachment #{attachment_id} has no source (no outlook_id, no storage_path) - marking unrecoverable"
        return  # Don't retry
      end

      # Check if it's a mailbox mismatch (unrecoverable)
      email = attachment.email_warehouse
      if email&.outlook_id.present? && attachment.outlook_attachment_id.present?
        email_prefix = email.outlook_id[0..35]
        att_prefix = attachment.outlook_attachment_id[0..35]
        if email_prefix != att_prefix
          Rails.logger.warn "[AttachmentMigrationJob] Attachment #{attachment_id} has mismatched mailbox - unrecoverable"
          return  # Don't retry
        end
      end

      raise "Could not download attachment #{attachment_id} from Graph or SharePoint"
    end

    # Store with deduplication
    attachment.store_content!(content, filename: attachment.filename)

    Rails.logger.info "[AttachmentMigrationJob] Attachment #{attachment_id} migrated"
  end

  private

  # SSoT: Download attachment from Microsoft Graph API
  # Uses parent email's outlook_id and the attachment's outlook_attachment_id
  #
  # IMPORTANT: The outlook_attachment_id must belong to the same mailbox as the email's outlook_id.
  # The first ~36 chars of both IDs contain the mailbox identifier - they must match.
  # If mismatched, Graph API returns "Item doesn't belong to the targeted mailbox".
  def download_from_graph(attachment)
    return nil if attachment.outlook_attachment_id.blank?

    email = attachment.email_warehouse
    return nil unless email&.outlook_id.present? && email&.mailbox_owner_email.present?

    # Verify mailbox IDs match - first 36 chars contain mailbox identifier
    email_mailbox_prefix = email.outlook_id[0..35]
    attachment_mailbox_prefix = attachment.outlook_attachment_id[0..35]

    if email_mailbox_prefix != attachment_mailbox_prefix
      Rails.logger.warn "[AttachmentMigrationJob] Attachment #{attachment.id} has mismatched mailbox ID - cannot recover via Graph"
      return nil
    end

    Rails.logger.info "[AttachmentMigrationJob] Fetching from Graph: #{email.mailbox_owner_email}/#{email.outlook_id}/#{attachment.outlook_attachment_id}"

    credential = MicrosoftCredential.active_credential
    return nil unless credential&.connected?

    client = MicrosoftAppGraphClient.new(credential)
    result = client.download_email_attachment(
      email.mailbox_owner_email,
      email.outlook_id,
      attachment.outlook_attachment_id
    )

    return nil unless result && result[:content].present?

    Rails.logger.info "[AttachmentMigrationJob] Downloaded #{result[:content].bytesize} bytes from Graph"
    result[:content]
  rescue => e
    Rails.logger.warn "[AttachmentMigrationJob] Graph download failed: #{e.message}"
    nil
  end

  # For migration jobs, we specifically need SharePoint since we're migrating FROM it
  def setup_sharepoint_provider_for_migration!
    cred = MicrosoftCredential.sharepoint_credential
    raise DocumentProviders::NotConnectedError, "No SharePoint credential configured" unless cred

    storage_config = StorageConfiguration.instance
    raise DocumentProviders::NotConnectedError, "No storage configuration" unless storage_config&.drive_id.present?

    @document_provider = DocumentProviders::SharePoint.new(cred)
    @organization = Organization.first
    @storage_config = storage_config
  end

  def download_from_storage(attachment)
    path_variations = generate_path_variations(attachment.storage_path)

    path_variations.each do |path|
      begin
        content = document_provider.download_file(path)
        return content if content.present?
      rescue DocumentProviders::Error => e
        Rails.logger.debug "[AttachmentMigrationJob] Path #{path} failed: #{e.message}"
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
