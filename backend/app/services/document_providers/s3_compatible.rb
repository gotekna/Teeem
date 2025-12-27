# frozen_string_literal: true

# DocumentProviders::S3Compatible - S3-compatible document provider
#
# Supports AWS S3, Backblaze B2, MinIO, Wasabi, Synology NAS, and any S3-compatible storage.
#
# Configuration required:
#   - endpoint: S3 endpoint URL (optional for AWS, required for others)
#   - region: AWS region or equivalent
#   - access_key_id: Access key
#   - secret_access_key: Secret key
#   - bucket: Bucket name
#
# Usage:
#   provider = DocumentProviders::S3Compatible.for_organization(organization)
#   provider.list_folder("/jobs/JOB-001")
#   provider.upload_file("/jobs/JOB-001", content, "invoice.pdf")
#
# Note: S3 uses prefixes (key prefixes) to simulate folders.
# The path "/jobs/JOB-001/invoice.pdf" becomes the key "jobs/JOB-001/invoice.pdf"
#
# Backblaze B2 Configuration:
#   - endpoint: https://s3.{region}.backblazeb2.com
#   - region: us-west-004 (extracted from endpoint)
#   - Requires aws-sdk-s3 gem >= 1.131.0
#
module DocumentProviders
  class S3Compatible < Base
    # Chunk size for multipart uploads (5MB minimum for S3)
    MULTIPART_THRESHOLD = 5 * 1024 * 1024  # 5MB
    MULTIPART_CHUNK_SIZE = 5 * 1024 * 1024  # 5MB

    # Factory method to create a provider for an organization
    # @param organization [Organization] The organization
    # @return [DocumentProviders::S3Compatible] The provider instance
    def self.for_organization(organization)
      credential = find_credential_for_organization(organization)
      raise NotConnectedError, "S3 storage not configured. Please configure in Admin > System > Storage." unless credential
      new(credential)
    end

    # Find credential for organization
    def self.find_credential_for_organization(organization)
      return nil unless defined?(S3CompatibleCredential)

      # Try org-specific credential first
      if organization&.id
        cred = S3CompatibleCredential.active.connected.where(organization_id: organization.id).first
        return cred if cred
      end

      # Fall back to global credential (no org)
      S3CompatibleCredential.active.connected.where(organization_id: nil).first
    end

    def initialize(credential)
      super(credential)
      @client = credential.build_client
      @bucket = credential.bucket
      @root_path = credential.root_path.to_s.sub(%r{^/+}, "").sub(%r{/+$}, "")
    end

    # ====================
    # PROVIDER IDENTITY
    # ====================

    def provider_type
      :s3_compatible
    end

    def connected?
      return false unless @credential.present?
      @client.head_bucket(bucket: @bucket)
      true
    rescue Aws::S3::Errors::ServiceError
      false
    end

    # ====================
    # FOLDER OPERATIONS
    # Note: S3 doesn't have real folders, just key prefixes
    # ====================

    def list_folder(path, options = {})
      prefix = build_key(path)
      prefix = "#{prefix}/" if prefix.present? && !prefix.end_with?("/")

      delimiter = options.fetch(:recursive, false) ? nil : "/"
      items = []

      # List objects with pagination
      continuation_token = nil
      loop do
        params = {
          bucket: @bucket,
          prefix: prefix,
          delimiter: delimiter,
          max_keys: 1000
        }
        params[:continuation_token] = continuation_token if continuation_token

        response = @client.list_objects_v2(params)

        # Add "folders" (common prefixes)
        if response.common_prefixes
          response.common_prefixes.each do |cp|
            items << normalize_prefix(cp.prefix, prefix)
          end
        end

        # Add files
        if response.contents
          response.contents.each do |obj|
            # Skip the prefix itself (empty folder marker)
            next if obj.key == prefix
            items << normalize_object(obj, prefix)
          end
        end

        break unless response.is_truncated
        continuation_token = response.next_continuation_token
      end

      items
    end

    def create_folder(path, options = {})
      # S3 folders are just empty objects ending with /
      key = build_key(path)
      key = "#{key}/" unless key.end_with?("/")

      @client.put_object(
        bucket: @bucket,
        key: key,
        body: ""
      )

      {
        id: key,
        name: File.basename(path),
        type: :folder,
        path: "/#{strip_root_path(key).chomp('/')}"
      }
    end

    def folder_exists?(path)
      prefix = build_key(path)
      prefix = "#{prefix}/" if prefix.present? && !prefix.end_with?("/")

      response = @client.list_objects_v2(
        bucket: @bucket,
        prefix: prefix,
        max_keys: 1
      )

      response.key_count > 0
    rescue Aws::S3::Errors::ServiceError
      false
    end

    def get_folder(path)
      key = build_key(path)
      key = "#{key}/" unless key.end_with?("/")

      # Check if folder exists (has any objects with prefix)
      response = @client.list_objects_v2(
        bucket: @bucket,
        prefix: key,
        max_keys: 1
      )

      raise NotFoundError, "Folder not found: #{path}" if response.key_count == 0

      {
        id: key,
        name: File.basename(path),
        type: :folder,
        path: "/#{strip_root_path(key).chomp('/')}",
        created_at: nil,  # S3 doesn't track folder creation time
        modified_at: nil
      }
    end

    # ====================
    # FILE OPERATIONS
    # ====================

    def upload_file(folder_path, content, filename, options = {})
      key = "#{build_key(folder_path)}/#{filename}".gsub(%r{/+}, "/")
      content = content.read if content.respond_to?(:read)
      content_type = options[:content_type] || detect_content_type(filename)

      if content.bytesize > MULTIPART_THRESHOLD
        # Use multipart upload for large files
        upload_multipart(key, content, content_type)
      else
        # Simple upload for small files
        @client.put_object(
          bucket: @bucket,
          key: key,
          body: content,
          content_type: content_type
        )
      end

      {
        id: key,
        name: filename,
        path: "/#{strip_root_path(key)}",
        size: content.bytesize,
        mime_type: content_type
      }
    end

    def download_file(path_or_id)
      key = resolve_key(path_or_id)
      response = @client.get_object(bucket: @bucket, key: key)
      response.body.read
    rescue Aws::S3::Errors::NoSuchKey
      raise NotFoundError, "File not found: #{path_or_id}"
    end

    def download_url(path_or_id, options = {})
      key = resolve_key(path_or_id)
      expires_in = options.fetch(:expires_in, 3600)

      signer = Aws::S3::Presigner.new(client: @client)
      signer.presigned_url(
        :get_object,
        bucket: @bucket,
        key: key,
        expires_in: expires_in
      )
    end

    def get_file(path_or_id)
      key = resolve_key(path_or_id)

      response = @client.head_object(bucket: @bucket, key: key)

      {
        id: key,
        name: File.basename(key),
        type: :file,
        size: response.content_length,
        mime_type: response.content_type,
        created_at: nil,  # S3 doesn't track creation time
        modified_at: response.last_modified,
        path: "/#{strip_root_path(key)}",
        etag: response.etag
      }
    rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchKey
      raise NotFoundError, "File not found: #{path_or_id}"
    end

    def delete_file(path_or_id)
      key = resolve_key(path_or_id)
      @client.delete_object(bucket: @bucket, key: key)
      true
    rescue Aws::S3::Errors::NoSuchKey
      raise NotFoundError, "File not found: #{path_or_id}"
    end

    def rename_file(path_or_id, new_name)
      old_key = resolve_key(path_or_id)
      new_key = File.join(File.dirname(old_key), new_name)

      # Copy to new location
      @client.copy_object(
        bucket: @bucket,
        copy_source: "#{@bucket}/#{old_key}",
        key: new_key
      )

      # Delete old file
      @client.delete_object(bucket: @bucket, key: old_key)

      get_file(new_key)
    rescue Aws::S3::Errors::NoSuchKey
      raise NotFoundError, "File not found: #{path_or_id}"
    end

    def copy_file(source_path_or_id, destination_folder, new_name = nil)
      source_key = resolve_key(source_path_or_id)
      dest_folder_key = build_key(destination_folder)
      filename = new_name || File.basename(source_key)
      dest_key = "#{dest_folder_key}/#{filename}".gsub(%r{/+}, "/")

      @client.copy_object(
        bucket: @bucket,
        copy_source: "#{@bucket}/#{source_key}",
        key: dest_key
      )

      get_file(dest_key)
    rescue Aws::S3::Errors::NoSuchKey
      raise NotFoundError, "Source file not found: #{source_path_or_id}"
    end

    def move_file(source_path_or_id, destination_folder, new_name = nil)
      # Copy then delete
      result = copy_file(source_path_or_id, destination_folder, new_name)
      source_key = resolve_key(source_path_or_id)
      @client.delete_object(bucket: @bucket, key: source_key)
      result
    end

    # ====================
    # SEARCH
    # ====================

    def search(query, options = {})
      # S3 doesn't have native search - list all and filter
      folder_path = options[:folder_path]
      limit = options.fetch(:limit, 100)

      prefix = folder_path ? build_key(folder_path) : @root_path
      prefix = "#{prefix}/" if prefix.present? && !prefix.end_with?("/")

      query_downcase = query.downcase
      items = []

      continuation_token = nil
      loop do
        params = {
          bucket: @bucket,
          prefix: prefix,
          max_keys: 1000
        }
        params[:continuation_token] = continuation_token if continuation_token

        response = @client.list_objects_v2(params)

        response.contents&.each do |obj|
          filename = File.basename(obj.key)
          if filename.downcase.include?(query_downcase)
            items << normalize_object(obj, prefix)
            break if items.size >= limit
          end
        end

        break if items.size >= limit
        break unless response.is_truncated
        continuation_token = response.next_continuation_token
      end

      items.take(limit)
    end

    # ====================
    # THUMBNAILS
    # ====================

    def thumbnail_url(path_or_id, options = {})
      # S3 doesn't generate thumbnails
      # Could implement with Lambda@Edge or CloudFront Functions in future
      nil
    end

    # ====================
    # NATIVE CLIENT ACCESS
    # ====================

    def native_client
      @client
    end

    # ====================
    # S3-SPECIFIC METHODS
    # ====================

    # Get presigned URL for direct upload (browser uploads)
    def presigned_upload_url(folder_path, filename, options = {})
      key = "#{build_key(folder_path)}/#{filename}".gsub(%r{/+}, "/")
      expires_in = options.fetch(:expires_in, 3600)
      content_type = options[:content_type] || detect_content_type(filename)

      signer = Aws::S3::Presigner.new(client: @client)
      signer.presigned_url(
        :put_object,
        bucket: @bucket,
        key: key,
        expires_in: expires_in,
        content_type: content_type
      )
    end

    # Delete all files with a prefix (delete folder and contents)
    def delete_folder(path)
      prefix = build_key(path)
      prefix = "#{prefix}/" unless prefix.end_with?("/")

      # List all objects
      objects = []
      continuation_token = nil

      loop do
        params = {
          bucket: @bucket,
          prefix: prefix,
          max_keys: 1000
        }
        params[:continuation_token] = continuation_token if continuation_token

        response = @client.list_objects_v2(params)

        response.contents&.each do |obj|
          objects << { key: obj.key }
        end

        break unless response.is_truncated
        continuation_token = response.next_continuation_token
      end

      return true if objects.empty?

      # Delete in batches of 1000
      objects.each_slice(1000) do |batch|
        @client.delete_objects(
          bucket: @bucket,
          delete: { objects: batch }
        )
      end

      true
    end

    private

    # Build the full S3 key including root path
    def build_key(path)
      path = path.to_s.sub(%r{^/+}, "").sub(%r{/+$}, "")
      return @root_path if path.blank?
      return path if @root_path.blank?
      "#{@root_path}/#{path}"
    end

    # Strip root path from key for display
    def strip_root_path(key)
      return key if @root_path.blank?
      key.sub(/^#{Regexp.escape(@root_path)}\/?/, "")
    end

    # Resolve a path or key to an S3 key
    def resolve_key(path_or_id)
      # If it looks like a full key (contains root path), use directly
      if @root_path.present? && path_or_id.start_with?(@root_path)
        path_or_id
      else
        build_key(path_or_id)
      end
    end

    # Normalize an S3 object to standard format
    def normalize_object(obj, prefix)
      key = obj.key
      relative_key = strip_root_path(key)

      {
        id: key,
        name: File.basename(key),
        type: :file,
        size: obj.size,
        mime_type: detect_content_type(key),
        created_at: nil,
        modified_at: obj.last_modified,
        path: "/#{relative_key}",
        etag: obj.etag
      }
    end

    # Normalize a common prefix (folder) to standard format
    def normalize_prefix(prefix_key, parent_prefix)
      relative_key = strip_root_path(prefix_key).chomp("/")
      name = File.basename(relative_key)

      {
        id: prefix_key,
        name: name,
        type: :folder,
        size: nil,
        mime_type: nil,
        created_at: nil,
        modified_at: nil,
        path: "/#{relative_key}"
      }
    end

    # Detect content type from filename
    def detect_content_type(filename)
      extension = File.extname(filename).downcase
      CONTENT_TYPES[extension] || "application/octet-stream"
    end

    # Multipart upload for large files
    def upload_multipart(key, content, content_type)
      # Create multipart upload
      response = @client.create_multipart_upload(
        bucket: @bucket,
        key: key,
        content_type: content_type
      )
      upload_id = response.upload_id

      begin
        parts = []
        part_number = 1
        offset = 0

        while offset < content.bytesize
          chunk = content[offset, MULTIPART_CHUNK_SIZE]

          part_response = @client.upload_part(
            bucket: @bucket,
            key: key,
            upload_id: upload_id,
            part_number: part_number,
            body: chunk
          )

          parts << { part_number: part_number, etag: part_response.etag }
          part_number += 1
          offset += MULTIPART_CHUNK_SIZE
        end

        # Complete multipart upload
        @client.complete_multipart_upload(
          bucket: @bucket,
          key: key,
          upload_id: upload_id,
          multipart_upload: { parts: parts }
        )
      rescue StandardError => e
        # Abort on error
        @client.abort_multipart_upload(
          bucket: @bucket,
          key: key,
          upload_id: upload_id
        )
        raise e
      end
    end

    # Common MIME types
    CONTENT_TYPES = {
      ".pdf" => "application/pdf",
      ".doc" => "application/msword",
      ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls" => "application/vnd.ms-excel",
      ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".ppt" => "application/vnd.ms-powerpoint",
      ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".txt" => "text/plain",
      ".csv" => "text/csv",
      ".json" => "application/json",
      ".xml" => "application/xml",
      ".html" => "text/html",
      ".htm" => "text/html",
      ".jpg" => "image/jpeg",
      ".jpeg" => "image/jpeg",
      ".png" => "image/png",
      ".gif" => "image/gif",
      ".bmp" => "image/bmp",
      ".webp" => "image/webp",
      ".svg" => "image/svg+xml",
      ".mp3" => "audio/mpeg",
      ".wav" => "audio/wav",
      ".mp4" => "video/mp4",
      ".avi" => "video/x-msvideo",
      ".mov" => "video/quicktime",
      ".zip" => "application/zip",
      ".rar" => "application/x-rar-compressed",
      ".7z" => "application/x-7z-compressed",
      ".tar" => "application/x-tar",
      ".gz" => "application/gzip"
    }.freeze
  end
end
