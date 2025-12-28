# frozen_string_literal: true

# DocumentMigrationJob - Migrates documents between storage providers
#
# Handles one-time migration of documents from one provider to another.
# Downloads from source, uploads to destination, updates database records.
#
# Usage:
#   # Migrate a single document
#   DocumentMigrationJob.perform_later(job_document.id, delete_source: false)
#
#   # Batch migration (via DocumentMigrationService)
#   DocumentMigrationService.migrate_all(from: 'sharepoint', to: 's3_compatible')
#
class DocumentMigrationJob < ApplicationJob
  include DocumentProviderAware

  queue_as :low_priority

  # Don't retry automatically - migration is idempotent and can be retried manually
  discard_on StandardError do |job, error|
    document_id = job.arguments.first
    Rails.logger.error "[DocumentMigration] Job #{document_id} failed permanently: #{error.message}"

    # Mark document as failed
    JobDocument.find_by(id: document_id)&.update(
      migration_status: 'failed',
      migration_error: error.message
    )
  end

  # Migrate a single document from its current provider to the organization's active provider
  #
  # @param job_document_id [Integer] The JobDocument ID to migrate
  # @param options [Hash] Migration options
  #   - delete_source: [Boolean] Delete from source after successful migration (default: false)
  #   - force: [Boolean] Re-migrate even if already migrated (default: false)
  #
  def perform(job_document_id, options = {})
    delete_source = options.fetch(:delete_source, false)
    force = options.fetch(:force, false)

    document = JobDocument.find(job_document_id)
    job = document.job
    organization = job.organization || Organization.first

    # Skip if already migrated (unless force)
    if document.migration_status == 'completed' && !force
      Rails.logger.info "[DocumentMigration] Document #{job_document_id} already migrated, skipping"
      return { status: 'skipped', reason: 'already_migrated' }
    end

    # Skip if source and destination are the same
    source_provider_type = document.storage_provider || 'sharepoint'
    dest_provider_type = organization.document_provider

    if source_provider_type == dest_provider_type
      Rails.logger.info "[DocumentMigration] Document #{job_document_id} already on target provider"
      return { status: 'skipped', reason: 'same_provider' }
    end

    # Mark as in progress
    document.update!(
      migration_status: 'in_progress',
      migration_started_at: Time.current,
      migration_error: nil,
      source_provider: source_provider_type,
      source_item_id: document.storage_reference
    )

    Rails.logger.info "[DocumentMigration] Starting migration of document #{job_document_id} from #{source_provider_type} to #{dest_provider_type}"

    begin
      # Step 1: Get source provider
      source_provider = get_provider(source_provider_type, organization)

      # Step 2: Download file content from source
      Rails.logger.info "[DocumentMigration] Downloading from #{source_provider_type}..."
      content = source_provider.download_file(document.storage_reference)

      unless content.present?
        raise StandardError, "Failed to download file from #{source_provider_type}"
      end

      Rails.logger.info "[DocumentMigration] Downloaded #{content.bytesize} bytes"

      # Step 3: Get destination provider
      dest_provider = get_provider(dest_provider_type, organization)

      # Step 4: Determine destination folder path
      folder_path = document.storage_path.presence || build_folder_path(document)

      # Ensure folder exists
      dest_provider.create_folder(File.dirname(folder_path), create_parents: true) rescue nil

      # Step 5: Upload to destination
      Rails.logger.info "[DocumentMigration] Uploading to #{dest_provider_type}..."
      result = dest_provider.upload_file(
        File.dirname(folder_path),
        content,
        document.file_name,
        content_type: document.mime_type,
        overwrite: true
      )

      unless result && result[:id]
        raise StandardError, "Failed to upload file to #{dest_provider_type}"
      end

      Rails.logger.info "[DocumentMigration] Uploaded successfully, new ID: #{result[:id]}"

      # Step 6: Update document record
      document.update!(
        storage_provider: dest_provider_type,
        storage_item_id: result[:id],
        storage_path: result[:path] || folder_path,
        migration_status: 'completed',
        migration_completed_at: Time.current,
        migration_error: nil
      )

      # Step 7: Optionally delete from source
      if delete_source
        Rails.logger.info "[DocumentMigration] Deleting from source..."
        begin
          source_provider.delete_file(document.source_item_id)
          Rails.logger.info "[DocumentMigration] Source file deleted"
        rescue StandardError => e
          Rails.logger.warn "[DocumentMigration] Failed to delete source (non-fatal): #{e.message}"
        end
      end

      Rails.logger.info "[DocumentMigration] Migration completed for document #{job_document_id}"

      {
        status: 'completed',
        document_id: job_document_id,
        source_provider: source_provider_type,
        dest_provider: dest_provider_type,
        new_item_id: result[:id]
      }

    rescue StandardError => e
      Rails.logger.error "[DocumentMigration] Failed: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")

      document.update!(
        migration_status: 'failed',
        migration_error: e.message
      )

      raise # Re-raise to trigger discard_on handler
    end
  end

  private

  # Get the appropriate provider for a given type
  def get_provider(provider_type, organization)
    case provider_type
    when 'sharepoint'
      DocumentProviders::SharePoint.for_organization(organization)
    when 's3_compatible'
      credential = organization.document_provider_credential ||
                   S3CompatibleCredential.active.connected.first

      raise DocumentProviders::NotConnectedError, "No S3 credential configured" unless credential
      DocumentProviders::S3Compatible.new(credential)
    else
      raise ArgumentError, "Unknown provider type: #{provider_type}"
    end
  end

  # Build folder path for document based on job
  def build_folder_path(document)
    job = document.job
    job_folder = "#{job.id.to_s.rjust(3, '0')} - #{sanitize_filename(job.title)}"
    subfolder = document.folder_path.presence || "Documents"

    "/Jobs/#{job_folder}/#{subfolder}/#{document.file_name}"
  end

  # Sanitize filename for storage
  def sanitize_filename(name)
    return "Untitled" if name.blank?
    name.gsub(/[<>:"\/\\|?*]/, '_').strip.truncate(100)
  end
end
