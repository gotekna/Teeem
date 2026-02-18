# frozen_string_literal: true

module Microsoft
  # Client for Microsoft Graph Drive operations
  # Handles SharePoint sites, OneDrive, file upload/download, and folder management
  class DriveClient < BaseClient
    # ==========================================
    # SharePoint Site Access
    # ==========================================

    # List all SharePoint sites in the tenant
    # NOTE: Microsoft Graph /sites endpoint requires search= parameter to return all sites
    # Use search= (empty) for all sites, or a specific term for filtering
    def list_sharepoint_sites(search: nil, top: 100)
      params = { "$top" => top }
      params["$select"] = "id,name,displayName,webUrl,createdDateTime"

      # Microsoft Graph requires search parameter to list sites
      # For all sites, use empty search - for specific sites, use the search term
      if search.present?
        params["$search"] = "\"#{search}\""
      end
      # Note: search= (empty) is passed via URL construction

      response = get("/sites", params, include_search: true)
      (response["value"] || []).map do |site|
        {
          id: site["id"],
          name: site["name"],
          display_name: site["displayName"],
          web_url: site["webUrl"],
          created_at: site["createdDateTime"]
        }
      end
    end

    # Get all sites (including root site which sometimes needs special handling)
    def get_all_sites(top: 200)
      # First get the root site
      sites = []

      begin
        root_site = get("/sites/root")
        sites << {
          id: root_site["id"],
          name: root_site["name"],
          display_name: root_site["displayName"] || "Root Site",
          web_url: root_site["webUrl"],
          is_root: true
        }
      rescue ApiError => e
        Rails.logger.warn "[Microsoft::DriveClient] Could not get root site: #{e.message}"
      end

      # Get all other sites - use empty search= to enumerate all sites
      response = get("/sites", { "$top" => top, "$select" => "id,name,displayName,webUrl" }, include_search: true)
      (response["value"] || []).each do |site|
        sites << {
          id: site["id"],
          name: site["name"],
          display_name: site["displayName"],
          web_url: site["webUrl"],
          is_root: false
        }
      end

      sites.uniq { |s| s[:id] }
    end

    # Get a specific SharePoint site by ID
    def get_site(site_id)
      response = get("/sites/#{CGI.escape(site_id)}")
      {
        id: response["id"],
        name: response["name"],
        display_name: response["displayName"],
        web_url: response["webUrl"]
      }
    end

    # Get drives (document libraries) for a SharePoint site
    def get_site_drives(site_id)
      response = get("/sites/#{CGI.escape(site_id)}/drives")
      (response["value"] || []).map do |drive|
        {
          id: drive["id"],
          name: drive["name"],
          drive_type: drive["driveType"],
          web_url: drive["webUrl"],
          quota_used: drive.dig("quota", "used"),
          quota_total: drive.dig("quota", "total")
        }
      end
    end

    # ==========================================
    # OneDrive Access (ANY user's OneDrive)
    # ==========================================

    # Get a user's OneDrive (personal drive)
    def get_user_drive(user_identifier)
      response = get("/users/#{CGI.escape(user_identifier)}/drive")
      {
        id: response["id"],
        name: response["name"],
        drive_type: response["driveType"],
        web_url: response["webUrl"],
        owner: response.dig("owner", "user", "displayName")
      }
    end

    # List files in a user's OneDrive root
    def list_user_drive_items(user_identifier, folder_path: nil, top: 100)
      if folder_path.present?
        endpoint = "/users/#{CGI.escape(user_identifier)}/drive/root:/#{folder_path}:/children"
      else
        endpoint = "/users/#{CGI.escape(user_identifier)}/drive/root/children"
      end

      params = {
        "$top" => top,
        "$select" => "id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,@microsoft.graph.downloadUrl"
      }

      response = get(endpoint, params)
      (response["value"] || []).map { |item| format_drive_item(item) }
    end

    # ==========================================
    # Drive Item Operations (works for SharePoint or OneDrive)
    # ==========================================

    # List items in a specific drive
    def list_drive_items(drive_id, folder_path: nil, folder_id: nil, top: 100)
      if folder_id.present?
        endpoint = "/drives/#{CGI.escape(drive_id)}/items/#{folder_id}/children"
      elsif folder_path.present?
        endpoint = "/drives/#{CGI.escape(drive_id)}/root:/#{folder_path}:/children"
      else
        endpoint = "/drives/#{CGI.escape(drive_id)}/root/children"
      end

      params = {
        "$top" => top,
        "$select" => "id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference,@microsoft.graph.downloadUrl"
      }

      response = get(endpoint, params)
      (response["value"] || []).map { |item| format_drive_item(item) }
    end

    # Get a specific item by ID
    def get_drive_item(drive_id, item_id)
      response = get("/drives/#{CGI.escape(drive_id)}/items/#{item_id}")
      format_drive_item(response)
    end

    # Get a specific item by path (e.g., "Templates/Contract/QBCC Contract.docx")
    def get_item_by_path(drive_id, path)
      # Microsoft Graph uses :/path: syntax for path-based access
      # Encode each path segment separately to handle spaces correctly
      encoded_path = path.split("/").map { |segment| CGI.escape(segment) }.join("/")
      response = get("/drives/#{CGI.escape(drive_id)}/root:/#{encoded_path}")
      format_drive_item(response)
    rescue ApiError => e
      # Return nil if file not found (404)
      return nil if e.message.include?("404") || e.message.include?("itemNotFound")
      raise
    end

    # Search for files across a drive
    def search_drive(drive_id, query, top: 50)
      endpoint = "/drives/#{CGI.escape(drive_id)}/root/search(q='#{CGI.escape(query)}')"
      params = { "$top" => top }

      response = get(endpoint, params)
      (response["value"] || []).map { |item| format_drive_item(item) }
    end

    # Download file content from SharePoint/OneDrive
    # Returns binary content of the file
    def get_drive_item_content(site_id: nil, drive_id:, item_id:)
      # Get the item first to get the download URL
      if site_id
        response = get("/sites/#{CGI.escape(site_id)}/drives/#{CGI.escape(drive_id)}/items/#{item_id}")
      else
        response = get("/drives/#{CGI.escape(drive_id)}/items/#{item_id}")
      end

      download_url = response["@microsoft.graph.downloadUrl"]
      raise ApiError, "No download URL available for item #{item_id}" unless download_url

      # Download the file content
      download_response = HTTP.follow.get(download_url)
      unless download_response.status.success?
        raise ApiError, "Failed to download file: #{download_response.status.code}"
      end

      download_response.body.to_s.force_encoding("BINARY")
    end

    # Delete a drive item
    def delete_drive_item(site_id: nil, drive_id:, item_id:)
      if site_id
        endpoint = "/sites/#{CGI.escape(site_id)}/drives/#{CGI.escape(drive_id)}/items/#{item_id}"
      else
        endpoint = "/drives/#{CGI.escape(drive_id)}/items/#{item_id}"
      end

      url = "#{GRAPH_API_BASE}#{endpoint}"
      response = HTTP.auth("Bearer #{access_token}").delete(url)

      if response.status.success? || response.status.code == 204
        true
      else
        error_body = JSON.parse(response.body.to_s) rescue { "error" => { "message" => response.body.to_s } }
        error_msg = error_body.dig("error", "message") || "HTTP #{response.status}"
        raise ApiError, "#{response.status.code} - #{error_msg}"
      end
    end

    # Convert DOCX to PDF using Microsoft Graph API
    # Returns binary PDF content
    def convert_to_pdf(site_id: nil, drive_id:, item_id:)
      if site_id
        endpoint = "/sites/#{CGI.escape(site_id)}/drives/#{CGI.escape(drive_id)}/items/#{item_id}/content?format=pdf"
      else
        endpoint = "/drives/#{CGI.escape(drive_id)}/items/#{item_id}/content?format=pdf"
      end

      url = "#{GRAPH_API_BASE}#{endpoint}"
      response = HTTP.auth("Bearer #{access_token}").follow.get(url)

      unless response.status.success?
        error_body = JSON.parse(response.body.to_s) rescue { "error" => { "message" => response.body.to_s } }
        error_msg = error_body.dig("error", "message") || "HTTP #{response.status}"
        raise ApiError, "#{response.status.code} - #{error_msg}"
      end

      response.body.to_s.force_encoding("BINARY")
    end

    # Search across ALL SharePoint and OneDrive in the tenant
    def search_all_files(query, top: 50)
      # Use the search API for tenant-wide search
      body = {
        requests: [
          {
            entityTypes: [ "driveItem" ],
            query: { queryString: query },
            from: 0,
            size: top
          }
        ]
      }

      response = post("/search/query", body)

      results = []
      (response.dig("value", 0, "hitsContainers", 0, "hits") || []).each do |hit|
        resource = hit["resource"]
        results << {
          id: resource["id"],
          name: resource["name"],
          web_url: resource["webUrl"],
          last_modified: resource["lastModifiedDateTime"],
          size: resource["size"],
          drive_id: resource.dig("parentReference", "driveId"),
          site_id: resource.dig("parentReference", "siteId")
        }
      end
      results
    end

    # Helper to determine if file is large
    def large_file?(size)
      size >= 4 * 1024 * 1024  # 4MB threshold
    end

    # ===== SharePoint Upload Methods =====

    # Upload file content to SharePoint (small files < 4MB)
    # parent_folder_path: e.g., "emails/attachments/Tekna/2024/12"
    # filename: e.g., "a3d8f9c7_Invoice.pdf"
    # content: binary content
    def upload_file_content(site_id, drive_id, parent_folder_path, filename, content)
      # Ensure folder exists first
      folder_id = ensure_folder_exists(site_id, drive_id, parent_folder_path)

      safe_filename = Warehouse::FilenameSanitizer.sanitize(filename)
      encoded_filename = CGI.escape(safe_filename)

      # Upload via PUT request
      endpoint = "/sites/#{site_id}/drives/#{drive_id}/items/#{folder_id}:/#{encoded_filename}:/content"

      result = put(endpoint, content, { "Content-Type" => "application/octet-stream" })

      {
        id: result["id"],
        name: result["name"],
        web_url: result["webUrl"],
        size: result["size"],
        path: "#{parent_folder_path}/#{filename}"
      }
    end

    # Upload file to a specific folder by ID (simpler than path-based upload)
    # Used for thumbnails where we already have the parent folder ID
    def upload_to_folder(drive_id:, parent_folder_id:, filename:, content:)
      safe_filename = Warehouse::FilenameSanitizer.sanitize(filename)
      encoded_filename = CGI.escape(safe_filename)

      endpoint = "/drives/#{drive_id}/items/#{parent_folder_id}:/#{encoded_filename}:/content"
      result = put(endpoint, content, { "Content-Type" => "application/octet-stream" })

      {
        "id" => result["id"],
        "name" => result["name"],
        "webUrl" => result["webUrl"]
      }
    end

    # Create upload session for large files (>= 4MB)
    def create_upload_session(site_id, drive_id, parent_folder_path, filename)
      folder_id = ensure_folder_exists(site_id, drive_id, parent_folder_path)

      safe_filename = Warehouse::FilenameSanitizer.sanitize(filename)
      encoded_filename = CGI.escape(safe_filename)

      endpoint = "/sites/#{site_id}/drives/#{drive_id}/items/#{folder_id}:/#{encoded_filename}:/createUploadSession"

      post(endpoint, {
        item: {
          "@microsoft.graph.conflictBehavior": "rename",
          name: safe_filename  # Must match the URL-decoded filename
        }
      })
    end

    # Upload large file in chunks
    # Returns the file metadata from the final response (id, name, webUrl, size)
    def upload_large_file(upload_url, content, chunk_size = 320 * 1024)
      total_size = content.bytesize
      offset = 0
      final_result = nil

      while offset < total_size
        chunk_end = [ offset + chunk_size, total_size ].min - 1
        chunk = content.byteslice(offset, chunk_end - offset + 1)

        headers = {
          "Content-Length" => chunk.bytesize.to_s,
          "Content-Range" => "bytes #{offset}-#{chunk_end}/#{total_size}"
        }

        # Use retry logic for each chunk upload
        with_retry do
          response = HTTP.auth("Bearer #{access_token}")
                         .headers(headers)
                         .put(upload_url, body: chunk)

          unless response.status.success?
            error_body = JSON.parse(response.body.to_s) rescue { "error" => { "message" => response.body.to_s } }
            error_msg = error_body.dig("error", "message") || "HTTP #{response.status.code}"
            raise ApiError, "#{response.status.code} - Upload chunk failed: #{error_msg}"
          end

          # The final chunk response contains the file metadata
          if chunk_end + 1 >= total_size
            final_result = begin
              JSON.parse(response.body.to_s)
            rescue StandardError => e
              Rails.logger.warn "[Microsoft::DriveClient] Failed to parse final chunk response: #{e.message}"
              nil
            end
          end
        end

        offset = chunk_end + 1
      end

      Rails.logger.info "[Microsoft::DriveClient] Large file upload completed: #{total_size} bytes"

      # Return file metadata in same format as upload_file_content
      if final_result && final_result["id"]
        {
          id: final_result["id"],
          name: final_result["name"],
          web_url: final_result["webUrl"],
          size: final_result["size"]
        }
      else
        # Fallback if we couldn't parse the response
        { success: true, size: total_size }
      end
    end

    # Ensure folder path exists, create if needed
    def ensure_folder_exists(site_id, drive_id, folder_path)
      return "root" if folder_path.blank?

      path_parts = folder_path.split("/")
      current_folder_id = "root"

      path_parts.each do |folder_name|
        # Try to get folder
        begin
          # NOTE: Don't use CGI.escape here - it converts spaces to + which SharePoint doesn't understand
          # The path segment should be URL-encoded with %20 for spaces, not +
          # Using ERB::Util.url_encode or simply passing the raw name works
          result = get("/drives/#{drive_id}/items/#{current_folder_id}:/#{folder_name}")
          current_folder_id = result["id"]
        rescue ApiError => e
          # Folder doesn't exist, create it
          if e.message.include?("itemNotFound") || e.message.include?("404")
            result = create_folder(site_id, drive_id, current_folder_id, folder_name)
            current_folder_id = result["id"]
          else
            raise
          end
        end
      end

      current_folder_id
    end

    # Create a folder
    def create_folder(site_id, drive_id, parent_folder_id, folder_name)
      endpoint = "/sites/#{site_id}/drives/#{drive_id}/items/#{parent_folder_id}/children"

      post(endpoint, {
        name: folder_name,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail"
      })
    end

    # Copy a file to a new location
    # Returns the new item details
    def copy_file(drive_id:, item_id:, destination_folder_path:, new_name: nil)
      # Get the item details first to get the name if not provided
      item = get_drive_item(drive_id, item_id)
      filename = new_name || item["name"]

      # Download the content
      content = get_drive_item_content(drive_id: drive_id, item_id: item_id)

      # Upload to new location
      upload_file_content(nil, drive_id, destination_folder_path, filename, content)
    end

    # Move a file to a new location (copy + delete original)
    def move_file(drive_id:, item_id:, destination_folder_path:, new_name: nil)
      # Copy to new location
      new_item = copy_file(
        drive_id: drive_id,
        item_id: item_id,
        destination_folder_path: destination_folder_path,
        new_name: new_name
      )

      # Delete the original
      delete_drive_item(drive_id: drive_id, item_id: item_id)

      new_item
    end

    # Create a sharing link for a file
    # type: "view" (read-only) or "edit" (read-write)
    # scope: "anonymous" (anyone with link), "organization" (org members only)
    # Returns: { url: "https://...", type: "view", scope: "anonymous" }
    def create_share_link(drive_id:, item_id:, type: "view", scope: "anonymous")
      endpoint = "/drives/#{drive_id}/items/#{item_id}/createLink"

      response = post(endpoint, {
        type: type,
        scope: scope
      })

      {
        url: response.dig("link", "webUrl"),
        type: response.dig("link", "type"),
        scope: response.dig("link", "scope"),
        id: response["id"]
      }
    end

    private

    def format_drive_item(item)
      {
        id: item["id"],
        name: item["name"],
        size: item["size"],
        created_at: item["createdDateTime"],
        modified_at: item["lastModifiedDateTime"],
        web_url: item["webUrl"],
        is_folder: item["folder"].present?,
        child_count: item.dig("folder", "childCount"),
        mime_type: item.dig("file", "mimeType"),
        download_url: item["@microsoft.graph.downloadUrl"],
        parent_drive_id: item.dig("parentReference", "driveId"),
        parent_id: item.dig("parentReference", "id"),
        parent_path: item.dig("parentReference", "path")
      }
    end
  end
end
