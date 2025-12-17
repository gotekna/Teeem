# MicrosoftAppGraphClient - Uses Application permissions to access ANY user's data
# This is different from MicrosoftGraphClient which uses delegated (user) permissions
#
# Usage:
#   client = MicrosoftAppGraphClient.new
#   client.list_users
#   client.get_user_emails('user@tekna.com.au')
#   client.get_user_email('user@tekna.com.au', 'message_id')

class MicrosoftAppGraphClient
  GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"

  class NotConnectedError < StandardError; end
  class ApiError < StandardError; end

  def initialize(credential = nil)
    @credential = credential || OrganizationMicrosoftAppCredential.active_credential
    raise NotConnectedError, "Organization Microsoft app not configured" unless @credential
    raise NotConnectedError, "Organization Microsoft app not connected" unless @credential.status == "connected"
  end

  # ==========================================
  # User Management
  # ==========================================

  # List all users in the tenant
  def list_users(select: nil, filter: nil, top: 100)
    params = { "$top" => top }
    params["$select"] = select if select
    params["$filter"] = filter if filter

    response = get("/users", params)
    response["value"] || []
  end

  # Get a specific user by email or user ID
  def get_user(user_identifier)
    get("/users/#{CGI.escape(user_identifier)}")
  end

  # ==========================================
  # Email Access (ANY user's mailbox)
  # ==========================================

  # List emails for a specific user
  # user_identifier: email address or user ID
  def get_user_emails(user_identifier, folder: "inbox", top: 50, filter: nil, search: nil, since: nil, skip: nil)
    endpoint = "/users/#{CGI.escape(user_identifier)}/mailFolders/#{folder}/messages"

    params = {
      "$top" => top,
      "$orderby" => "receivedDateTime DESC",
      "$select" => "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,hasAttachments,bodyPreview,body,internetMessageId,conversationId,isRead,importance"
    }

    params["$skip"] = skip if skip
    params["$filter"] = filter if filter
    params["$search"] = "\"#{search}\"" if search

    if since
      since_filter = "receivedDateTime ge #{since.iso8601}"
      params["$filter"] = params["$filter"] ? "(#{params['$filter']}) and #{since_filter}" : since_filter
    end

    response = get(endpoint, params)
    response["value"] || []
  end

  # Get a specific email for a user
  def get_user_email(user_identifier, message_id, include_body: true)
    select = "id,subject,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,body,internetMessageId,conversationId,isRead"
    select = select.gsub(",body", "") unless include_body

    get("/users/#{CGI.escape(user_identifier)}/messages/#{message_id}", { "$select" => select })
  end

  # Get email attachments
  def get_email_attachments(user_identifier, message_id)
    endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/attachments"
    Rails.logger.info "[MicrosoftAppGraph] get_email_attachments - endpoint: #{endpoint}"
    Rails.logger.info "[MicrosoftAppGraph] get_email_attachments - credential tenant: #{@credential.tenant_id}"
    response = get(endpoint)
    response["value"] || []
  end

  # Get email in MIME format (.eml)
  # Returns the raw MIME content of the email message
  def get_email_mime_content(user_identifier, message_id)
    endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/$value"

    # This endpoint returns raw MIME content, not JSON
    response = HTTP.auth("Bearer #{access_token}")
                   .get("#{GRAPH_API_BASE}#{endpoint}")

    unless response.status.success?
      raise ApiError, "Failed to get email MIME content: #{response.code} - #{response.body}"
    end

    response.body.to_s
  end

  # List mail folders for a user
  def get_user_mail_folders(user_identifier)
    response = get("/users/#{CGI.escape(user_identifier)}/mailFolders", { "$top" => 100 })
    (response["value"] || []).map do |folder|
      {
        id: folder["id"],
        name: folder["displayName"],
        total_count: folder["totalItemCount"],
        unread_count: folder["unreadItemCount"]
      }
    end
  end

  # Search emails across a user's mailbox
  def search_user_emails(user_identifier, query, top: 50)
    endpoint = "/users/#{CGI.escape(user_identifier)}/messages"

    params = {
      "$top" => top,
      "$search" => "\"#{query}\"",
      "$select" => "id,subject,from,toRecipients,receivedDateTime,hasAttachments,bodyPreview,parentFolderId"
    }

    response = get(endpoint, params)
    response["value"] || []
  end

  # ==========================================
  # Sync helpers
  # ==========================================

  # Get emails modified since a delta token (for incremental sync)
  def get_user_emails_delta(user_identifier, delta_link: nil, folder: "inbox")
    if delta_link
      # Use the delta link directly
      response = get_url(delta_link)
    else
      # Initial delta request
      endpoint = "/users/#{CGI.escape(user_identifier)}/mailFolders/#{folder}/messages/delta"
      params = {
        "$select" => "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,hasAttachments,bodyPreview,body,internetMessageId,conversationId,isRead,importance"
      }
      response = get(endpoint, params)
    end

    {
      emails: response["value"] || [],
      next_link: response["@odata.nextLink"],
      delta_link: response["@odata.deltaLink"]
    }
  end

  # Batch sync emails for multiple users (more efficient)
  def batch_get_emails(user_emails, folder: "inbox", top: 20)
    requests = user_emails.map.with_index do |email, idx|
      {
        id: idx.to_s,
        method: "GET",
        url: "/users/#{CGI.escape(email)}/mailFolders/#{folder}/messages?$top=#{top}&$orderby=receivedDateTime DESC"
      }
    end

    response = post("/$batch", { requests: requests })

    results = {}
    (response["responses"] || []).each do |resp|
      idx = resp["id"].to_i
      user_email = user_emails[idx]
      if resp["status"] == 200
        results[user_email] = resp["body"]["value"] || []
      else
        Rails.logger.warn "[MicrosoftAppGraph] Failed to get emails for #{user_email}: #{resp['status']}"
        results[user_email] = []
      end
    end
    results
  end

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
      Rails.logger.warn "[MicrosoftAppGraph] Could not get root site: #{e.message}"
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

  # ==========================================
  # Calendar Access (for future use)
  # ==========================================

  def get_user_calendar_events(user_identifier, start_time: nil, end_time: nil, top: 50)
    endpoint = "/users/#{CGI.escape(user_identifier)}/calendar/events"

    params = { "$top" => top, "$orderby" => "start/dateTime" }

    if start_time && end_time
      params["$filter"] = "start/dateTime ge '#{start_time.iso8601}' and end/dateTime le '#{end_time.iso8601}'"
    end

    response = get(endpoint, params)
    response["value"] || []
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

    # URL encode filename
    encoded_filename = CGI.escape(filename)

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

  # Create upload session for large files (>= 4MB)
  def create_upload_session(site_id, drive_id, parent_folder_path, filename)
    folder_id = ensure_folder_exists(site_id, drive_id, parent_folder_path)

    # Sanitize filename for SharePoint: remove characters that cause issues
    # SharePoint doesn't like: " * : < > ? / \ |
    # Also replace + and = which cause URL encoding mismatches
    safe_filename = filename.gsub(/[<>:"\/\\|?*+=]/, "_").gsub(/_{2,}/, "_")
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
          final_result = JSON.parse(response.body.to_s) rescue nil
        end
      end

      offset = chunk_end + 1
    end

    Rails.logger.info "[MicrosoftAppGraph] Large file upload completed: #{total_size} bytes"

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

  private

  def access_token
    @credential.valid_access_token
  end

  def get(endpoint, params = {}, include_search: false)
    url = "#{GRAPH_API_BASE}#{endpoint}"
    if params.any?
      url += "?#{URI.encode_www_form(params)}"
      # Add empty search= for SharePoint sites enumeration
      url += "&search=" if include_search && !params.key?("$search")
    elsif include_search
      url += "?search="
    end

    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers("Content-Type" => "application/json")
                     .get(url)

      handle_response(response)
    end
  end

  def get_url(full_url)
    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers("Content-Type" => "application/json")
                     .get(full_url)

      handle_response(response)
    end
  end

  def post(endpoint, body)
    url = "#{GRAPH_API_BASE}#{endpoint}"

    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers("Content-Type" => "application/json")
                     .post(url, json: body)

      handle_response(response)
    end
  end

  def put(endpoint, content, headers = {})
    url = "#{GRAPH_API_BASE}#{endpoint}"

    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers(headers)
                     .put(url, body: content)

      handle_response(response)
    end
  end

  # Retry wrapper for handling token expiration and rate limiting
  def with_retry(max_retries: 3, &block)
    attempt = 0

    begin
      attempt += 1
      yield
    rescue ApiError => e
      # Extract HTTP status code from error message
      if e.message.include?("401") || e.message.include?("Unauthorized")
        # Token expired - refresh and retry
        if attempt <= max_retries
          Rails.logger.info "[MicrosoftAppGraph] Token expired (attempt #{attempt}/#{max_retries}), refreshing..."
          if @credential.fetch_access_token!
            Rails.logger.info "[MicrosoftAppGraph] Token refreshed, retrying request..."
            retry
          else
            Rails.logger.error "[MicrosoftAppGraph] Failed to refresh token"
            raise
          end
        else
          Rails.logger.error "[MicrosoftAppGraph] Max retries exceeded for token refresh"
          raise
        end
      elsif e.message.include?("429") || e.message.include?("Too Many Requests")
        # Rate limited - use exponential backoff
        if attempt <= max_retries
          wait_time = 2 ** attempt  # 2s, 4s, 8s
          Rails.logger.warn "[MicrosoftAppGraph] Rate limited (attempt #{attempt}/#{max_retries}), waiting #{wait_time}s..."
          sleep(wait_time)
          retry
        else
          Rails.logger.error "[MicrosoftAppGraph] Max retries exceeded for rate limiting"
          raise
        end
      elsif e.message.include?("503") || e.message.include?("Service Unavailable")
        # Service unavailable - retry with backoff
        if attempt <= max_retries
          wait_time = 2 ** attempt
          Rails.logger.warn "[MicrosoftAppGraph] Service unavailable (attempt #{attempt}/#{max_retries}), waiting #{wait_time}s..."
          sleep(wait_time)
          retry
        else
          Rails.logger.error "[MicrosoftAppGraph] Max retries exceeded for service unavailability"
          raise
        end
      else
        # Other error - don't retry
        raise
      end
    end
  end

  def handle_response(response)
    if response.status.success?
      JSON.parse(response.body.to_s)
    else
      error_body = JSON.parse(response.body.to_s) rescue { "error" => { "message" => response.body.to_s } }
      error_msg = error_body.dig("error", "message") || "HTTP #{response.status}"
      error_code = response.status.code

      raise ApiError, "#{error_code} - #{error_msg}"
    end
  end

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
      parent_path: item.dig("parentReference", "path")
    }
  end
end
