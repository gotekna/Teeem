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

    # SSoT: Factory method to create provider for a tenant (Jan 2026 fix)
    # @param tenant [Tenant] The tenant
    # @return [DocumentProviders::S3Compatible] The provider instance
    def self.for_tenant(tenant)
      credential = find_credential_for_tenant(tenant)
      raise NotConnectedError, "S3 storage not configured. Please configure in Admin > System > Storage." unless credential
      new(credential, tenant: tenant)
    end

    # DEPRECATED: Use for_tenant instead
    # Factory method to create a provider for an organization
    # @param organization [Organization] The organization
    # @return [DocumentProviders::S3Compatible] The provider instance
    def self.for_organization(organization)
      Rails.logger.warn "[DEPRECATED] S3Compatible.for_organization - use for_tenant instead"
      credential = find_credential_for_organization(organization)
      raise NotConnectedError, "S3 storage not configured. Please configure in Admin > System > Storage." unless credential
      new(credential, tenant: organization&.tenant)
    end

    # Find credential for tenant (SSoT: Jan 2026 fix)
    def self.find_credential_for_tenant(tenant)
      return nil unless defined?(S3CompatibleCredential)
      return nil unless tenant

      # Get all organizations in this tenant
      org_ids = tenant.organizations.pluck(:id)

      # Try tenant's org-specific credentials first
      if org_ids.any?
        cred = S3CompatibleCredential.active.connected.where(organization_id: org_ids).first
        return cred if cred
      end

      # Fall back to global credential (no org)
      S3CompatibleCredential.active.connected.where(organization_id: nil).first
    end

    # Find credential for organization (legacy)
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

    def initialize(credential, tenant: nil)
      super(credential)
      @client = credential.build_client
      @tenant = tenant

      # SSoT: StorageConfiguration.connection_config['bucket'] is THE ONE source (Jan 2026)
      # No fallback to credential - fail fast if bucket not configured
      config = tenant ? StorageConfiguration.for_tenant(tenant) : StorageConfiguration.instance
      @bucket = config&.connection_config&.dig("bucket").presence
      raise DocumentProviders::ConfigurationError, "Bucket not configured in StorageConfiguration (SSoT). Configure at /settings/company/connections" unless @bucket
      @root_path = config&.root_path.to_s.sub(%r{^/+}, "").sub(%r{/+$}, "")
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

    # Generate presigned download URL
    # @param path_or_id [String] File path or S3 key
    # @param options [Hash] Options
    # @option options [Integer] :expires_in Expiry time in seconds (default: 3600)
    # @option options [String] :filename Custom download filename (Send Name)
    #   When provided, browser downloads will save with this name instead of S3 key
    # @return [String] Presigned download URL
    #
    # ⚠️ Uses virtual-hosted style URLs to avoid 307 redirects that break browser CORS
    def download_url(path_or_id, options = {})
      key = resolve_key(path_or_id)
      expires_in = options.fetch(:expires_in, 3600)
      filename = options[:filename]
      disposition = options.fetch(:disposition, :attachment) # :attachment or :inline

      presign_params = {
        bucket: @bucket,
        key: key,
        expires_in: expires_in
      }

      # SSoT: Send Name - custom filename for downloads
      # Uses Content-Disposition header to override browser download filename
      # disposition: :attachment forces download, :inline allows browser to display
      if filename.present?
        # Sanitize and encode filename for Content-Disposition header
        safe_filename = sanitize_download_filename(filename)
        presign_params[:response_content_disposition] = "#{disposition}; filename=\"#{safe_filename}\""
      elsif disposition == :inline
        # For inline without filename, just set disposition
        presign_params[:response_content_disposition] = "inline"
      end

      # Use browser-safe client with virtual-hosted style URLs
      # CORS preflight cannot follow 307 redirects from path-style to virtual-hosted
      browser_client = build_browser_safe_client
      signer = Aws::S3::Presigner.new(client: browser_client)
      signer.presigned_url(:get_object, presign_params)
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

    # Rename a folder (all objects with prefix) to new path
    # S3 has no native folder rename - copies all objects then deletes originals
    # @param old_path [String] Current folder path (e.g., "Emails/eml")
    # @param new_path [String] New folder path (e.g., "Emails/Email Body")
    # @return [Hash] { success: true, moved_count: N } or { success: false, error: "..." }
    def rename_folder(old_path, new_path)
      old_prefix = build_key(old_path)
      old_prefix = old_prefix.end_with?("/") ? old_prefix : "#{old_prefix}/"
      new_prefix = build_key(new_path)
      new_prefix = new_prefix.end_with?("/") ? new_prefix : "#{new_prefix}/"

      moved_count = 0
      continuation_token = nil

      loop do
        # List all objects with old prefix
        list_params = { bucket: @bucket, prefix: old_prefix }
        list_params[:continuation_token] = continuation_token if continuation_token
        response = @client.list_objects_v2(list_params)

        (response.contents || []).each do |object|
          old_key = object.key
          new_key = old_key.sub(old_prefix, new_prefix)

          # Copy to new location
          @client.copy_object(
            bucket: @bucket,
            copy_source: "#{@bucket}/#{URI.encode_www_form_component(old_key)}",
            key: new_key
          )

          # Delete old
          @client.delete_object(bucket: @bucket, key: old_key)
          moved_count += 1
          Rails.logger.info "[S3Compatible] Moved: #{old_key} -> #{new_key}"
        end

        break unless response.is_truncated
        continuation_token = response.next_continuation_token
      end

      Rails.logger.info "[S3Compatible] rename_folder complete: #{old_path} -> #{new_path} (#{moved_count} objects)"
      { success: true, moved_count: moved_count }
    rescue => e
      Rails.logger.error "[S3Compatible] rename_folder failed: #{e.message}"
      { success: false, error: e.message }
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
    # TEEEM-SPECIFIC METHODS (for compatibility with SharePoint provider)
    # ====================

    # Create job folder structure (TEEEM-specific)
    # SSoT: Uses EntityTab hierarchy for folder names (no longer uses FolderTemplate)
    # @param job [Job] The job to create folders for
    # @param _template [deprecated] No longer used, kept for API compatibility
    # @return [Hash] The created job folder
    def create_job_folder_structure(job, _template = nil)
      # SSoT: Use StorageConfiguration.job_path for consistent folder naming (job_code = "J" + id)
      job_folder_path = StorageConfiguration.instance&.job_path(job.job_code) || "/Jobs/#{job.job_code}"

      # Create main job folder
      job_folder = create_folder(job_folder_path)

      # SSoT: Create subfolders from EntityTab hierarchy
      create_subfolders_from_entity_tabs(job_folder_path)

      job_folder
    end

    # SSoT: Create subfolders from EntityTab hierarchy
    def create_subfolders_from_entity_tabs(parent_path)
      root_tabs = EntityTab.for_jobs
                           .where(has_storage_folder: true)
                           .enabled
                           .root_tabs
                           .ordered
                           .includes(children: { children: :children })

      root_tabs.each do |tab|
        create_entity_tab_folder_recursive(tab, parent_path)
      end
    end

    # Recursively create folders for an EntityTab and its children
    def create_entity_tab_folder_recursive(tab, parent_path)
      folder_path = "#{parent_path}/#{tab.display_name}"
      create_folder(folder_path)

      Rails.logger.info "[EntityTab SSoT] Created S3 folder: #{folder_path}"

      tab.children.where(has_storage_folder: true).enabled.ordered.each do |child|
        create_entity_tab_folder_recursive(child, folder_path)
      end
    end

    # Find job folder (TEEEM-specific)
    # @param job [Job] The job to find folder for
    # @return [Hash, nil] The folder info or nil if not found
    def find_job_folder(job)
      # SSoT: Use StorageConfiguration.job_path for consistent folder naming (job_code = "J" + id)
      job_folder_path = StorageConfiguration.instance&.job_path(job.job_code) || "/Jobs/#{job.job_code}"

      return nil unless folder_exists?(job_folder_path)

      get_folder(job_folder_path)
    rescue NotFoundError
      nil
    end

    # Validate root folder exists
    # @return [Hash] Validation result with :valid, :error, :error_type
    def validate_root_folder
      # For S3, just check if we can access the bucket
      @client.head_bucket(bucket: @bucket)

      # Check if root path exists (or is empty, which is fine for S3)
      if @root_path.present?
        # Create root path if it doesn't exist (S3 is lazy about folders)
        create_folder("/") unless folder_exists?("/")
      end

      { valid: true }
    rescue Aws::S3::Errors::NotFound
      { valid: false, error: "Bucket not found: #{@bucket}", error_type: "not_found" }
    rescue Aws::S3::Errors::Forbidden
      { valid: false, error: "Access denied to bucket: #{@bucket}", error_type: "permission_denied" }
    rescue Aws::S3::Errors::ServiceError => e
      { valid: false, error: e.message, error_type: "error" }
    end

    # ====================
    # S3-SPECIFIC METHODS
    # ====================

    # Get presigned URL for direct upload (browser uploads)
    # Uses virtual-hosted style URLs to avoid 307 redirects that break browser CORS
    def presigned_upload_url(folder_path, filename, options = {})
      # Build key and normalize: collapse multiple slashes, remove leading slash
      # S3 keys should not start with "/" - ensures consistency with get_file/download_file
      key = "#{build_key(folder_path)}/#{filename}".gsub(%r{/+}, "/").sub(%r{^/}, "")
      expires_in = options.fetch(:expires_in, 3600)
      content_type = options[:content_type] || detect_content_type(filename)

      # Create browser-safe client with virtual-hosted style URLs
      # CORS preflight cannot follow 307 redirects, so we must generate URLs in the
      # final format that S3-compatible services expect (virtual-hosted style)
      browser_client = build_browser_safe_client

      signer = Aws::S3::Presigner.new(client: browser_client)
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
      # Use quiet: true to suppress XML response (avoids parsing errors with special chars)
      objects.each_slice(1000) do |batch|
        @client.delete_objects(
          bucket: @bucket,
          delete: { objects: batch, quiet: true }
        )
      end

      true
    end

    private

    # Build S3 client safe for browser presigned URLs (virtual-hosted style)
    # ⚠️ DO NOT SIMPLIFY - CORS 307 redirect fix (Jan 2026)
    # ════════════════════════════════════════════════════════════════════
    # Why: Wasabi (and some other S3-compatible providers) redirect path-style URLs
    #      to virtual-hosted style URLs with a 307 redirect. Browser CORS preflight
    #      cannot follow redirects, causing upload failures.
    # ❌ WRONG: Use @client (has force_path_style: true) → generates path-style URLs
    #           → Wasabi 307 redirects → CORS fails → upload broken
    # ✅ CORRECT: Create separate client with force_path_style: false for browser uploads
    #            → AWS SDK auto-prepends bucket to endpoint → no redirect → works
    # ════════════════════════════════════════════════════════════════════
    def build_browser_safe_client
      # Normalize endpoint to path-style (strip bucket if present)
      # This handles the case where endpoint was saved in virtual-hosted format
      # e.g., https://bucket.s3.region.wasabisys.com → https://s3.region.wasabisys.com
      endpoint = normalize_endpoint_to_path_style(@credential.endpoint)

      # With force_path_style: false, AWS SDK automatically converts endpoint to
      # virtual-hosted style by prepending the bucket name to the host.
      # e.g., s3.region.wasabisys.com → bucket.s3.region.wasabisys.com
      Aws::S3::Client.new(
        access_key_id: @credential.access_key_id,
        secret_access_key: @credential.secret_access_key,
        region: @credential.region,
        endpoint: endpoint,
        force_path_style: false  # SDK prepends bucket for virtual-hosted style
      )
    end

    # Normalize endpoint to path-style by stripping bucket name prefix if present
    # e.g., https://teeem-documents.s3.ap-southeast-2.wasabisys.com → https://s3.ap-southeast-2.wasabisys.com
    def normalize_endpoint_to_path_style(endpoint)
      return endpoint if endpoint.blank?

      uri = URI.parse(endpoint)
      host = uri.host

      # Check if host starts with bucket name (virtual-hosted style)
      # Pattern: bucket.s3.region.provider.com
      if host.start_with?("#{@bucket}.")
        # Strip bucket prefix: teeem-documents.s3.region.com → s3.region.com
        uri.host = host.sub(/^#{Regexp.escape(@bucket)}\./, "")
        uri.to_s
      else
        endpoint
      end
    end

    # NOTE: default_subfolders and create_template_folders removed
    # SSoT: EntityTab is now the source of truth for folder structure

    # Sanitize filename for S3 (remove special characters)
    def sanitize_filename(filename)
      filename.to_s.gsub(/[<>:"|?*\\]/, "_").strip
    end

    # Sanitize filename for HTTP Content-Disposition header
    # Used for Send Name - the custom download filename
    # More restrictive than S3 filename sanitization (no quotes, control chars)
    def sanitize_download_filename(filename)
      return "document" if filename.blank?

      # Remove control characters and quotes (break Content-Disposition header)
      safe = filename.to_s.gsub(/[\x00-\x1f\x7f"\\]/, " ")

      # Replace invalid filesystem characters
      safe = safe.gsub(/[<>:|?*\/]/, " ")

      # Collapse multiple spaces and trim
      safe = safe.gsub(/\s+/, " ").strip

      # Ensure we have something left
      safe.presence || "document"
    end

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

    # SSoT: ContentTypeDetector (lib/utils/content_type_detector.rb)
    def detect_content_type(filename)
      ContentTypeDetector.detect(filename)
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
  end
end
