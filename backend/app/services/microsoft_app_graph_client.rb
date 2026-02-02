# MicrosoftAppGraphClient - Uses Application permissions to access ANY user's data
# This is different from MicrosoftGraphClient which uses delegated (user) permissions
#
# SSoT Usage (preferred - org-scoped):
#   client = MicrosoftAppGraphClient.for_org(organization)
#   client = MicrosoftAppGraphClient.for_org('Tekna')
#
# Legacy Usage (deprecated - logs warning):
#   client = MicrosoftAppGraphClient.new
#   client.list_users
#   client.get_user_emails('user@tekna.com.au')
#   client.get_user_email('user@tekna.com.au', 'message_id')

class MicrosoftAppGraphClient
  GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"

  attr_reader :credential

  class NotConnectedError < StandardError; end
  class ApiError < StandardError; end
  class DeadTokenError < NotConnectedError; end

  # SSoT: Reference MicrosoftTokenManager for dead token error codes
  def self.dead_token_error?(error_message)
    MicrosoftTokenManager.dead_token_error?(error_message)
  end

  # SSoT: Create client with org-scoped credential lookup (preferred)
  # @param organization [Organization, String] Organization object or name/slug
  # @return [MicrosoftAppGraphClient] Client scoped to the organization
  def self.for_org(organization)
    org = case organization
          when Organization
            organization
          when String
            Organization.find_by_name_or_slug(organization)
          when Integer
            Organization.find_by(id: organization)
          else
            raise ArgumentError, "organization must be an Organization, String, or Integer"
          end

    raise NotConnectedError, "Organization not found: #{organization}" unless org

    # SSoT: Use MicrosoftCredential only
    credential = MicrosoftCredential.active_for_org(org)

    raise NotConnectedError, "No SharePoint credential configured for #{org.name}. Configure in Admin > System > Connections." unless credential

    new(credential)
  end

  def initialize(credential = nil)
    @credential = credential || find_active_credential
    raise NotConnectedError, "SharePoint not configured. Please configure in Admin > System > Connections." unless @credential

    # Check for dead tokens early - these require re-authentication
    if @credential.respond_to?(:refresh_token_dead?) && @credential.refresh_token_dead?
      reason = @credential.respond_to?(:reconnect_reason) ? @credential.reconnect_reason : "dead token"
      raise DeadTokenError, "SharePoint connection expired (#{reason}). Please reconnect in Admin > System > Connections."
    end

    # FRC (Feb 2026): For credentials with status "error" or expired tokens, try to refresh
    # immediately rather than failing. This ensures 24/7 availability - if a token expired
    # overnight, we can still recover by refreshing on-demand.
    ensure_valid_token! unless @credential.status == "disconnected"
  end

  # Ensure we have a valid token, refreshing if needed
  # FRC (Feb 2026): Called during initialization to recover from overnight token expiry
  def ensure_valid_token!
    return if @credential.valid_credential?

    Rails.logger.info "[MicrosoftAppGraphClient] Token invalid or expired for #{@credential.name || @credential.id}, attempting refresh..."

    if @credential.app_credential?
      unless @credential.fetch_app_token!
        raise NotConnectedError, "SharePoint token refresh failed. Please check connection in Admin > System > Connections."
      end
    elsif @credential.delegated_credential?
      unless @credential.refresh_delegated_token!
        raise NotConnectedError, "SharePoint token refresh failed. Please reconnect in Admin > System > Connections."
      end
    end

    # Reload to get fresh token data
    @credential.reload
    Rails.logger.info "[MicrosoftAppGraphClient] Token refreshed successfully for #{@credential.name || @credential.id}"
  rescue StandardError => e
    Rails.logger.error "[MicrosoftAppGraphClient] Token refresh failed: #{e.message}"
    raise NotConnectedError, "SharePoint connection error: #{e.message}"
  end

  private

  # Find active credential - SSoT: MicrosoftCredential only
  # DEPRECATED: Use MicrosoftAppGraphClient.for_org(organization) instead
  def find_active_credential
    # Log deprecation warning - this should not be called in new code
    Rails.logger.warn "[MicrosoftAppGraphClient] DEPRECATED: find_active_credential called without org context. " \
                      "Use MicrosoftAppGraphClient.for_org(organization) instead. " \
                      "Caller: #{caller(1, 3).join(' <- ')}"

    # SSoT: Use MicrosoftCredential only
    MicrosoftCredential.active_credential
  end

  public

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
      "$select" => "id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,createdDateTime,lastModifiedDateTime,hasAttachments,bodyPreview,body,internetMessageId,conversationId,isRead,importance,isDraft"
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

  # Mark a message as read or unread in Office 365
  # @param user_identifier [String] User email or ID
  # @param message_id [String] The MS Graph message ID
  # @param is_read [Boolean] true to mark as read, false to mark as unread
  # @return [Hash] The updated message data
  def mark_message_read(user_identifier, message_id, is_read: true)
    endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}"
    patch(endpoint, { isRead: is_read })
  end

  # Get email attachments
  def get_email_attachments(user_identifier, message_id)
    endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/attachments"
    Rails.logger.info "[MicrosoftAppGraph] get_email_attachments - endpoint: #{endpoint}"
    Rails.logger.info "[MicrosoftAppGraph] get_email_attachments - credential tenant: #{@credential.tenant_id}"
    response = get(endpoint)
    response["value"] || []
  end

  # Download a specific email attachment
  # Returns { content:, filename:, content_type: } or nil on failure
  def download_email_attachment(user_identifier, message_id, attachment_id)
    endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/attachments/#{attachment_id}"
    attachment = get(endpoint)

    return nil unless attachment

    # Handle file attachments (contentBytes contains base64-encoded content)
    if attachment["@odata.type"] == "#microsoft.graph.fileAttachment" && attachment["contentBytes"]
      {
        content: Base64.decode64(attachment["contentBytes"]),
        filename: attachment["name"] || "attachment",
        content_type: attachment["contentType"] || "application/octet-stream"
      }
    else
      Rails.logger.warn "[MicrosoftAppGraphClient] Unsupported attachment type: #{attachment['@odata.type']}"
      nil
    end
  rescue StandardError => e
    Rails.logger.error "[MicrosoftAppGraphClient] Failed to download attachment #{attachment_id}: #{e.message}"
    nil
  end

  # Get email in MIME format (.eml)
  # Returns the raw MIME content of the email message
  # Uses with_retry for proper 429 throttling handling
  def get_email_mime_content(user_identifier, message_id)
    endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/$value"

    with_retry(max_retries: 5) do
      # This endpoint returns raw MIME content, not JSON
      response = HTTP.auth("Bearer #{access_token}")
                     .get("#{GRAPH_API_BASE}#{endpoint}")

      unless response.status.success?
        raise ApiError, "Failed to get email MIME content: #{response.code} - #{response.body}"
      end

      response.body.to_s
    end
  end

  # List mail folders for a user (including nested subfolders)
  def get_user_mail_folders(user_identifier, max_depth: 3)
    folders = []
    fetch_folders_recursive(user_identifier, nil, nil, folders, 0, max_depth)
    folders
  end

  private

  def fetch_folders_recursive(user_identifier, parent_folder_id, parent_path, folders, depth, max_depth)
    return if depth > max_depth

    # Build endpoint - top level or child folders
    endpoint = if parent_folder_id
      "/users/#{CGI.escape(user_identifier)}/mailFolders/#{parent_folder_id}/childFolders"
    else
      "/users/#{CGI.escape(user_identifier)}/mailFolders"
    end

    response = get(endpoint, { "$top" => 100 })
    (response["value"] || []).each do |folder|
      display_name = folder["displayName"]
      # Build full path for subfolders (e.g., "Inbox/Investments")
      full_path = parent_path ? "#{parent_path}/#{display_name}" : display_name

      folders << {
        id: folder["id"],
        name: full_path,  # Store full path for warehouse filtering
        display_name: display_name,  # Keep original for UI
        total_items: folder["totalItemCount"],
        unread_count: folder["unreadItemCount"],
        depth: depth,
        parent_id: parent_folder_id,
        child_folder_count: folder["childFolderCount"] || 0
      }

      # Recursively fetch child folders if they exist
      if (folder["childFolderCount"] || 0) > 0
        fetch_folders_recursive(user_identifier, folder["id"], full_path, folders, depth + 1, max_depth)
      end
    end
  rescue => e
    Rails.logger.warn "[MicrosoftAppGraphClient] Failed to fetch folders at depth #{depth}: #{e.message}"
  end

  public

  # Send email as a specific user
  # Uses POST /users/{user-id}/sendMail to send email from any user's mailbox
  # Options:
  #   from: sender email address (the mailbox to send from)
  #   to: recipient email(s) (string or array)
  #   cc: CC recipient email(s) (optional)
  #   bcc: BCC recipient email(s) (optional)
  #   subject: email subject
  #   body: email body (HTML supported)
  #   attachments: array of { name:, content: (base64), content_type: } (optional)
  #   reply_to_message_id: internetMessageId of original email (for threading replies)
  def send_email(from:, to:, subject:, body:, cc: [], bcc: [], attachments: [], reply_to_message_id: nil)
    # Build recipients arrays
    to_recipients = Array(to).map { |email| { emailAddress: { address: email } } }
    cc_recipients = Array(cc).reject(&:blank?).map { |email| { emailAddress: { address: email } } }
    bcc_recipients = Array(bcc).reject(&:blank?).map { |email| { emailAddress: { address: email } } }

    # Build message content
    message_content = {
      subject: subject,
      body: {
        contentType: "HTML",
        content: body
      },
      toRecipients: to_recipients
    }

    # Add CC if present
    message_content[:ccRecipients] = cc_recipients if cc_recipients.any?

    # Add BCC if present
    message_content[:bccRecipients] = bcc_recipients if bcc_recipients.any?

    # Add threading headers for replies
    # This ensures the reply appears in the same email thread/conversation
    if reply_to_message_id.present?
      message_content[:internetMessageHeaders] = [
        { name: "In-Reply-To", value: reply_to_message_id },
        { name: "References", value: reply_to_message_id }
      ]
    end

    # Add attachments if present
    if attachments.any?
      message_content[:attachments] = attachments.map do |att|
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: att[:name] || att[:filename],
          contentBytes: att[:content],
          contentType: att[:content_type] || "application/octet-stream"
        }
      end
    end

    # Build request body
    request_body = {
      message: message_content,
      saveToSentItems: true
    }

    # Send using the user's mailbox
    endpoint = "/users/#{CGI.escape(from)}/sendMail"

    url = "#{GRAPH_API_BASE}#{endpoint}"

    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers("Content-Type" => "application/json")
                     .post(url, json: request_body)

      # Microsoft Graph returns 202 (Accepted) for successful sendMail
      if response.status.success? || response.status.code == 202
        Rails.logger.info "[MicrosoftAppGraph] Email sent successfully from #{from} to #{to}"
        { success: true, message_id: SecureRandom.uuid }
      else
        error_body = JSON.parse(response.body.to_s) rescue { "error" => { "message" => response.body.to_s } }
        error_msg = error_body.dig("error", "message") || "HTTP #{response.status}"
        Rails.logger.error "[MicrosoftAppGraph] Failed to send email: #{response.status.code} - #{error_msg}"
        raise ApiError, "#{response.status.code} - #{error_msg}"
      end
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

  # Move an email to a different folder
  # Returns the moved message with its new ID
  def move_user_email(user_identifier, message_id, destination_folder_id)
    endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}/move"

    response = post(endpoint, { destinationId: destination_folder_id })
    {
      id: response["id"],
      new_folder_id: response["parentFolderId"],
      subject: response["subject"]
    }
  end

  # Delete an email from a user's mailbox
  # Microsoft Graph DELETE moves to Deleted Items (soft delete)
  # Returns true on success
  def delete_user_email(user_identifier, message_id)
    endpoint = "/users/#{CGI.escape(user_identifier)}/messages/#{message_id}"
    delete(endpoint)
    true
  rescue StandardError => e
    Rails.logger.error "[MicrosoftAppGraphClient] Failed to delete email #{message_id}: #{e.message}"
    false
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

  # Batch fetch MIME content for multiple emails (up to 20 per batch)
  # Returns hash of { "user_email:message_id" => mime_content_or_nil }
  # FRC (Jan 2026): Reduces HTTP calls by ~95% (250 emails = 13 batch calls instead of 250)
  def batch_get_email_mime_content(email_requests)
    return {} if email_requests.empty?

    # Microsoft Graph batch limit is 20 requests
    results = {}

    email_requests.each_slice(20) do |batch|
      batch_results = execute_mime_batch(batch)
      results.merge!(batch_results)
    end

    results
  end

  private

  # Execute a single batch request for MIME content (max 20)
  def execute_mime_batch(batch)
    requests = batch.map.with_index do |req, idx|
      {
        id: idx.to_s,
        method: "GET",
        url: "/users/#{CGI.escape(req[:user_email])}/messages/#{req[:message_id]}/$value",
        headers: { "Accept" => "message/rfc822" }
      }
    end

    results = {}

    with_retry(max_retries: 5) do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers("Content-Type" => "application/json")
                     .post("#{GRAPH_API_BASE}/$batch", json: { requests: requests })

      unless response.status.success?
        raise ApiError, "Batch request failed: #{response.status.code}"
      end

      batch_response = JSON.parse(response.body.to_s)

      (batch_response["responses"] || []).each do |resp|
        idx = resp["id"].to_i
        req = batch[idx]
        key = "#{req[:user_email]}:#{req[:message_id]}"

        if resp["status"] == 200
          # MIME content is in the body
          results[key] = resp["body"]
        else
          error_msg = resp.dig("body", "error", "message") || "HTTP #{resp['status']}"
          Rails.logger.warn "[MicrosoftAppGraph] Batch MIME failed for #{key}: #{error_msg}"
          results[key] = { error: error_msg, status: resp["status"] }
        end
      end
    end

    results
  end

  public

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

    # SSoT: Use centralized SharePoint filename sanitization
    # See lib/sharepoint/filename_sanitizer.rb for rules
    safe_filename = SharePoint::FilenameSanitizer.sanitize(filename)
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
    safe_filename = SharePoint::FilenameSanitizer.sanitize(filename)
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

    # SSoT: Use centralized SharePoint filename sanitization
    # See lib/sharepoint/filename_sanitizer.rb for rules
    safe_filename = SharePoint::FilenameSanitizer.sanitize(filename)
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

  def access_token
    @credential.valid_access_token
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error "[MicrosoftAppGraph] Token decryption failed: #{e.message}"
    raise NotConnectedError, "SharePoint credentials expired. Please reconnect SharePoint in Admin > System > Connections."
  end

  # Check if error indicates dead token (SSoT: delegates to MicrosoftTokenManager)
  def dead_token_error?(error_message)
    MicrosoftTokenManager.dead_token_error?(error_message)
  end

  # Mark credential as dead
  def mark_credential_dead!(error_message)
    return unless @credential.respond_to?(:mark_dead!)
    @credential.mark_dead!(error_message)
    Rails.logger.error "[MicrosoftAppGraph] Credential marked as dead: #{error_message}"
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

  def patch(endpoint, body)
    url = "#{GRAPH_API_BASE}#{endpoint}"

    with_retry do
      response = HTTP.auth("Bearer #{access_token}")
                     .headers("Content-Type" => "application/json")
                     .patch(url, json: body)

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

  def delete(endpoint)
    url = "#{GRAPH_API_BASE}#{endpoint}"

    with_retry do
      response = HTTP.auth("Bearer #{access_token}").delete(url)

      # DELETE returns 204 No Content on success
      return true if response.status.code == 204

      handle_response(response)
    end
  end

  # Retry wrapper for handling token expiration and rate limiting
  # Now includes dead token detection (SSoT migration)
  def with_retry(max_retries: 3, &block)
    attempt = 0

    begin
      attempt += 1
      yield
    rescue ApiError => e
      error_msg = e.message

      # Check for dead token errors first (SSoT - permanent failure)
      if dead_token_error?(error_msg)
        mark_credential_dead!(error_msg)
        raise DeadTokenError, "SharePoint connection permanently failed. Please reconnect in Admin > System > Connections."
      end

      # Extract HTTP status code from error message
      if error_msg.include?("401") || error_msg.include?("Unauthorized")
        # Token expired - refresh and retry
        if attempt <= max_retries
          Rails.logger.info "[MicrosoftAppGraph] Token expired (attempt #{attempt}/#{max_retries}), refreshing..."
          if refresh_credential_token!
            Rails.logger.info "[MicrosoftAppGraph] Token refreshed, retrying request..."
            retry
          else
            # Check if token is now dead after failed refresh
            if @credential.respond_to?(:refresh_token_dead?) && @credential.refresh_token_dead?
              raise DeadTokenError, "SharePoint token refresh failed permanently. Please reconnect."
            end
            Rails.logger.error "[MicrosoftAppGraph] Failed to refresh token"
            raise NotConnectedError, "SharePoint authentication failed. Please reconnect."
          end
        else
          Rails.logger.error "[MicrosoftAppGraph] Max retries exceeded for token refresh"
          raise NotConnectedError, "SharePoint authentication failed after #{max_retries} attempts."
        end
      elsif error_msg.include?("429") || error_msg.include?("Too Many Requests") || error_msg.include?("ApplicationThrottled")
        # Rate limited - use exponential backoff
        # Microsoft Graph API returns 429 with "ApplicationThrottled" for MailboxConcurrency limits
        if attempt <= max_retries
          wait_time = 2 ** attempt  # 2s, 4s, 8s, 16s, 32s
          Rails.logger.warn "[MicrosoftAppGraph] Rate limited (attempt #{attempt}/#{max_retries}), waiting #{wait_time}s..."
          sleep(wait_time)
          retry
        else
          Rails.logger.error "[MicrosoftAppGraph] Max retries exceeded for rate limiting"
          raise ApiError, "Microsoft API rate limit exceeded. Please try again later."
        end
      elsif error_msg.include?("503") || error_msg.include?("Service Unavailable")
        # Service unavailable - retry with backoff
        if attempt <= max_retries
          wait_time = 2 ** attempt
          Rails.logger.warn "[MicrosoftAppGraph] Service unavailable (attempt #{attempt}/#{max_retries}), waiting #{wait_time}s..."
          sleep(wait_time)
          retry
        else
          Rails.logger.error "[MicrosoftAppGraph] Max retries exceeded for service unavailability"
          raise ApiError, "SharePoint service unavailable. Please try again later."
        end
      else
        # Other error - don't retry
        raise
      end
    rescue ActiveRecord::Encryption::Errors::Decryption => e
      Rails.logger.error "[MicrosoftAppGraph] Decryption error during request: #{e.message}"
      raise NotConnectedError, "SharePoint credentials expired. Please reconnect SharePoint."
    end
  end

  # Refresh credential token - supports both old and new models
  def refresh_credential_token!
    if @credential.respond_to?(:fetch_app_token!)
      @credential.fetch_app_token!
    elsif @credential.respond_to?(:fetch_access_token!)
      @credential.fetch_access_token!
    elsif @credential.respond_to?(:valid_access_token)
      @credential.valid_access_token.present?
    else
      false
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
      parent_id: item.dig("parentReference", "id"),
      parent_path: item.dig("parentReference", "path")
    }
  end
end
