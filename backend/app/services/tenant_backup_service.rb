# frozen_string_literal: true

# TenantBackupService - Per-tenant backup storage using S3-compatible credentials
#
# Unlike BackupStorageService (which uses global ENV vars), this service uses
# per-tenant S3CompatibleCredential for multi-tenant backup isolation.
#
# Usage:
#   # Initialize with a credential
#   credential = S3CompatibleCredential.find(123)
#   service = TenantBackupService.new(credential)
#
#   # Upload a backup
#   service.upload(key: "database/backup-2026-01-18.dump", content: file_data)
#
#   # List backups
#   service.list("database/")
#
#   # Cleanup old backups
#   service.cleanup_old_backups("database/", keep: 12)
#
class TenantBackupService
  class NotConfiguredError < StandardError; end
  class NotFoundError < StandardError; end
  class UploadError < StandardError; end

  attr_reader :credential

  # @param credential [S3CompatibleCredential] The S3 credential to use
  def initialize(credential)
    raise NotConfiguredError, "Credential is required" unless credential
    raise NotConfiguredError, "Credential is not connected" unless credential.connected?

    @credential = credential
  end

  # Upload content to backup storage
  # @param key [String] The storage key (path)
  # @param content [String, IO] The content to upload
  # @param metadata [Hash] Optional metadata to attach
  # @return [Hash] Upload result with :key, :size, :uploaded_at
  def upload(key:, content:, metadata: {})
    content = content.read if content.respond_to?(:read)

    client.put_object(
      bucket: bucket,
      key: key,
      body: content,
      metadata: metadata.transform_values(&:to_s)
    )

    Rails.logger.info "[TenantBackup] Uploaded: #{key} (#{content.bytesize} bytes) to #{credential.name}"

    {
      key: key,
      size: content.bytesize,
      uploaded_at: Time.current
    }
  end

  # Upload from a URL (for Heroku backup URLs)
  # Streams the download to a temp file to avoid memory issues with large files.
  # @param key [String] The storage key (path)
  # @param url [String] URL to download from
  # @param metadata [Hash] Optional metadata
  # @return [Hash] Upload result
  def upload_from_url(key:, url:, metadata: {})
    require "net/http"
    require "tempfile"

    Tempfile.create(["backup", ".dump"]) do |temp_file|
      temp_file.binmode

      # Stream download to temp file
      uri = URI.parse(url)
      total_size = 0

      Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
        http.request_get(uri.request_uri) do |response|
          if response.code != "200"
            raise UploadError, "Download failed: HTTP #{response.code}"
          end

          response.read_body do |chunk|
            temp_file.write(chunk)
            total_size += chunk.bytesize
          end
        end
      end

      Rails.logger.info "[TenantBackup] Downloaded #{total_size} bytes to temp file"
      temp_file.rewind

      # Stream upload to S3
      if total_size > 100 * 1024 * 1024
        upload_multipart(key: key, file: temp_file, size: total_size, metadata: metadata)
      else
        client.put_object(
          bucket: bucket,
          key: key,
          body: temp_file,
          metadata: metadata.transform_values(&:to_s)
        )
      end

      Rails.logger.info "[TenantBackup] Uploaded: #{key} (#{total_size} bytes) to #{credential.name}"

      {
        key: key,
        size: total_size,
        uploaded_at: Time.current
      }
    end
  end

  # Multipart upload for large files (> 100MB)
  def upload_multipart(key:, file:, size:, metadata: {})
    part_size = 10 * 1024 * 1024  # 10MB parts

    create_response = client.create_multipart_upload(
      bucket: bucket,
      key: key,
      metadata: metadata.transform_values(&:to_s)
    )
    upload_id = create_response.upload_id

    parts = []
    part_number = 1

    begin
      while (chunk = file.read(part_size))
        upload_response = client.upload_part(
          bucket: bucket,
          key: key,
          upload_id: upload_id,
          part_number: part_number,
          body: chunk
        )

        parts << { etag: upload_response.etag, part_number: part_number }
        Rails.logger.info "[TenantBackup] Uploaded part #{part_number} (#{chunk.bytesize} bytes)"
        part_number += 1
      end

      client.complete_multipart_upload(
        bucket: bucket,
        key: key,
        upload_id: upload_id,
        multipart_upload: { parts: parts }
      )
    rescue => e
      client.abort_multipart_upload(
        bucket: bucket,
        key: key,
        upload_id: upload_id
      )
      raise e
    end
  end

  # Download content from backup storage
  # @param key [String] The storage key (path)
  # @return [String] The content
  def download(key)
    response = client.get_object(bucket: bucket, key: key)
    response.body.read
  rescue Aws::S3::Errors::NoSuchKey
    raise NotFoundError, "Backup not found: #{key}"
  end

  # List objects in a prefix
  # @param prefix [String] The prefix (folder path)
  # @return [Array<Hash>] List of objects with :key, :size, :last_modified
  def list(prefix)
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
    client.delete_object(bucket: bucket, key: key)
    Rails.logger.info "[TenantBackup] Deleted: #{key} from #{credential.name}"
    true
  end

  # Cleanup old backups, keeping the most recent N
  # @param prefix [String] The prefix (folder path)
  # @param keep [Integer] Number of backups to keep
  # @return [Integer] Number of backups deleted
  def cleanup_old_backups(prefix, keep:)
    objects = list(prefix)
    return 0 if objects.size <= keep

    to_delete = objects[keep..]
    deleted_count = 0

    to_delete.each do |obj|
      delete(obj[:key])
      deleted_count += 1
    end

    Rails.logger.info "[TenantBackup] Cleanup: deleted #{deleted_count} old backups from #{prefix}"
    deleted_count
  end

  # Copy an object to another service (for mirroring)
  # @param key [String] Source key
  # @param target_service [TenantBackupService] Target service to copy to
  # @return [Hash] Copy result
  def copy_to(key, target_service)
    content = download(key)
    target_service.upload(key: key, content: content)
  end

  # Get storage stats
  # @return [Hash] Stats including :total_size, :object_count, :by_prefix
  def stats
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

  # Test connection to the storage provider
  # @return [Hash] { success: true/false, error: message }
  def test_connection
    # Try to list objects (empty prefix)
    client.list_objects_v2(bucket: bucket, max_keys: 1)
    { success: true }
  rescue => e
    { success: false, error: e.message }
  end

  private

  def client
    @client ||= Aws::S3::Client.new(
      access_key_id: credential.access_key_id,
      secret_access_key: credential.secret_access_key,
      region: credential.region || "us-east-1",
      endpoint: credential.endpoint,
      force_path_style: true
    )
  end

  # SSoT (Jan 2026): bucket comes from WarehouseProvider, not credential
  def bucket
    @bucket ||= WarehouseProvider.instance&.bucket
    raise NotConfiguredError, "No bucket configured. Set bucket in Storage Configuration first." unless @bucket.present?
    @bucket
  end
end
