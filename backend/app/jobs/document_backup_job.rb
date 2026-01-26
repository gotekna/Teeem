# frozen_string_literal: true

# DocumentBackupJob - Daily/weekly document backup to Backblaze B2
#
# Syncs documents from primary storage (SharePoint/S3) to backup storage.
# Run daily for incremental and weekly for full sync.
#
# Schedule (via Heroku Scheduler):
#   Daily 2am:   rails runner "DocumentBackupJob.perform_now(:daily)"
#   Sunday 4am:  rails runner "DocumentBackupJob.perform_now(:all)"
#
# Modes:
#   :daily - Backup documents modified in the last day
#   :all   - Full sync of all documents (catch any missed)
#
class DocumentBackupJob < ApplicationJob
  queue_as :low

  # Batch size for processing
  BATCH_SIZE = 100

  def perform(scope = :daily)
    Rails.logger.info "[DocumentBackup] Starting #{scope} backup"

    unless BackupStorageService.configured?
      Rails.logger.warn "[DocumentBackup] Skipped - backup storage not configured"
      return
    end

    documents = case scope.to_sym
                when :daily
                  WarehouseDocument.where("updated_at > ?", 1.day.ago).with_blob
                when :all
                  WarehouseDocument.with_blob
                else
                  Rails.logger.error "[DocumentBackup] Invalid scope: #{scope}"
                  return
                end

    backed_up = 0
    skipped = 0
    errors = 0

    documents.find_each(batch_size: BATCH_SIZE) do |doc|
      result = backup_document(doc)
      case result
      when :success
        backed_up += 1
      when :skipped
        skipped += 1
      when :error
        errors += 1
      end
    rescue => e
      Rails.logger.error "[DocumentBackup] Error processing document #{doc.id}: #{e.message}"
      errors += 1
    end

    Rails.logger.info "[DocumentBackup] Complete: #{backed_up} backed up, #{skipped} skipped, #{errors} errors"

    # Report summary to Sentry if there were errors
    if errors > 0 && defined?(Sentry)
      Sentry.capture_message(
        "DocumentBackup completed with errors",
        level: :warning,
        extra: { scope: scope, backed_up: backed_up, skipped: skipped, errors: errors }
      )
    end
  end

  private

  def backup_document(doc)
    storage_path = doc.storage_blob&.storage_path
    return :skipped unless storage_path.present?

    backup_key = storage_path

    # Check if backup already exists and is current
    existing = begin
      BackupStorageService.list(backup_key).first
    rescue
      nil
    end

    if existing && existing[:last_modified] >= doc.storage_blob.updated_at
      # Backup is already current
      return :skipped
    end

    # Download from primary storage
    content = download_from_primary(doc)
    return :error unless content

    # Upload to backup storage
    BackupStorageService.upload(
      key: backup_key,
      content: content,
      metadata: {
        warehouse_document_id: doc.id.to_s,
        storage_blob_id: doc.storage_blob_id.to_s,
        source_type: doc.source_type,
        content_hash: doc.storage_blob.content_hash,
        backed_up_at: Time.current.iso8601
      }
    )

    Rails.logger.debug "[DocumentBackup] Backed up: #{doc.id} -> #{backup_key}"
    :success
  rescue => e
    Rails.logger.error "[DocumentBackup] Failed to backup document #{doc.id}: #{e.message}"
    :error
  end

  def download_from_primary(doc)
    # SSoT (Jan 2026): Use tenant for storage provider
    tenant = ActsAsTenant.current_tenant
    provider = if tenant
      DocumentProviders.for_tenant(tenant)
    else
      Rails.logger.warn "[DocumentBackup] No tenant context - using first organization"
      DocumentProviders.for_organization(Organization.first)
    end
    storage_path = doc.storage_blob&.storage_path

    return nil unless storage_path.present?

    provider.download_file(storage_path)
  rescue DocumentProviders::Base::NotFoundError
    Rails.logger.warn "[DocumentBackup] Primary file not found for document #{doc.id}: #{storage_path}"
    nil
  rescue => e
    Rails.logger.error "[DocumentBackup] Failed to download from primary for document #{doc.id}: #{e.message}"
    nil
  end
end
