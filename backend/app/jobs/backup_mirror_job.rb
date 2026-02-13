# frozen_string_literal: true

# BackupMirrorJob - Tier 2: Sync documents from live storage to B2 (off-site)
#
# Two-tier backup architecture:
#   Tier 1 (Wasabi): TenantDocumentBackupJob → teeem-backups bucket (incremental)
#   Tier 2 (B2):     BackupMirrorJob → B2 bucket (full sync from LIVE storage)
#
# For documents:
#   Downloads from LIVE Wasabi bucket (via WarehouseProvider) → uploads to B2.
#   Uses last_mirror_sync_at as watermark for incremental sync.
#   Supports full_sync option to re-sync everything.
#
# For database:
#   Copies from backup bucket (primary credential) → B2 (secondary credential).
#   Database dumps only exist in the backup bucket, so this is a bucket-to-bucket copy.
#
class BackupMirrorJob < ApplicationJob
  queue_as :low

  BATCH_SIZE = 100

  # @param tenant_id [Integer] Tenant ID
  # @param backup_type [String] "database" or "documents"
  # @param options [Hash] Optional settings
  #   :full_sync [Boolean] If true, sync ALL documents (ignore watermark)
  #   :key [String] Specific database backup key to mirror
  def perform(tenant_id, backup_type = "documents", options = {})
    @tenant = Tenant.find(tenant_id)
    @tenant_slug = @tenant.slug
    @full_sync = options.fetch(:full_sync, false)
    @specific_key = options[:key]

    ActsAsTenant.with_tenant(@tenant) do
      @config = BackupConfiguration.for_tenant

      unless @config.mirror_enabled?
        Rails.logger.info "[BackupMirror] Skipped - mirror not enabled for tenant #{@tenant.id}"
        return
      end

      unless @config.secondary_credential
        Rails.logger.warn "[BackupMirror] Skipped - no secondary (B2) credential for tenant #{@tenant.id}"
        return
      end

      case backup_type
      when "documents"
        mirror_documents
      when "database"
        mirror_database
      else
        Rails.logger.warn "[BackupMirror] Unknown backup type: #{backup_type}"
      end
    end
  end

  private

  # Tier 2 Document Sync: Live Wasabi → B2
  # Downloads from live storage, uploads to B2 with tenant-slug-prefixed keys.
  def mirror_documents
    log = BackupLog.start!(@config, type: "mirror", provider: @config.secondary_credential.provider_name)
    start_time = Time.current
    total_size = 0
    files_count = 0

    begin
      b2_service = TenantBackupService.new(@config.secondary_credential)
      live_client = build_live_storage_client

      unless live_client
        log.fail!(error_message: "No live storage client available", duration_seconds: elapsed(start_time))
        return
      end

      documents = documents_to_mirror

      if documents.none?
        log.complete!(
          size_bytes: 0,
          duration_seconds: elapsed(start_time),
          files_count: 0,
          metadata: { message: "No documents to mirror", full_sync: @full_sync }
        )
        @config.record_backup_completed!(:mirror)
        return
      end

      doc_count = documents.count
      Rails.logger.info "[BackupMirror] Starting Tier 2 sync of #{doc_count} documents (full_sync=#{@full_sync})"

      documents.find_each(batch_size: BATCH_SIZE) do |doc|
        next unless doc.storage_path.present?

        begin
          content = download_from_live(live_client, doc)
          next unless content

          # Mirror key: preserve original storage path under tenant slug
          mirror_key = "#{@tenant_slug}/documents/#{doc.storage_path}"

          b2_service.upload(
            key: mirror_key,
            content: content,
            metadata: {
              document_id: doc.id.to_s,
              source_type: doc.source_type,
              original_path: doc.storage_path,
              mirrored_at: Time.current.iso8601
            }
          )

          total_size += content.bytesize
          files_count += 1
        rescue => e
          Rails.logger.warn "[BackupMirror] Failed to mirror doc #{doc.id}: #{e.message}"
        end
      end

      log.complete!(
        size_bytes: total_size,
        duration_seconds: elapsed(start_time),
        files_count: files_count,
        metadata: {
          tier: "b2",
          full_sync: @full_sync,
          secondary: @config.secondary_credential.name
        }
      )

      @config.record_backup_completed!(:mirror)

      Rails.logger.info "[BackupMirror] Tier 2 complete for tenant #{@tenant.id}: #{files_count} files, #{total_size} bytes"
    rescue => e
      log.fail!(error_message: e.message, duration_seconds: elapsed(start_time))
      Rails.logger.error "[BackupMirror] Tier 2 failed for tenant #{@tenant.id}: #{e.message}"
      raise e
    end
  end

  # Database mirror: Copy from backup bucket (Tier 1) → B2 (Tier 2)
  # Database dumps only exist in the backup bucket, so we copy bucket-to-bucket.
  def mirror_database
    unless @config.primary_credential
      Rails.logger.warn "[BackupMirror] Skipped database mirror - no primary credential"
      return
    end

    log = BackupLog.start!(@config, type: "mirror", provider: @config.secondary_credential.provider_name)
    start_time = Time.current
    total_size = 0
    files_count = 0

    begin
      primary_service = TenantBackupService.new(@config.primary_credential)
      secondary_service = TenantBackupService.new(@config.secondary_credential)

      # Determine what to copy
      if @specific_key.present?
        files = [{ key: @specific_key }]
      else
        files = primary_service.list("#{@tenant_slug}/database/")
      end

      Rails.logger.info "[BackupMirror] Mirroring #{files.count} database backup(s) to B2"

      files.each do |file_info|
        key = file_info[:key]

        begin
          content = primary_service.download(key)

          secondary_service.upload(
            key: key,
            content: content,
            metadata: {
              mirrored_from: @config.primary_credential.name,
              mirrored_at: Time.current.iso8601
            }
          )

          total_size += content.bytesize
          files_count += 1
        rescue TenantBackupService::NotFoundError
          Rails.logger.warn "[BackupMirror] Database backup not found: #{key}"
        rescue => e
          Rails.logger.warn "[BackupMirror] Failed to mirror database #{key}: #{e.message}"
        end
      end

      log.complete!(
        size_bytes: total_size,
        duration_seconds: elapsed(start_time),
        files_count: files_count,
        metadata: {
          tier: "b2",
          backup_type: "database",
          primary: @config.primary_credential.name,
          secondary: @config.secondary_credential.name
        }
      )

      Rails.logger.info "[BackupMirror] Database mirror complete: #{files_count} files, #{total_size} bytes"
    rescue => e
      log.fail!(error_message: e.message, duration_seconds: elapsed(start_time))
      Rails.logger.error "[BackupMirror] Database mirror failed: #{e.message}"
      raise e
    end
  end

  # Query WarehouseDocuments to mirror, using last_mirror_sync_at as watermark
  def documents_to_mirror
    docs = WarehouseDocument.where.not(storage_path: [nil, ""])

    unless @full_sync
      if @config.last_mirror_sync_at.present?
        docs = docs.where("warehouse_documents.updated_at > ?", @config.last_mirror_sync_at)
      end
    end

    docs.order(:updated_at)
  end

  # Build an S3 client that reads from the LIVE Wasabi bucket.
  # Uses WarehouseProvider.storage_credential_id (SSoT) when set,
  # falls back to .active.first only if credential_id not yet consolidated.
  def build_live_storage_client
    storage_config = WarehouseProvider.instance
    return nil unless storage_config.s3_compatible?

    credential = if storage_config.storage_credential_id.present?
                   S3CompatibleCredential.find_by(id: storage_config.storage_credential_id)
                 else
                   S3CompatibleCredential.active.first
                 end
    return nil unless credential

    @live_bucket = storage_config.bucket
    return nil unless @live_bucket.present?

    Aws::S3::Client.new(
      access_key_id: credential.access_key_id,
      secret_access_key: credential.secret_access_key,
      region: credential.region || "us-east-1",
      endpoint: credential.endpoint,
      force_path_style: true
    )
  end

  # Download a document from live Wasabi storage
  def download_from_live(client, doc)
    response = client.get_object(bucket: @live_bucket, key: doc.storage_path)
    response.body.read
  rescue Aws::S3::Errors::NoSuchKey
    Rails.logger.warn "[BackupMirror] File not found in live storage: #{doc.storage_path}"
    nil
  rescue => e
    Rails.logger.warn "[BackupMirror] Download failed for #{doc.storage_path}: #{e.message}"
    nil
  end

  def elapsed(start_time)
    (Time.current - start_time).to_i
  end
end
