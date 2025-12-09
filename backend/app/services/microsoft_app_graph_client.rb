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
      "$select" => "id,subject,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,bodyPreview,internetMessageId,conversationId,isRead"
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
    response = get("/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/attachments")
    response["value"] || []
  end

  # Get email in MIME format (.eml)
  # Returns the raw MIME content of the email message
  def get_email_mime_content(user_identifier, message_id)
    endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/$value"

    # This endpoint returns raw MIME content, not JSON
    response = HTTP.auth("Bearer #{valid_access_token}")
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
        "$select" => "id,subject,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,bodyPreview,internetMessageId,conversationId,isRead"
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

  # Search for files across a drive
  def search_drive(drive_id, query, top: 50)
    endpoint = "/drives/#{CGI.escape(drive_id)}/root/search(q='#{CGI.escape(query)}')"
    params = { "$top" => top }

    response = get(endpoint, params)
    (response["value"] || []).map { |item| format_drive_item(item) }
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

    response = HTTP.auth("Bearer #{access_token}")
                   .headers("Content-Type" => "application/json")
                   .get(url)

    handle_response(response)
  end

  def get_url(full_url)
    response = HTTP.auth("Bearer #{access_token}")
                   .headers("Content-Type" => "application/json")
                   .get(full_url)

    handle_response(response)
  end

  def post(endpoint, body)
    url = "#{GRAPH_API_BASE}#{endpoint}"

    response = HTTP.auth("Bearer #{access_token}")
                   .headers("Content-Type" => "application/json")
                   .post(url, json: body)

    handle_response(response)
  end

  def handle_response(response)
    if response.status.success?
      JSON.parse(response.body.to_s)
    else
      error_body = JSON.parse(response.body.to_s) rescue { "error" => { "message" => response.body.to_s } }
      error_msg = error_body.dig("error", "message") || "HTTP #{response.status}"

      # Check if token expired and try to refresh
      if response.status.code == 401
        Rails.logger.info "[MicrosoftAppGraph] Token expired, refreshing..."
        @credential.fetch_access_token!
        # Retry would need to be implemented by caller
      end

      raise ApiError, "Microsoft Graph API error: #{error_msg}"
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

  # ===== SharePoint Upload Methods =====

  # Upload file content to SharePoint (small files < 4MB)
  # parent_folder_path: e.g., "Email Attachments/Tekna/2024/12"
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
    encoded_filename = CGI.escape(filename)

    endpoint = "/sites/#{site_id}/drives/#{drive_id}/items/#{folder_id}:/#{encoded_filename}:/createUploadSession"

    post(endpoint, {
      item: {
        "@microsoft.graph.conflictBehavior": "rename",
        name: filename
      }
    })
  end

  # Upload large file in chunks
  def upload_large_file(upload_url, content, chunk_size = 320 * 1024)
    total_size = content.bytesize
    offset = 0

    while offset < total_size
      chunk_end = [offset + chunk_size, total_size].min - 1
      chunk = content.byteslice(offset, chunk_end - offset + 1)

      headers = {
        "Content-Length" => chunk.bytesize.to_s,
        "Content-Range" => "bytes #{offset}-#{chunk_end}/#{total_size}"
      }

      response = HTTP.auth("Bearer #{valid_access_token}")
                     .headers(headers)
                     .put(upload_url, body: chunk)

      raise ApiError, "Upload chunk failed: #{response.code}" unless response.status.success?

      offset = chunk_end + 1
    end

    # Return final response
    JSON.parse(response.body)
  end

  # Ensure folder path exists, create if needed
  def ensure_folder_exists(site_id, drive_id, folder_path)
    return "root" if folder_path.blank?

    path_parts = folder_path.split("/")
    current_folder_id = "root"

    path_parts.each do |folder_name|
      # Try to get folder
      begin
        encoded_name = CGI.escape(folder_name)
        result = get("/sites/#{site_id}/drives/#{drive_id}/items/#{current_folder_id}:/#{encoded_name}")
        current_folder_id = result["id"]
      rescue ApiError => e
        # Folder doesn't exist, create it
        if e.message.include?("itemNotFound")
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

  # Helper to determine if file is large
  def large_file?(size)
    size >= 4 * 1024 * 1024  # 4MB threshold
  end
end
