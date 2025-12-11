# frozen_string_literal: true

require "active_storage/service"

module ActiveStorage
  class Service
    # ActiveStorage service for SharePoint via Microsoft Graph API
    # Stores files in a SharePoint document library folder structure:
    #   [base_folder]/[key[0..1]]/[key[2..3]]/[key]
    #
    # Configuration in config/storage.yml:
    #   sharepoint:
    #     service: SharePoint
    #     site_name: TEEEM           # SharePoint site name to search for
    #     drive_name: Documents      # Drive name (optional, defaults to first drive)
    #     base_folder: ActiveStorage # Base folder for all uploads
    #
    class SharePointService < Service
      attr_reader :site_name, :drive_name, :base_folder

      def initialize(site_name:, drive_name: nil, base_folder: "ActiveStorage")
        @site_name = site_name
        @drive_name = drive_name
        @base_folder = base_folder
        @client = nil
        @site_id = nil
        @drive_id = nil
      end

      # Upload content to SharePoint
      def upload(key, io, checksum: nil, **)
        instrument :upload, key: key, checksum: checksum do
          content = io.read
          folder_path = folder_path_for(key)
          filename = key

          if client.large_file?(content.bytesize)
            # Large file upload (>= 4MB)
            session = client.create_upload_session(site_id, drive_id, folder_path, filename)
            client.upload_large_file(session["uploadUrl"], content)
          else
            # Small file upload (< 4MB)
            client.upload_file_content(site_id, drive_id, folder_path, filename, content)
          end
        end
      end

      # Download file from SharePoint
      def download(key, &block)
        if block_given?
          instrument :streaming_download, key: key do
            stream(key, &block)
          end
        else
          instrument :download, key: key do
            item = find_item(key)
            raise ActiveStorage::FileNotFoundError unless item

            client.get_drive_item_content(drive_id: drive_id, item_id: item[:id])
          end
        end
      end

      # Download a chunk of the file
      def download_chunk(key, range)
        instrument :download_chunk, key: key, range: range do
          # SharePoint doesn't support range requests directly through Graph API
          # Download full file and slice (not ideal for large files)
          content = download(key)
          content.byteslice(range)
        end
      end

      # Delete file from SharePoint
      def delete(key)
        instrument :delete, key: key do
          item = find_item(key)
          return unless item

          client.delete_drive_item(drive_id: drive_id, item_id: item[:id])
        rescue MicrosoftAppGraphClient::ApiError => e
          # Ignore if already deleted
          raise unless e.message.include?("itemNotFound") || e.message.include?("404")
        end
      end

      # Delete files by prefix (for variants/previews cleanup)
      def delete_prefixed(prefix)
        instrument :delete_prefixed, prefix: prefix do
          # Search for files with the prefix
          items = client.search_drive(drive_id, prefix)
          items.each do |item|
            next if item[:is_folder]
            next unless item[:name].start_with?(prefix)

            client.delete_drive_item(drive_id: drive_id, item_id: item[:id])
          rescue MicrosoftAppGraphClient::ApiError
            # Continue deleting others if one fails
          end
        end
      end

      # Check if file exists
      def exist?(key)
        instrument :exist, key: key do |payload|
          item = find_item(key)
          result = item.present?
          payload[:exist] = result
          result
        end
      end

      # Get file URL (signed URL not supported, return web URL for viewing)
      def url(key, expires_in:, filename:, disposition:, content_type:)
        instrument :url, key: key do |payload|
          item = find_item(key)
          raise ActiveStorage::FileNotFoundError unless item

          # Return the SharePoint web URL for viewing
          # Note: This requires SharePoint permissions to access
          url = item[:web_url]
          payload[:url] = url
          url
        end
      end

      # Get temporary URL for direct download
      def url_for_direct_upload(key, expires_in:, content_type:, content_length:, checksum:, custom_metadata: {})
        instrument :url_for_direct_upload, key: key do |payload|
          # Create upload session and return the upload URL
          folder_path = folder_path_for(key)
          session = client.create_upload_session(site_id, drive_id, folder_path, key)
          url = session["uploadUrl"]
          payload[:url] = url
          url
        end
      end

      # Headers for direct upload
      def headers_for_direct_upload(key, content_type:, checksum:, filename: nil, disposition: nil, custom_metadata: {}, **)
        { "Content-Type" => content_type }
      end

      private

      def client
        @client ||= MicrosoftAppGraphClient.new
      end

      def site_id
        @site_id ||= begin
          sites = client.get_all_sites
          site = sites.find { |s| s[:display_name]&.include?(site_name) || s[:name]&.include?(site_name.downcase) }
          raise "SharePoint site '#{site_name}' not found" unless site
          site[:id]
        end
      end

      def drive_id
        @drive_id ||= begin
          drives = client.get_site_drives(site_id)

          drive = if drive_name.present?
            drives.find { |d| d[:name] == drive_name }
          else
            drives.first
          end

          raise "SharePoint drive not found in site '#{site_name}'" unless drive
          drive[:id]
        end
      end

      # Generate folder path for a key using first 4 chars for distribution
      # e.g., key "abc123xyz" -> "ActiveStorage/ab/c1/abc123xyz"
      def folder_path_for(key)
        # Use first 2 chars for first level, next 2 for second level
        level1 = key[0, 2]
        level2 = key[2, 2] || "00"
        "#{base_folder}/#{level1}/#{level2}"
      end

      # Find an item by key in SharePoint
      def find_item(key)
        folder_path = folder_path_for(key)
        full_path = "#{folder_path}/#{key}"

        # Try to get the item directly by path
        begin
          result = client.send(:get, "/drives/#{CGI.escape(drive_id)}/root:/#{full_path}")
          client.send(:format_drive_item, result)
        rescue MicrosoftAppGraphClient::ApiError => e
          return nil if e.message.include?("itemNotFound") || e.message.include?("404")
          raise
        end
      end

      # Stream file content in chunks
      def stream(key)
        item = find_item(key)
        raise ActiveStorage::FileNotFoundError unless item

        # Get download URL
        download_url = item[:download_url]
        unless download_url
          # Fetch fresh item to get download URL
          fresh_item = client.get_drive_item(drive_id, item[:id])
          download_url = fresh_item[:download_url]
        end

        raise ActiveStorage::FileNotFoundError unless download_url

        # Stream in chunks
        chunk_size = 5.megabytes

        HTTP.follow.get(download_url) do |response|
          response.body.each do |chunk|
            yield chunk
          end
        end
      end
    end
  end
end
