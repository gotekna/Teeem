require 'net/http'
require 'json'

class OutlookService
  GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'

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
    folder = options[:folder] || 'inbox'

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
      parse_email_list(data['value'])
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

  # List available mail folders
  def list_folders
    url = "#{GRAPH_API_BASE}/me/mailFolders"

    response = make_request(url)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      data['value'].map { |folder| { id: folder['id'], name: folder['displayName'], unread_count: folder['unreadItemCount'], total_items: folder['totalItemCount'] } }
    else
      Rails.logger.error "Failed to list Outlook folders: #{response.code} - #{response.body}"
      []
    end
  end

  private

  def fetch_valid_token
    credential = @user.outlook_credential

    if credential.nil?
      raise NotConnectedError, 'Outlook not connected. Please connect your Outlook account in settings.'
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
    end

    request['Authorization'] = "Bearer #{@access_token}"
    request['Content-Type'] = 'application/json'

    http.request(request)
  end

  def parse_email_list(emails)
    emails.map { |email| parse_email(email) }
  end

  def parse_email(email)
    {
      message_id: email['internetMessageId'],
      from: email['from']&.dig('emailAddress', 'address'),
      from_email: email['from']&.dig('emailAddress', 'address'),
      to: email['toRecipients']&.map { |r| r.dig('emailAddress', 'address') } || [],
      to_emails: email['toRecipients']&.map { |r| r.dig('emailAddress', 'address') } || [],
      cc: email['ccRecipients']&.map { |r| r.dig('emailAddress', 'address') } || [],
      cc_emails: email['ccRecipients']&.map { |r| r.dig('emailAddress', 'address') } || [],
      subject: email['subject'],
      body_text: (email['body']&.dig('contentType') == 'text' ? email['body']&.dig('content') : nil),
      body_html: (email['body']&.dig('contentType') == 'html' ? email['body']&.dig('content') : nil),
      text_body: (email['body']&.dig('contentType') == 'text' ? email['body']&.dig('content') : nil),
      html_body: (email['body']&.dig('contentType') == 'html' ? email['body']&.dig('content') : nil),
      received_at: email['receivedDateTime'],
      date: email['receivedDateTime'],
      has_attachments: email['hasAttachments'],
      outlook_id: email['id'],
      conversation_id: email['conversationId']
    }
  end
end
