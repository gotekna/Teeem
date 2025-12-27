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
module DocumentProviders
  class S3Compatible < Base
    # Factory method to create a provider for an organization
    # @param organization [Organization] The organization
    # @return [DocumentProviders::S3Compatible] The provider instance
    def self.for_organization(organization)
      # TODO: Implement S3CompatibleCredential model
      # credential = S3CompatibleCredential.active.where(organization_id: organization.id).first
      # raise NotConnectedError, "S3 storage not configured." unless credential
      # new(credential)
      raise NotConnectedError, "S3-compatible storage not yet implemented. Coming soon!"
    end

    def initialize(credential)
      super(credential)
      # TODO: Initialize AWS SDK client
      # @client = Aws::S3::Client.new(
      #   endpoint: credential.endpoint,
      #   region: credential.region,
      #   access_key_id: credential.access_key_id,
      #   secret_access_key: credential.secret_access_key
      # )
      # @bucket = credential.bucket
    end

    # ====================
    # PROVIDER IDENTITY
    # ====================

    def provider_type
      :s3_compatible
    end

    def connected?
      return false unless @credential.present?
      # TODO: Test connection by listing bucket
      # @client.head_bucket(bucket: @bucket)
      # true
      false
    rescue StandardError
      false
    end

    # ====================
    # FOLDER OPERATIONS
    # Note: S3 doesn't have real folders, just key prefixes
    # ====================

    def list_folder(path, options = {})
      prefix = path_to_prefix(path)
      # TODO: Implement
      # response = @client.list_objects_v2(
      #   bucket: @bucket,
      #   prefix: prefix,
      #   delimiter: "/"
      # )
      # Normalize response to standard format
      raise NotImplementedError, "S3Compatible#list_folder not yet implemented"
    end

    def create_folder(path, options = {})
      # S3 folders are just empty objects ending with /
      prefix = path_to_prefix(path)
      prefix = "#{prefix}/" unless prefix.end_with?("/")
      # TODO: Implement
      # @client.put_object(bucket: @bucket, key: prefix, body: "")
      raise NotImplementedError, "S3Compatible#create_folder not yet implemented"
    end

    def folder_exists?(path)
      prefix = path_to_prefix(path)
      # TODO: Check if any objects exist with this prefix
      raise NotImplementedError, "S3Compatible#folder_exists? not yet implemented"
    end

    def get_folder(path)
      raise NotImplementedError, "S3Compatible#get_folder not yet implemented"
    end

    # ====================
    # FILE OPERATIONS
    # ====================

    def upload_file(folder_path, content, filename, options = {})
      key = "#{path_to_prefix(folder_path)}/#{filename}".gsub(%r{^/+}, "")
      content = content.read if content.respond_to?(:read)
      # TODO: Implement
      # @client.put_object(bucket: @bucket, key: key, body: content)
      raise NotImplementedError, "S3Compatible#upload_file not yet implemented"
    end

    def download_file(path_or_id)
      key = path_to_prefix(path_or_id)
      # TODO: Implement
      # response = @client.get_object(bucket: @bucket, key: key)
      # response.body.read
      raise NotImplementedError, "S3Compatible#download_file not yet implemented"
    end

    def download_url(path_or_id, options = {})
      key = path_to_prefix(path_or_id)
      expires_in = options.fetch(:expires_in, 3600)
      # TODO: Generate presigned URL
      # signer = Aws::S3::Presigner.new(client: @client)
      # signer.presigned_url(:get_object, bucket: @bucket, key: key, expires_in: expires_in)
      raise NotImplementedError, "S3Compatible#download_url not yet implemented"
    end

    def get_file(path_or_id)
      key = path_to_prefix(path_or_id)
      # TODO: Implement head_object
      raise NotImplementedError, "S3Compatible#get_file not yet implemented"
    end

    def delete_file(path_or_id)
      key = path_to_prefix(path_or_id)
      # TODO: Implement
      # @client.delete_object(bucket: @bucket, key: key)
      raise NotImplementedError, "S3Compatible#delete_file not yet implemented"
    end

    def rename_file(path_or_id, new_name)
      # S3 doesn't support rename - must copy then delete
      raise NotImplementedError, "S3Compatible#rename_file not yet implemented"
    end

    def copy_file(source_path_or_id, destination_folder, new_name = nil)
      raise NotImplementedError, "S3Compatible#copy_file not yet implemented"
    end

    def move_file(source_path_or_id, destination_folder, new_name = nil)
      # S3 doesn't support move - must copy then delete
      raise NotImplementedError, "S3Compatible#move_file not yet implemented"
    end

    # ====================
    # SEARCH
    # ====================

    def search(query, options = {})
      # S3 doesn't have search - must list and filter
      raise NotImplementedError, "S3Compatible#search not yet implemented"
    end

    # ====================
    # THUMBNAILS
    # ====================

    def thumbnail_url(path_or_id, options = {})
      # S3 doesn't generate thumbnails - return nil or implement with Lambda
      nil
    end

    # ====================
    # NATIVE CLIENT ACCESS
    # ====================

    def native_client
      @client
    end

    private

    # Convert a path to an S3 key prefix
    def path_to_prefix(path)
      return "" if path.blank? || path == "/"
      path.sub(%r{^/+}, "").sub(%r{/+$}, "")
    end
  end
end
