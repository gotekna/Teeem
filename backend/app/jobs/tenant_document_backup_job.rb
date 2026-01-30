# frozen_string_literal: true

# TenantDocumentBackupJob - Document backup for a specific tenant
#
# Syncs documents from the tenant's primary storage (SharePoint/S3) to their
# configured backup storage provider.
#
# Strategy:
#   - Incremental: Only backup documents modified since last backup
#   - Uses WarehouseDocument as the SSoT for document inventory
#   - Preserves folder structure in backup storage
#
class TenantDocumentBackupJob < ApplicationJob
  queue_as :low

  # Maximum files per batch to avoid timeout
  BATCH_SIZE = 100

  def perform(tenant_id, options = {})
    @tenant = Tenant.find(tenant_id)
    @incremental = options.fetch(:incremental, true)
    @since = options[:since]

    ActsAsTenant.with_tenant(@tenant) do
      @config = BackupConfiguration.for_tenant

      unless @config.enabled?
        Rails.logger.info "[TenantDocumentBackup] Skipped - backups disabled for tenant #{@tenant.id}"
        return
      end

      unless @config.primary_credential
        Rails.logger.warn "[TenantDocumentBackup] Skipped - no primary credential for tenant #{@tenant.id}"
        return
      end

      run_backup
    end
  end

  private

  def run_backup
    log = BackupLog.start!(@config, type: "documents", provider: @config.primary_credential.provider_name)
    start_time = Time.current
    total_size = 0
    files_count = 0

    begin
      service = TenantBackupService.new(@config.primary_credential)

      # Get documents to backup
      documents = documents_to_backup

      if documents.empty?
        log.complete!(
          size_bytes: 0,
          duration_seconds: elapsed(start_time),
          files_count: 0,
          metadata: { message: "No documents to backup" }
        )
        return
      end

      Rails.logger.info "[TenantDocumentBackup] Starting backup of #{documents.count} documents"

      # Backup each document
      documents.find_each(batch_size: BATCH_SIZE) do |doc|
        begin
          content = download_document(doc)
          next unless content

          key = "documents/#{@tenant.id}/#{doc.storage_path}"

          service.upload(
            key: key,
            content: content,
            metadata: {
              document_id: doc.id.to_s,
              source_type: doc.source_type,
              original_path: doc.storage_path
            }
          )

          total_size += content.bytesize
          files_count += 1
        rescue => e
          Rails.logger.warn "[TenantDocumentBackup] Failed to backup doc #{doc.id}: #{e.message}"
        end
      end

      log.complete!(
        size_bytes: total_size,
        duration_seconds: elapsed(start_time),
        files_count: files_count
      )

      @config.record_backup_completed!(:documents)

      # Queue mirror job if enabled
      if @config.mirror_enabled? && @config.secondary_credential
        BackupMirrorJob.perform_later(
          @tenant.id,
          "documents",
          "documents/#{@tenant.id}/"
        )
      end

      Rails.logger.info "[TenantDocumentBackup] Complete for tenant #{@tenant.id}: #{files_count} files, #{total_size} bytes"
    rescue => e
      log.fail!(error_message: e.message, duration_seconds: elapsed(start_time))
      Rails.logger.error "[TenantDocumentBackup] Failed for tenant #{@tenant.id}: #{e.message}"
      raise e
    end
  end

  def documents_to_backup
    docs = WarehouseDocument.all

    if @incremental && @config.last_document_backup_at
      since = @since || @config.last_document_backup_at
      docs = docs.where("updated_at > ?", since)
    end

    docs.order(:updated_at)
  end

  def download_document(doc)
    # Get the appropriate storage provider for downloading
    storage_config = WarehouseProvider.instance

    case storage_config.provider_type
    when "sharepoint"
      download_from_sharepoint(doc)
    when "s3_compatible"
      download_from_s3(doc)
    else
      Rails.logger.warn "[TenantDocumentBackup] Unknown provider type: #{storage_config.provider_type}"
      nil
    end
  rescue => e
    Rails.logger.warn "[TenantDocumentBackup] Download failed for #{doc.id}: #{e.message}"
    nil
  end

  def download_from_sharepoint(doc)
    credential = MicrosoftCredential.sharepoint_credential
    return nil unless credential

    client = MicrosoftAppGraphClient.new(credential)
    storage_config = WarehouseProvider.instance

    # Build the full path
    full_path = File.join(storage_config.root_path, doc.storage_path)

    client.download_file(storage_config.drive_id, full_path)
  end

  def download_from_s3(doc)
    storage_config = WarehouseProvider.instance
    client = S3StorageClient.new(storage_config)
    client.download(doc.storage_path)
  end

  def elapsed(start_time)
    (Time.current - start_time).to_i
  end
end
