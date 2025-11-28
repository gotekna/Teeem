class Api::V1::OutlookController < ApplicationController
  # Skip authentication for OAuth callback - Microsoft redirects here without auth token
  skip_before_action :authorize_request, only: [:callback]

  # GET /api/v1/outlook/auth_url
  # Get the OAuth authorization URL for connecting the current user's Outlook
  def auth_url
    client_id = ENV['OUTLOOK_CLIENT_ID']
    redirect_uri = "#{request.base_url}/api/v1/outlook/callback"
    tenant = ENV['OUTLOOK_TENANT_ID'] || 'common'

    if client_id.blank?
      render json: { error: 'Outlook OAuth not configured. Please set OUTLOOK_CLIENT_ID environment variable.' }, status: :unprocessable_entity
      return
    end

    # Scopes needed for reading and sending mail
    scopes = [
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/MailboxSettings.Read',
      'offline_access'
    ].join(' ')

    # Encode user_id in state parameter so we know who to associate on callback
    state_data = { user_id: current_user.id, nonce: SecureRandom.hex(8) }
    state = Base64.urlsafe_encode64(state_data.to_json)

    auth_url = "https://login.microsoftonline.com/#{tenant}/oauth2/v2.0/authorize?" + URI.encode_www_form({
      client_id: client_id,
      response_type: 'code',
      redirect_uri: redirect_uri,
      response_mode: 'query',
      scope: scopes,
      state: state
    })

    render json: { auth_url: auth_url }
  end

  # GET /api/v1/outlook/callback
  # OAuth callback endpoint
  def callback
    code = params[:code]
    state = params[:state]
    error = params[:error]
    error_description = params[:error_description]

    if error.present?
      Rails.logger.error "Outlook OAuth error: #{error} - #{error_description}"
      return render_popup_close_page(success: false, error: error_description || error)
    end

    if code.blank?
      return render_popup_close_page(success: false, error: 'No authorization code received')
    end

    # Decode state to get user_id
    user_id = nil
    if state.present?
      begin
        state_data = JSON.parse(Base64.urlsafe_decode64(state))
        user_id = state_data['user_id']
      rescue => e
        Rails.logger.error "Failed to decode OAuth state: #{e.message}"
      end
    end

    unless user_id
      return render_popup_close_page(success: false, error: 'Invalid OAuth state - please try again')
    end

    user = User.find_by(id: user_id)
    unless user
      return render_popup_close_page(success: false, error: 'User not found - please try again')
    end

    # Exchange code for tokens
    client_id = ENV['OUTLOOK_CLIENT_ID']
    client_secret = ENV['OUTLOOK_CLIENT_SECRET']
    redirect_uri = "#{request.base_url}/api/v1/outlook/callback"
    tenant = ENV['OUTLOOK_TENANT_ID'] || 'common'

    response = HTTP.post("https://login.microsoftonline.com/#{tenant}/oauth2/v2.0/token",
      form: {
        client_id: client_id,
        client_secret: client_secret,
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
        scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/MailboxSettings.Read offline_access'
      }
    )

    if response.status.success?
      data = response.parse

      # Get user info to store email
      user_response = HTTP.auth("Bearer #{data['access_token']}").get('https://graph.microsoft.com/v1.0/me')
      outlook_email = user_response.parse['mail'] || user_response.parse['userPrincipalName']

      # Create or update the user's credential
      credential = user.outlook_credential || user.build_outlook_credential
      credential.update!(
        access_token: data['access_token'],
        refresh_token: data['refresh_token'],
        expires_at: Time.current + data['expires_in'].to_i.seconds,
        email: outlook_email,
        tenant_id: tenant
      )

      Rails.logger.info "Outlook connected successfully for user #{user.id} (#{outlook_email})"
      render_popup_close_page(success: true, email: outlook_email)
    else
      error_message = response.parse['error_description'] || response.parse['error'] || 'Failed to exchange code for token'
      Rails.logger.error "Failed to get Outlook token: #{response.status} - #{error_message}"
      render_popup_close_page(success: false, error: error_message)
    end
  rescue => e
    Rails.logger.error "Error in Outlook callback: #{e.message}"
    render_popup_close_page(success: false, error: e.message)
  end

  # GET /api/v1/outlook/status
  # Check if current user's Outlook is configured
  def status
    credential = current_user.outlook_credential
    render json: {
      configured: credential.present?,
      email: credential&.email,
      expires_at: credential&.expires_at,
      expired: credential&.expired?,
      message: credential.present? ? 'Outlook is connected' : 'Outlook not connected'
    }
  end

  # DELETE /api/v1/outlook/disconnect
  # Disconnect current user's Outlook
  def disconnect
    credential = current_user.outlook_credential
    if credential
      credential.destroy
      render json: { success: true, message: 'Outlook disconnected successfully' }
    else
      render json: { error: 'Outlook not connected' }, status: :not_found
    end
  end

  # GET /api/v1/outlook/folders
  # List available mail folders for current user
  def folders
    outlook = OutlookService.new(current_user)
    folders = outlook.list_folders

    render json: { folders: folders }
  rescue OutlookService::NotConnectedError => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue => e
    Rails.logger.error "Failed to list Outlook folders: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST /api/v1/outlook/search
  # Search current user's Outlook emails without importing
  def search
    outlook = OutlookService.new(current_user)

    options = {
      search: params[:search],
      filter: params[:filter],
      top: params[:top] || 50,
      folder: params[:folder] || 'inbox'
    }

    emails = outlook.search_emails(options)

    render json: {
      emails: emails,
      count: emails.length
    }
  rescue OutlookService::NotConnectedError => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue => e
    Rails.logger.error "Failed to search Outlook: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST /api/v1/outlook/import
  # Import emails from current user's Outlook into the system
  def import
    outlook = OutlookService.new(current_user)

    options = {
      search: params[:search],
      filter: params[:filter],
      top: params[:top] || 50,
      folder: params[:folder] || 'inbox'
    }

    imported_count = outlook.import_emails(options)

    render json: {
      success: true,
      imported_count: imported_count,
      message: "Successfully imported #{imported_count} emails"
    }
  rescue OutlookService::NotConnectedError => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue => e
    Rails.logger.error "Failed to import from Outlook: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST /api/v1/outlook/import_for_job
  # Import emails for a specific job from current user's Outlook
  def import_for_job
    job = Job.find(params[:job_id])
    outlook = OutlookService.new(current_user)

    # Build search query based on job details
    search_terms = []
    search_terms << job.title if job.title.present?
    search_terms << job.id.to_s

    options = {
      search: search_terms.join(' OR '),
      top: params[:top] || 50,
      folder: params[:folder] || 'inbox'
    }

    # Import and try to match to this specific job
    emails_data = outlook.search_emails(options)
    imported_count = 0

    emails_data.each do |email_data|
      # Check if email already exists
      next if Email.exists?(message_id: email_data[:message_id])

      # Parse and create email
      parser = EmailParserService.new(email_data)
      parsed_data = parser.parse

      email = Email.new(parsed_data)
      email.user = current_user

      # Force assignment to this job
      email.job = job

      if email.save
        imported_count += 1
        Rails.logger.info "Imported email for job #{job.id}: #{email.subject}"
      else
        Rails.logger.error "Failed to import email: #{email.errors.full_messages.join(', ')}"
      end
    end

    render json: {
      success: true,
      imported_count: imported_count,
      job_id: job.id,
      message: "Successfully imported #{imported_count} emails for #{job.title}"
    }
  rescue OutlookService::NotConnectedError => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue => e
    Rails.logger.error "Failed to import emails for job: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

  def render_popup_close_page(success:, email: nil, error: nil)
    html = <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <title>#{success ? 'Connected' : 'Error'}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #{success ? '#f0fdf4' : '#fef2f2'};
          }
          .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .icon { font-size: 48px; margin-bottom: 16px; }
          h1 { color: #{success ? '#166534' : '#991b1b'}; margin: 0 0 8px 0; }
          p { color: #6b7280; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">#{success ? '✓' : '✕'}</div>
          <h1>#{success ? 'Connected!' : 'Connection Failed'}</h1>
          <p>#{success ? "Connected as #{email}" : error}</p>
          <p style="margin-top: 16px; font-size: 14px;">This window will close automatically...</p>
        </div>
        <script>
          setTimeout(function() { window.close(); }, 2000);
        </script>
      </body>
      </html>
    HTML
    render html: html.html_safe
  end
end
