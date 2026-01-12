# frozen_string_literal: true

require "active_storage/service"
require "aws-sdk-s3"

module ActiveStorage
  class Service
    # ActiveStorage service for Wasabi (S3-compatible) storage
    # SSoT: Reads credentials from S3CompatibleCredential.active
    #
    # Configuration in config/storage.yml:
    #   wasabi:
    #     service: Wasabi
    #     folder: ActiveStorage  # Base folder for all uploads (optional)
    #
    # Files are stored as: [bucket]/[folder]/[key[0..1]]/[key[2..3]]/[key]
    #
    class WasabiService < Service
      # Upload content to Wasabi
      # Folder path read from StorageConfiguration.path_for(:attachments) - SSoT

      # Upload content to Wasabi
      def upload(key, io, checksum: nil, **)
        instrument :upload, key: key, checksum: checksum do
          object_key = object_key_for(key)

          client.put_object(
            bucket: bucket,
            key: object_key,
            body: io,
            content_md5: checksum
          )
        end
      end

      # Download file from Wasabi
      def download(key, &block)
        if block_given?
          instrument :streaming_download, key: key do
            stream(key, &block)
          end
        else
          instrument :download, key: key do
            object_key = object_key_for(key)
            response = client.get_object(bucket: bucket, key: object_key)
            response.body.read
          rescue Aws::S3::Errors::NoSuchKey
            raise ActiveStorage::FileNotFoundError
          end
        end
      end

      # Download a chunk of the file
      def download_chunk(key, range)
        instrument :download_chunk, key: key, range: range do
          object_key = object_key_for(key)
          response = client.get_object(
            bucket: bucket,
            key: object_key,
            range: "bytes=#{range.begin}-#{range.end}"
          )
          response.body.read
        rescue Aws::S3::Errors::NoSuchKey
          raise ActiveStorage::FileNotFoundError
        end
      end

      # Delete file from Wasabi
      def delete(key)
        instrument :delete, key: key do
          object_key = object_key_for(key)
          client.delete_object(bucket: bucket, key: object_key)
        rescue Aws::S3::Errors::NoSuchKey
          # Ignore if already deleted
        end
      end

      # Delete files by prefix (for variants/previews cleanup)
      def delete_prefixed(prefix)
        instrument :delete_prefixed, prefix: prefix do
          # List objects with prefix
          response = client.list_objects_v2(
            bucket: bucket,
            prefix: "#{folder}/#{prefix}"
          )

          return if response.contents.empty?

          # Delete all matching objects
          objects = response.contents.map { |obj| { key: obj.key } }
          client.delete_objects(
            bucket: bucket,
            delete: { objects: objects }
          )
        end
      end

      # Check if file exists
      def exist?(key)
        instrument :exist, key: key do |payload|
          object_key = object_key_for(key)
          client.head_object(bucket: bucket, key: object_key)
          payload[:exist] = true
        rescue Aws::S3::Errors::NotFound
          payload[:exist] = false
        end
      end

      # Generate a presigned URL for direct download
      def url_for_direct_upload(key, expires_in:, content_type:, content_length:, checksum:, **)
        instrument :url, key: key do |payload|
          object_key = object_key_for(key)
          presigner = Aws::S3::Presigner.new(client: client)

          url = presigner.presigned_url(
            :put_object,
            bucket: bucket,
            key: object_key,
            expires_in: expires_in.to_i,
            content_type: content_type,
            content_length: content_length,
            content_md5: checksum
          )

          payload[:url] = url
          url
        end
      end

      # Generate headers for direct upload
      def headers_for_direct_upload(key, content_type:, checksum:, **)
        {
          "Content-Type" => content_type,
          "Content-MD5" => checksum
        }
      end

      private

      # Get S3 client (lazy initialization from S3CompatibleCredential)
      def client
        @client ||= begin
          credential = S3CompatibleCredential.active.first
          raise "No active S3/Wasabi credential configured" unless credential

          Aws::S3::Client.new(
            endpoint: credential.endpoint,
            region: credential.region || "us-east-1",
            access_key_id: credential.access_key_id,
            secret_access_key: credential.secret_access_key,
            force_path_style: true  # Required for Wasabi
          )
        end
      end

      # Get bucket name from credential
      def bucket
        @bucket ||= begin
          credential = S3CompatibleCredential.active.first
          raise "No active S3/Wasabi credential configured" unless credential
          credential.bucket
        end
      end

      # Generate object key with folder structure for organization
      # SSoT: Reads folder from StorageConfiguration.path_for(:attachments)
      # Pattern: [folder]/[key[0..1]]/[key[2..3]]/[key]
      def object_key_for(key)
        "#{folder}/#{key[0..1]}/#{key[2..3]}/#{key}"
      end

      # Get folder path from StorageConfiguration (SSoT)
      def folder
        @folder ||= StorageConfiguration.instance&.path_for(:attachments) || "Warehousing/Chat"
      end

      # Stream file content in chunks
      def stream(key)
        object_key = object_key_for(key)
        response = client.get_object(bucket: bucket, key: object_key)

        chunk_size = 5.megabytes
        while (chunk = response.body.read(chunk_size))
          yield chunk
        end
      rescue Aws::S3::Errors::NoSuchKey
        raise ActiveStorage::FileNotFoundError
      end
    end
  end
end
