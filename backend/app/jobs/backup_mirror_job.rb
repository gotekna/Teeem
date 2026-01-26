# frozen_string_literal: true

# BackupMirrorJob - Copy backups from primary to secondary storage
#
# This job syncs backups from the primary storage provider (e.g., Wasabi)
# to the secondary storage provider (e.g., Backblaze B2) for redundancy.
#
# Can be triggered:
#   1. Automatically after a backup completes (if mirror_enabled)
#   2. Manually via the API
#
# Modes:
#   - Single file: copy a specific key
#   - Directory: copy all files under a prefix
#
class BackupMirrorJob < ApplicationJob
  queue_as :low

  # @param tenant_id [Integer] Tenant ID
  # @param backup_type [String] "database" or "documents"
  # @param key_or_prefix [String] Specific key or directory prefix to copy
  def perform(tenant_id, backup_type = nil, key_or_prefix = nil)
    @tenant = Tenant.find(tenant_id)

    ActsAsTenant.with_tenant(@tenant) do
      @config = BackupConfiguration.for_tenant

      unless @config.mirror_enabled?
        Rails.logger.info "[BackupMirror] Skipped - mirror not enabled for tenant #{@tenant.id}"
        return
      end

      unless @config.primary_credential && @config.secondary_credential
        Rails.logger.warn "[BackupMirror] Skipped - missing credentials for tenant #{@tenant.id}"
        return
      end

      run_mirror(backup_type, key_or_prefix)
    end
  end

  private

  def run_mirror(backup_type, key_or_prefix)
    log = BackupLog.start!(@config, type: "mirror", provider: @config.secondary_credential.provider_name)
    start_time = Time.current
    total_size = 0
    files_count = 0

    begin
      primary_service = TenantBackupService.new(@config.primary_credential)
      secondary_service = TenantBackupService.new(@config.secondary_credential)

      # Determine what to copy
      if key_or_prefix.present?
        if key_or_prefix.end_with?("/")
          # It's a prefix - copy all files under it
          files = primary_service.list(key_or_prefix)
        else
          # It's a single file
          files = [{ key: key_or_prefix }]
        end
      else
        # Full mirror - copy all files for this tenant
        prefix = "#{backup_type}/#{@tenant.id}/" if backup_type
        prefix ||= ""
        files = primary_service.list(prefix)
      end

      Rails.logger.info "[BackupMirror] Starting mirror of #{files.count} files to #{@config.secondary_credential.name}"

      # Copy each file
      files.each do |file_info|
        key = file_info[:key]

        begin
          # Download from primary
          content = primary_service.download(key)

          # Upload to secondary
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
          Rails.logger.warn "[BackupMirror] File not found in primary: #{key}"
        rescue => e
          Rails.logger.warn "[BackupMirror] Failed to mirror #{key}: #{e.message}"
        end
      end

      log.complete!(
        size_bytes: total_size,
        duration_seconds: elapsed(start_time),
        files_count: files_count,
        metadata: {
          primary: @config.primary_credential.name,
          secondary: @config.secondary_credential.name
        }
      )

      @config.record_backup_completed!(:mirror)

      Rails.logger.info "[BackupMirror] Complete for tenant #{@tenant.id}: #{files_count} files, #{total_size} bytes"
    rescue => e
      log.fail!(error_message: e.message, duration_seconds: elapsed(start_time))
      Rails.logger.error "[BackupMirror] Failed for tenant #{@tenant.id}: #{e.message}"
      raise e
    end
  end

  def elapsed(start_time)
    (Time.current - start_time).to_i
  end
end
