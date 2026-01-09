class MicrosoftEmailService
  GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"

  def initialize(credential = nil)
    @credential = credential || MicrosoftCredential.sharepoint_credential
    raise "No active Microsoft credential found" unless @credential
  end

  # Send email using Microsoft Graph API
  # Note: Email is sent from the authenticated Microsoft account (currently sam@tekna.com.au)
  # Options:
  #   to: recipient email (string or array)
  #   subject: email subject
  #   body: email body (HTML supported)
  #   sender_name: optional display name for the sender (e.g., "Robert Harder via Tekna Homes")
  #   reply_to: optional reply-to email address
  def send_email(to:, subject:, body:, sender_name: nil, reply_to: nil)
    recipients = Array(to).map { |email| { emailAddress: { address: email } } }

    message_content = {
      subject: subject,
      body: {
        contentType: "HTML",
        content: body
      },
      toRecipients: recipients
    }

    # Add custom sender name if provided (shows as "Name via Tekna" in email clients)
    if sender_name.present?
      message_content[:from] = {
        emailAddress: {
          name: sender_name,
          address: authenticated_email
        }
      }
    end

    # Add reply-to address if provided
    if reply_to.present?
      message_content[:replyTo] = [
        { emailAddress: { address: reply_to } }
      ]
    end

    message = {
      message: message_content,
      saveToSentItems: true
    }

    # Use /me/sendMail to send from the authenticated user's mailbox
    response = make_request(
      "#{GRAPH_API_BASE}/me/sendMail",
      :post,
      message
    )

    # Microsoft Graph returns 202 (Accepted) for successful sendMail requests
    if response.is_a?(Net::HTTPSuccess) || response.code == "202"
      Rails.logger.info "Email sent successfully to #{to}"
      { success: true }
    else
      error_message = begin
        JSON.parse(response.body).dig("error", "message")
      rescue
        response.body
      end
      Rails.logger.error "Failed to send email: #{response.code} - #{error_message}"
      { success: false, error: error_message }
    end
  rescue => e
    Rails.logger.error "Email service error: #{e.message}"
    { success: false, error: e.message }
  end

  private

  def make_request(url, method, body = nil)
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

    request["Authorization"] = "Bearer #{valid_access_token}"
    request["Content-Type"] = "application/json"

    http.request(request)
  end

  def valid_access_token
    # Check if token is expired and needs refresh
    if @credential.token_expired?
      # Use MicrosoftGraphClient to refresh the token
      client = MicrosoftGraphClient.new(@credential)
      client.send(:refresh_token!)
      @credential.reload
    end
    @credential.access_token
  end

  def authenticated_email
    # Return the email of the authenticated Microsoft account
    # This is cached from the /me endpoint during OAuth
    @authenticated_email ||= begin
      client = MicrosoftGraphClient.new(@credential)
      me = client.get("/me")
      me["mail"] || me["userPrincipalName"]
    rescue
      "admin@teknahomes.com.au" # Fallback
    end
  end
end
