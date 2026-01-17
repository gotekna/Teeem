# frozen_string_literal: true

# BackupStorageService - S3-compatible backup storage for disaster recovery
#
# Provides backup storage to Backblaze B2 (or any S3-compatible service).
# Used for database dumps and document mirrors.
#
# Configuration (via environment variables):
#   BACKUP_S3_ENDPOINT: S3 endpoint URL (e.g., https://s3.us-west-004.backblazeb2.com)
#   BACKUP_S3_BUCKET: Bucket name (e.g., teeem-backups)
#   BACKUP_S3_ACCESS_KEY: Access key ID
#   BACKUP_S3_SECRET_KEY: Secret access key
#   BACKUP_S3_REGION: Region (e.g., us-west-004)
#
# Usage:
#   # Upload a database backup
#   BackupStorageService.upload(
#     key: "database/db-backup-2026-01-17.dump",
#     content: file_content
#   )
#
#   # Download a backup
#   content = BackupStorageService.download("database/db-backup-2026-01-17.dump")
#
#   # List backups in a folder
#   BackupStorageService.list("database/")
#
#   # Cleanup old backups (keep last N)
#   BackupStorageService.cleanup_old_backups("database/", keep: 12)
#
class BackupStorageService
  class NotConfiguredError < StandardError; end
  class NotFoundError < StandardError; end

  class << self
    # Check if backup storage is configured
    # @return [Boolean]
    def configured?
      ENV["BACKUP_S3_BUCKET"].present? &&
        ENV["BACKUP_S3_ACCESS_KEY"].present? &&
        ENV["BACKUP_S3_SECRET_KEY"].present?
    end

    # Upload content to backup storage
    # @param key [String] The storage key (path)
    # @param content [String, IO] The content to upload
    # @param metadata [Hash] Optional metadata to attach
    # @return [Hash] Upload result with :key, :size, :uploaded_at
    def upload(key:, content:, metadata: {})
      ensure_configured!
      content = content.read if content.respond_to?(:read)

      client.put_object(
        bucket: bucket,
        key: key,
        body: content,
        metadata: metadata.transform_values(&:to_s)
      )

      Rails.logger.info "[BackupStorage] Uploaded: #{key} (#{content.bytesize} bytes)"

      {
        key: key,
        size: content.bytesize,
        uploaded_at: Time.current
      }
    end

    # Upload from a URL (for Heroku backup URLs)
    # @param key [String] The storage key (path)
    # @param url [String] URL to download from
    # @param metadata [Hash] Optional metadata
    # @return [Hash] Upload result
    def upload_from_url(key:, url:, metadata: {})
      ensure_configured!

      require "open-uri"
      content = URI.parse(url).open.read

      upload(key: key, content: content, metadata: metadata)
    end

    # Download content from backup storage
    # @param key [String] The storage key (path)
    # @return [String] The content
    def download(key)
      ensure_configured!

      response = client.get_object(bucket: bucket, key: key)
      response.body.read
    rescue Aws::S3::Errors::NoSuchKey
      raise NotFoundError, "Backup not found: #{key}"
    end

    # List objects in a prefix
    # @param prefix [String] The prefix (folder path)
    # @return [Array<Hash>] List of objects with :key, :size, :last_modified
    def list(prefix)
      ensure_configured!

      objects = []
      continuation_token = nil

      loop do
        params = {
          bucket: bucket,
          prefix: prefix,
          max_keys: 1000
        }
        params[:continuation_token] = continuation_token if continuation_token

        response = client.list_objects_v2(params)

        response.contents&.each do |obj|
          objects << {
            key: obj.key,
            size: obj.size,
            last_modified: obj.last_modified
          }
        end

        break unless response.is_truncated
        continuation_token = response.next_continuation_token
      end

      objects.sort_by { |o| o[:last_modified] }.reverse
    end

    # Delete an object
    # @param key [String] The storage key
    # @return [Boolean]
    def delete(key)
      ensure_configured!
      client.delete_object(bucket: bucket, key: key)
      Rails.logger.info "[BackupStorage] Deleted: #{key}"
      true
    end

    # Cleanup old backups, keeping the most recent N
    # @param prefix [String] The prefix (folder path)
    # @param keep [Integer] Number of backups to keep
    # @return [Integer] Number of backups deleted
    def cleanup_old_backups(prefix, keep:)
      ensure_configured!

      objects = list(prefix)
      return 0 if objects.size <= keep

      # Objects are sorted by last_modified (newest first), delete the rest
      to_delete = objects[keep..]
      deleted_count = 0

      to_delete.each do |obj|
        delete(obj[:key])
        deleted_count += 1
      end

      Rails.logger.info "[BackupStorage] Cleanup: deleted #{deleted_count} old backups from #{prefix}"
      deleted_count
    end

    # Restore a document from backup to primary storage
    # @param warehouse_document_id [Integer] WarehouseDocument ID
    # @return [Boolean] Success
    def restore_document(warehouse_document_id)
      ensure_configured!

      doc = WarehouseDocument.find(warehouse_document_id)
      backup_key = doc.storage_path

      # Download from backup
      content = download(backup_key)

      # Upload to primary storage
      provider = DocumentProviders::Base.for_organization(doc.organization)
      folder_path = File.dirname(doc.storage_path)
      filename = File.basename(doc.storage_path)

      provider.upload_file(folder_path, content, filename)
      Rails.logger.info "[BackupStorage] Restored document: #{doc.id} (#{backup_key})"
      true
    end

    # Restore all documents for a scope
    # @param scope [Symbol] :jobs, :contacts, etc.
    # @param filters [Hash] Filters like { job_code: 'J-001' }
    # @return [Integer] Number restored
    def restore_scope(scope, **filters)
      ensure_configured!

      docs = WarehouseDocument.where(source_type: scope.to_s)

      case scope
      when :jobs
        docs = docs.joins(:job).where(jobs: { job_code: filters[:job_code] }) if filters[:job_code]
      when :contacts
        docs = docs.joins(:contact).where(contacts: { id: filters[:contact_id] }) if filters[:contact_id]
      end

      restored = 0
      docs.find_each do |doc|
        restore_document(doc.id)
        restored += 1
      rescue => e
        Rails.logger.error "[BackupStorage] Failed to restore #{doc.id}: #{e.message}"
      end

      Rails.logger.info "[BackupStorage] Restored #{restored} documents for scope #{scope}"
      restored
    end

    # Full restore (emergency use only)
    # @return [Integer] Number restored
    def full_restore!
      ensure_configured!
      Rails.logger.warn "[BackupStorage] FULL RESTORE initiated - this may take a long time"

      restored = 0
      WarehouseDocument.find_each do |doc|
        restore_document(doc.id)
        restored += 1
      rescue => e
        Rails.logger.error "[BackupStorage] Failed to restore #{doc.id}: #{e.message}"
      end

      Rails.logger.info "[BackupStorage] FULL RESTORE complete: #{restored} documents"
      restored
    end

    # Get storage stats
    # @return [Hash] Stats including :total_size, :object_count, :by_prefix
    def stats
      ensure_configured!

      objects = list("")
      by_prefix = objects.group_by { |o| o[:key].split("/").first }

      {
        total_size: objects.sum { |o| o[:size] },
        object_count: objects.size,
        by_prefix: by_prefix.transform_values do |objs|
          {
            count: objs.size,
            size: objs.sum { |o| o[:size] }
          }
        end
      }
    end

    private

    def ensure_configured!
      raise NotConfiguredError, "Backup storage not configured. Set BACKUP_S3_* environment variables." unless configured?
    end

    def client
      @client ||= Aws::S3::Client.new(
        access_key_id: ENV["BACKUP_S3_ACCESS_KEY"],
        secret_access_key: ENV["BACKUP_S3_SECRET_KEY"],
        region: ENV.fetch("BACKUP_S3_REGION", "us-west-004"),
        endpoint: ENV["BACKUP_S3_ENDPOINT"],
        force_path_style: true
      )
    end

    def bucket
      ENV["BACKUP_S3_BUCKET"]
    end
  end
end
