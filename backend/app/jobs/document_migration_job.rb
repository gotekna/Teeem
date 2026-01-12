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

  queue_as :default  # Use default queue - :low gets starved by recurring jobs

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

    # Mark document as failed (skip validations - just updating migration status)
    klass = DOCUMENT_TYPES[document_type] || JobDocument
    doc = klass.find_by(id: document_id)
    doc&.update_columns(
      migration_status: 'failed',
      migration_error: error.message[0..500]
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

    # Skip orphaned documents (file deleted from source provider)
    if document.respond_to?(:sync_status) && document.sync_status == 'missing'
      Rails.logger.info "[DocumentMigration] #{document_type} #{document_id} is orphaned (sync_status: missing), skipping"
      return { status: 'skipped', reason: 'orphaned_document' }
    end

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

    # Mark as in progress (skip validations - we're only updating migration fields)
    document.update_columns(
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

      # Step 2: Determine download reference
      # Primary: storage_reference (file ID or path)
      # Fallback: expected_sharepoint_path (for Xero-imported docs without file_url)
      download_ref = document.storage_reference.presence
      if download_ref.blank? && document.respond_to?(:expected_sharepoint_path)
        download_ref = document.expected_sharepoint_path
        Rails.logger.info "[DocumentMigration] Using expected_sharepoint_path: #{download_ref}"
      end

      if download_ref.blank?
        raise StandardError, "No storage reference or expected path available for download"
      end

      # Step 3: Download file content from source
      Rails.logger.info "[DocumentMigration] Downloading from #{source_provider_type}..."
      content = source_provider.download_file(download_ref)

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

      # Step 6: Update document record (skip validations - we're only updating migration fields)
      # Mark as synced so it appears in API queries (job_all_files uses .synced scope)
      update_attrs = {
        storage_provider: dest_provider_type,
        storage_item_id: result[:id],
        storage_path: result[:path] || folder_path,
        migration_status: 'completed',
        migration_completed_at: Time.current,
        migration_error: nil
      }
      # sync_status only exists on JobDocument, not CorporateCompanyDocument
      update_attrs[:sync_status] = 'synced' if document.respond_to?(:sync_status)
      document.update_columns(update_attrs)

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

      document.update_columns(
        migration_status: 'failed',
        migration_error: e.message[0..500] # Truncate long errors
      )

      raise # Re-raise to trigger discard_on handler
    end
  end

  private

  # Find the organization for a document based on its type
  # For single-tenant usage (Tekna), Organization.first is the SSoT.
  # Note: Most models don't have direct organization associations.
  def find_organization(_document)
    # Single-tenant: Always use the primary organization (Tekna)
    # which has S3/SharePoint configured
    Organization.first
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
  # Uses clean, URL-friendly paths: jobs/49/contract/po-49678.pdf
  def build_folder_path(document, document_type)
    case document_type
    when 'JobDocument'
      job = document.job
      subfolder = slugify_path(document.folder_path.presence || "documents")
      filename = slugify_filename(document.file_name)
      "jobs/#{job.id}/#{subfolder}/#{filename}"

    when 'CorporateCompanyDocument'
      company = document.corporate_company
      if company
        folder = slugify_path(document.folder.presence || "documents")
        filename = slugify_filename(document.file_name)
        "corporate/#{company.id}/#{folder}/#{filename}"
      else
        "corporate/unassigned/#{slugify_filename(document.file_name)}"
      end

    when 'PeopleDocument'
      contact = document.contact
      if contact
        folder = slugify_path(document.folder.presence || "documents")
        filename = slugify_filename(document.file_name)
        "people/#{contact.id}/#{folder}/#{filename}"
      else
        "people/unassigned/#{slugify_filename(document.file_name)}"
      end

    else
      "documents/#{slugify_filename(document.file_name)}"
    end
  end

  # Convert path segments to URL-friendly slugs
  # "03 Contract/Bowen Overruns" -> "contract/bowen-overruns"
  def slugify_path(path)
    return "documents" if path.blank?
    path.split('/').map { |segment| slugify(segment) }.join('/')
  end

  # Convert filename to URL-friendly format while preserving extension
  # "PO 49678.pdf" -> "po-49678.pdf"
  def slugify_filename(filename)
    return "untitled" if filename.blank?
    ext = File.extname(filename)
    base = File.basename(filename, ext)
    "#{slugify(base)}#{ext.downcase}"
  end

  # Convert string to URL-friendly slug
  # "03 Contract" -> "contract", "Bowen Overruns" -> "bowen-overruns"
  def slugify(text)
    return "untitled" if text.blank?
    text.to_s
        .downcase
        .gsub(/^\d+\s*[-_]?\s*/, '')  # Remove leading numbers like "03 - " or "03_"
        .gsub(/[^a-z0-9\s-]/, '')     # Remove special chars except spaces/hyphens
        .gsub(/\s+/, '-')              # Spaces to hyphens
        .gsub(/-+/, '-')               # Collapse multiple hyphens
        .gsub(/^-|-$/, '')             # Trim leading/trailing hyphens
        .presence || "item"
  end
end
