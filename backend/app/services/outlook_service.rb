require "net/http"
require "json"

class OutlookService
  GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"

  class NotConnectedError < StandardError; end

  # Initialize with a user to get their personal credentials
  def initialize(user)
    @user = user
    @access_token = fetch_valid_token
  end

  # Search for emails in Outlook
  # Options:
  #   search: search query (e.g., "subject:Job order:receivedDateTime desc")
  #   filter: OData filter (e.g., "from/emailAddress/address eq 'example@email.com'")
  #   top: number of results (default 50, max 999)
  #   folder: folder to search in (default: inbox)
  def search_emails(options = {})
    search_query = options[:search]
    filter = options[:filter]
    top = options[:top] || 50
    folder = options[:folder] || "inbox"

    # Build the API endpoint
    endpoint = "/me/mailFolders/#{folder}/messages"
    params = []

    params << "$search=#{URI.encode_www_form_component(search_query)}" if search_query.present?
    params << "$filter=#{URI.encode_www_form_component(filter)}" if filter.present?
    params << "$top=#{top}"
    params << "$orderby=receivedDateTime DESC"
    params << "$select=id,subject,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,body,internetMessageId,conversationId"

    url = "#{GRAPH_API_BASE}#{endpoint}?#{params.join('&')}"

    response = make_request(url)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      parse_email_list(data["value"])
    else
      Rails.logger.error "Failed to search Outlook emails: #{response.code} - #{response.body}"
      []
    end
  end

  # Get a specific email by ID
  def get_email(message_id)
    url = "#{GRAPH_API_BASE}/me/messages/#{message_id}"

    response = make_request(url)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      parse_email(data)
    else
      Rails.logger.error "Failed to fetch Outlook email: #{response.code} - #{response.body}"
      nil
    end
  end

  # Import emails matching criteria into the system
  def import_emails(options = {})
    emails_data = search_emails(options)
    imported_count = 0

    emails_data.each do |email_data|
      # Check if email already exists by message_id
      next if Email.exists?(message_id: email_data[:message_id])

      # Parse and create email
      parser = EmailParserService.new(email_data)
      parsed_data = parser.parse

      email = Email.new(parsed_data)
      email.user = @user

      # Try to auto-match to a job
      matched_job = parser.match_job
      email.job = matched_job if matched_job

      if email.save
        imported_count += 1
        Rails.logger.info "Imported email: #{email.subject} (ID: #{email.id})"
      else
        Rails.logger.error "Failed to import email: #{email.errors.full_messages.join(', ')}"
      end
    end

    imported_count
  end

  # List available mail folders (including nested child folders)
  def list_folders
    url = "#{GRAPH_API_BASE}/me/mailFolders?$top=100"

    response = make_request(url)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      folders = data["value"].map { |folder| build_folder_with_children(folder) }.flatten
      folders
    else
      Rails.logger.error "Failed to list Outlook folders: #{response.code} - #{response.body}"
      []
    end
  end

  # Recursively fetch child folders
  def fetch_child_folders(parent_id, depth = 0)
    return [] if depth > 3 # Prevent infinite recursion, max 3 levels deep

    url = "#{GRAPH_API_BASE}/me/mailFolders/#{parent_id}/childFolders?$top=100"
    response = make_request(url)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      data["value"].map { |folder| build_folder_with_children(folder, depth + 1) }.flatten
    else
      []
    end
  end

  def build_folder_with_children(folder, depth = 0)
    result = [{
      id: folder["id"],
      name: folder["displayName"],
      unread_count: folder["unreadItemCount"],
      total_items: folder["totalItemCount"],
      parent_id: folder["parentFolderId"],
      depth: depth
    }]

    # Fetch child folders if this folder has children
    if folder["childFolderCount"].to_i > 0
      children = fetch_child_folders(folder["id"], depth)
      result.concat(children)
    end

    result
  end

  # Delete an email from Outlook
  def delete_email(message_id)
    url = "#{GRAPH_API_BASE}/me/messages/#{message_id}"
    response = make_request(url, :delete)

    if response.is_a?(Net::HTTPSuccess) || response.is_a?(Net::HTTPNoContent)
      Rails.logger.info "Deleted email from Outlook: #{message_id}"
      true
    else
      Rails.logger.error "Failed to delete Outlook email: #{response.code} - #{response.body}"
      false
    end
  end

  # Send an email via Microsoft Graph API
  def send_email(to:, subject:, body:, cc: [], bcc: [], attachments: [])
    url = "#{GRAPH_API_BASE}/me/sendMail"

    # Build recipients
    to_recipients = Array(to).map { |email| { emailAddress: { address: email } } }
    cc_recipients = Array(cc).reject(&:blank?).map { |email| { emailAddress: { address: email } } }
    bcc_recipients = Array(bcc).reject(&:blank?).map { |email| { emailAddress: { address: email } } }

    message = {
      subject: subject,
      body: {
        contentType: "HTML",
        content: body
      },
      toRecipients: to_recipients
    }

    message[:ccRecipients] = cc_recipients if cc_recipients.any?
    message[:bccRecipients] = bcc_recipients if bcc_recipients.any?

    # Add attachments if present
    if attachments.any?
      message[:attachments] = attachments.map do |att|
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: att[:name],
          contentType: att[:content_type],
          contentBytes: att[:content]
        }
      end
    end

    response = make_request(url, :post, { message: message })

    if response.is_a?(Net::HTTPSuccess) || response.is_a?(Net::HTTPAccepted)
      Rails.logger.info "Sent email via Outlook to: #{to.join(', ')}"
      { success: true, message_id: SecureRandom.uuid }
    else
      error_body = JSON.parse(response.body) rescue { "error" => { "message" => response.body } }
      error_msg = error_body.dig("error", "message") || "Unknown error"
      Rails.logger.error "Failed to send Outlook email: #{response.code} - #{error_msg}"
      { success: false, error: error_msg }
    end
  end

  # Move email to a different folder
  def move_to_folder(message_id, destination_folder_id)
    url = "#{GRAPH_API_BASE}/me/messages/#{message_id}/move"
    response = make_request(url, :post, { destinationId: destination_folder_id })

    if response.is_a?(Net::HTTPSuccess)
      Rails.logger.info "Moved email #{message_id} to folder #{destination_folder_id}"
      true
    else
      Rails.logger.error "Failed to move Outlook email: #{response.code} - #{response.body}"
      false
    end
  end

  # Move email to Deleted Items
  def move_to_trash(message_id)
    deleted_folder_id = get_special_folder_id("deleteditems")
    return false unless deleted_folder_id

    move_to_folder(message_id, deleted_folder_id)
  end

  # Move email to Junk folder
  def move_to_junk(message_id)
    junk_folder_id = get_special_folder_id("junkemail")
    return false unless junk_folder_id

    move_to_folder(message_id, junk_folder_id)
  end

  # Get ID of a well-known folder (deleteditems, junkemail, inbox, sentitems)
  def get_special_folder_id(folder_name)
    url = "#{GRAPH_API_BASE}/me/mailFolders/#{folder_name}"
    response = make_request(url)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      data["id"]
    else
      Rails.logger.error "Failed to get special folder #{folder_name}: #{response.code} - #{response.body}"
      nil
    end
  end

  # Get attachments for an email
  def get_attachments(message_id)
    url = "#{GRAPH_API_BASE}/me/messages/#{message_id}/attachments"

    response = make_request(url)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      data["value"]
    else
      Rails.logger.error "Failed to fetch attachments: #{response.code} - #{response.body}"
      []
    end
  end

  # Download a specific attachment and return as a file
  def download_attachment(message_id, attachment_id)
    url = "#{GRAPH_API_BASE}/me/messages/#{message_id}/attachments/#{attachment_id}"

    response = make_request(url)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      {
        filename: data["name"],
        content_type: data["contentType"],
        content: Base64.decode64(data["contentBytes"])
      }
    else
      Rails.logger.error "Failed to download attachment: #{response.code} - #{response.body}"
      nil
    end
  end

  private

  def fetch_valid_token
    credential = @user.outlook_credential

    if credential.nil?
      raise NotConnectedError, "Outlook not connected. Please connect your Outlook account in settings."
    end

    # This will automatically refresh the token if expired
    credential.valid_access_token
  end

  def make_request(url, method = :get, body = nil)
    uri = URI(url)

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    request = case method
    when :get
      Net::HTTP::Get.new(uri.request_uri)
    when :post
      req = Net::HTTP::Post.new(uri.request_uri)
      req.body = body.to_json if body
      req
    when :delete
      Net::HTTP::Delete.new(uri.request_uri)
    end

    request["Authorization"] = "Bearer #{@access_token}"
    request["Content-Type"] = "application/json"

    http.request(request)
  end

  def parse_email_list(emails)
    emails.map { |email| parse_email(email) }
  end

  def parse_email(email)
    {
      message_id: email["internetMessageId"],
      from: email["from"]&.dig("emailAddress", "address"),
      from_email: email["from"]&.dig("emailAddress", "address"),
      to: email["toRecipients"]&.map { |r| r.dig("emailAddress", "address") } || [],
      to_emails: email["toRecipients"]&.map { |r| r.dig("emailAddress", "address") } || [],
      cc: email["ccRecipients"]&.map { |r| r.dig("emailAddress", "address") } || [],
      cc_emails: email["ccRecipients"]&.map { |r| r.dig("emailAddress", "address") } || [],
      subject: email["subject"],
      body_text: (email["body"]&.dig("contentType") == "text" ? email["body"]&.dig("content") : nil),
      body_html: (email["body"]&.dig("contentType") == "html" ? email["body"]&.dig("content") : nil),
      text_body: (email["body"]&.dig("contentType") == "text" ? email["body"]&.dig("content") : nil),
      html_body: (email["body"]&.dig("contentType") == "html" ? email["body"]&.dig("content") : nil),
      received_at: email["receivedDateTime"],
      date: email["receivedDateTime"],
      has_attachments: email["hasAttachments"],
      outlook_id: email["id"],
      conversation_id: email["conversationId"]
    }
  end
end
