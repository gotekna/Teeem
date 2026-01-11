# frozen_string_literal: true

# DocumentMigrationJob - Migrates documents between storage providers
#
# Handles one-time migration of documents from one provider to another.
# Downloads from source, uploads to destination, updates database records.
# Supports all document types: JobDocument, CorporateCompanyDocument, PeopleDocument
#
# Usage:
#   # Migrate a single JobDocument (legacy)
#   DocumentMigrationJob.perform_later(document.id, delete_source: false)
#
#   # Migrate any document type (new polymorphic)
#   DocumentMigrationJob.perform_later(document.id, document_type: 'CorporateCompanyDocument')
#
#   # Batch migration (via DocumentMigrationService)
#   DocumentMigrationService.start_migration(from: 'sharepoint', to: 's3_compatible')
#
class DocumentMigrationJob < ApplicationJob
  include DocumentProviderAware

  queue_as :low

  # Supported document types
  DOCUMENT_TYPES = {
    'JobDocument' => JobDocument,
    'CorporateCompanyDocument' => CorporateCompanyDocument,
    'PeopleDocument' => PeopleDocument
  }.freeze

  # Don't retry automatically - migration is idempotent and can be retried manually
  discard_on StandardError do |job, error|
    document_id = job.arguments.first
    options = job.arguments.second || {}
    document_type = options[:document_type] || 'JobDocument'

    Rails.logger.error "[DocumentMigration] #{document_type} #{document_id} failed permanently: #{error.message}"

    # Mark document as failed
    klass = DOCUMENT_TYPES[document_type] || JobDocument
    klass.find_by(id: document_id)&.update(
      migration_status: 'failed',
      migration_error: error.message
    )
  end

  # Migrate a single document from its current provider to the organization's active provider
  #
  # @param document_id [Integer] The document ID to migrate
  # @param options [Hash] Migration options
  #   - document_type: [String] Class name of document (default: 'JobDocument')
  #   - delete_source: [Boolean] Delete from source after successful migration (default: false)
  #   - force: [Boolean] Re-migrate even if already migrated (default: false)
  #
  def perform(document_id, options = {})
    delete_source = options.fetch(:delete_source, false)
    force = options.fetch(:force, false)
    document_type = options.fetch(:document_type, 'JobDocument')

    # Get the correct model class
    klass = DOCUMENT_TYPES[document_type]
    raise ArgumentError, "Unknown document type: #{document_type}" unless klass

    document = klass.find(document_id)
    organization = find_organization(document)

    # Skip if already migrated (unless force)
    if document.migration_status == 'completed' && !force
      Rails.logger.info "[DocumentMigration] #{document_type} #{document_id} already migrated, skipping"
      return { status: 'skipped', reason: 'already_migrated' }
    end

    # Skip if source and destination are the same
    source_provider_type = document.storage_provider || 'sharepoint'
    dest_provider_type = organization.document_provider

    if source_provider_type == dest_provider_type
      Rails.logger.info "[DocumentMigration] #{document_type} #{document_id} already on target provider"
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

    Rails.logger.info "[DocumentMigration] Starting migration of #{document_type} #{document_id} from #{source_provider_type} to #{dest_provider_type}"

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
      folder_path = document.storage_path.presence || build_folder_path(document, document_type)

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

      Rails.logger.info "[DocumentMigration] Migration completed for #{document_type} #{document_id}"

      {
        status: 'completed',
        document_id: document_id,
        document_type: document_type,
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

  # Find the organization for a document based on its type
  def find_organization(document)
    case document.class.name
    when 'JobDocument'
      document.job&.organization || Organization.first
    when 'CorporateCompanyDocument'
      document.corporate_company&.organization || Organization.first
    when 'PeopleDocument'
      document.contact&.organization || Organization.first
    else
      Organization.first
    end
  end

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

  # Build folder path for document based on type
  def build_folder_path(document, document_type)
    case document_type
    when 'JobDocument'
      job = document.job
      job_folder = "#{job.id.to_s.rjust(3, '0')} - #{sanitize_filename(job.title)}"
      subfolder = document.folder_path.presence || "Documents"
      "/Jobs/#{job_folder}/#{subfolder}/#{document.file_name}"

    when 'CorporateCompanyDocument'
      company = document.corporate_company
      if company
        company_folder = "#{company.code} - #{sanitize_filename(company.name)}"
        folder = document.folder.presence || "Documents"
        "/Corporate/#{company_folder}/#{folder}/#{document.file_name}"
      else
        "/Corporate/Unassigned/#{document.file_name}"
      end

    when 'PeopleDocument'
      contact = document.contact
      if contact
        contact_folder = sanitize_filename(contact.display_name.presence || "Contact #{contact.id}")
        folder = document.folder.presence || "Documents"
        "/People/#{contact_folder}/#{folder}/#{document.file_name}"
      else
        "/People/Unassigned/#{document.file_name}"
      end

    else
      "/Documents/#{document.file_name}"
    end
  end

  # Sanitize filename for storage
  def sanitize_filename(name)
    return "Untitled" if name.blank?
    name.gsub(/[<>:"\/\\|?*]/, '_').strip.truncate(100)
  end
end
