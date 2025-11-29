class MicrosoftEmailService
  GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'
  DEFAULT_FROM = 'admin@teknahomes.com.au'

  def initialize(credential = nil)
    @credential = credential || OrganizationOneDriveCredential.active_credential
    raise "No active Microsoft credential found" unless @credential
  end

  # Send email using Microsoft Graph API
  # Options:
  #   to: recipient email (string or array)
  #   subject: email subject
  #   body: email body (HTML supported)
  #   from: sender email (optional, defaults to admin@teknahomes.com.au)
  def send_email(to:, subject:, body:, from: DEFAULT_FROM)
    recipients = Array(to).map { |email| { emailAddress: { address: email } } }

    message = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: body
        },
        toRecipients: recipients,
        from: {
          emailAddress: {
            address: from
          }
        }
      },
      saveToSentItems: true
    }

    response = make_request(
      "#{GRAPH_API_BASE}/users/#{from}/sendMail",
      :post,
      message
    )

    if response.is_a?(Net::HTTPSuccess) || response.code == '202'
      Rails.logger.info "Email sent successfully to #{to}"
      { success: true }
    else
      error_message = begin
        JSON.parse(response.body).dig('error', 'message')
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

    request['Authorization'] = "Bearer #{valid_access_token}"
    request['Content-Type'] = 'application/json'

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
end
