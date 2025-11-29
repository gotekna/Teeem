class Api::V1::MicrosoftAuthController < ApplicationController
  # Skip authentication for OAuth callback - Microsoft redirects here without auth token
  skip_before_action :authorize_request, only: [:callback]

  # All Microsoft Graph scopes needed for the app
  REQUIRED_SCOPES = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/MailboxSettings.Read',
    'https://graph.microsoft.com/Files.Read.All',
    'https://graph.microsoft.com/Sites.Read.All'
  ].freeze

  # GET /api/v1/microsoft/auth_url
  # Get the OAuth authorization URL for connecting all Microsoft services
  def auth_url
    client_id = ENV['OUTLOOK_CLIENT_ID']
    tenant = ENV['OUTLOOK_TENANT_ID'] || 'common'

    if client_id.blank?
      render json: { error: 'Microsoft OAuth not configured. Please set OUTLOOK_CLIENT_ID environment variable.' }, status: :unprocessable_entity
      return
    end

    # Determine redirect URI based on environment
    redirect_uri = microsoft_redirect_uri

    # Encode user_id in state parameter so we know who to associate on callback
    state_data = { user_id: current_user.id, nonce: SecureRandom.hex(8) }
    state = Base64.urlsafe_encode64(state_data.to_json)

    auth_url = "https://login.microsoftonline.com/#{tenant}/oauth2/v2.0/authorize?" + URI.encode_www_form({
      client_id: client_id,
      response_type: 'code',
      redirect_uri: redirect_uri,
      response_mode: 'query',
      scope: REQUIRED_SCOPES.join(' '),
      state: state,
      prompt: 'select_account'  # Force account picker - important when impersonating
    })

    render json: { auth_url: auth_url }
  end

  # GET /api/v1/microsoft/callback
  # OAuth callback endpoint - handles the redirect from Microsoft
  def callback
    code = params[:code]
    state = params[:state]
    error = params[:error]
    error_description = params[:error_description]

    if error.present?
      Rails.logger.error "Microsoft OAuth error: #{error} - #{error_description}"
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
    tokens = exchange_code_for_tokens(code)
    unless tokens
      return render_popup_close_page(success: false, error: 'Failed to exchange code for tokens')
    end

    # Get user info from Microsoft Graph
    user_info = get_microsoft_user_info(tokens[:access_token])
    microsoft_email = user_info&.dig('mail') || user_info&.dig('userPrincipalName')

    # Create or update the user's Microsoft token
    microsoft_token = user.microsoft_token || user.build_microsoft_token
    microsoft_token.mark_connected!(tokens.merge(email: microsoft_email))

    # Also update the legacy outlook_credential for backward compatibility
    update_legacy_outlook_credential(user, tokens, microsoft_email)

    Rails.logger.info "Microsoft connected successfully for user #{user.id} (#{microsoft_email})"
    render_popup_close_page(success: true, email: microsoft_email)
  rescue => e
    Rails.logger.error "Error in Microsoft callback: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    render_popup_close_page(success: false, error: e.message)
  end

  # GET /api/v1/microsoft/status
  # Check current user's Microsoft connection status
  def status
    microsoft_token = current_user.microsoft_token
    outlook_credential = current_user.outlook_credential

    # Use new unified token if available, otherwise fall back to legacy
    if microsoft_token&.status == 'connected'
      render json: {
        connected: true,
        email: microsoft_token.email,
        status: microsoft_token.status,
        expires_at: microsoft_token.token_expires_at,
        needs_refresh: microsoft_token.needs_refresh?,
        last_sync_at: microsoft_token.last_sync_at,
        sync_error: microsoft_token.sync_error,
        services: {
          outlook: true,
          onedrive: true,
          sharepoint: true
        }
      }
    elsif outlook_credential.present?
      # Legacy outlook credential exists
      render json: {
        connected: true,
        email: outlook_credential.email,
        status: outlook_credential.expired? ? 'needs_refresh' : 'connected',
        expires_at: outlook_credential.expires_at,
        needs_refresh: outlook_credential.expired?,
        services: {
          outlook: true,
          onedrive: false,  # Legacy doesn't have OneDrive scope
          sharepoint: false
        },
        legacy: true,
        message: 'Please reconnect to enable OneDrive and SharePoint access'
      }
    else
      render json: {
        connected: false,
        email: nil,
        status: 'disconnected',
        services: {
          outlook: false,
          onedrive: false,
          sharepoint: false
        }
      }
    end
  end

  # POST /api/v1/microsoft/refresh
  # Force refresh the access token
  def refresh
    microsoft_token = current_user.microsoft_token

    unless microsoft_token&.refresh_token.present?
      render json: { error: 'No Microsoft connection to refresh' }, status: :not_found
      return
    end

    if microsoft_token.refresh_access_token!
      render json: {
        success: true,
        message: 'Token refreshed successfully',
        expires_at: microsoft_token.token_expires_at
      }
    else
      render json: {
        success: false,
        error: microsoft_token.sync_error || 'Failed to refresh token'
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/microsoft/disconnect
  # Disconnect current user's Microsoft account
  def disconnect
    microsoft_token = current_user.microsoft_token
    outlook_credential = current_user.outlook_credential

    microsoft_token&.disconnect!
    outlook_credential&.destroy

    render json: { success: true, message: 'Microsoft account disconnected successfully' }
  end

  private

  def microsoft_redirect_uri
    # Use the request's base URL for the redirect
    "#{request.base_url}/api/v1/microsoft/callback"
  end

  def exchange_code_for_tokens(code)
    client_id = ENV['OUTLOOK_CLIENT_ID']
    client_secret = ENV['OUTLOOK_CLIENT_SECRET']
    tenant = ENV['OUTLOOK_TENANT_ID'] || 'common'
    redirect_uri = microsoft_redirect_uri

    response = HTTP.post("https://login.microsoftonline.com/#{tenant}/oauth2/v2.0/token",
      form: {
        client_id: client_id,
        client_secret: client_secret,
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
        scope: REQUIRED_SCOPES.join(' ')
      }
    )

    if response.status.success?
      data = response.parse
      {
        access_token: data['access_token'],
        refresh_token: data['refresh_token'],
        expires_in: data['expires_in'],
        scope: data['scope']
      }
    else
      error_data = response.parse
      Rails.logger.error "Failed to exchange code: #{response.status} - #{error_data['error_description']}"
      nil
    end
  end

  def get_microsoft_user_info(access_token)
    response = HTTP.auth("Bearer #{access_token}").get('https://graph.microsoft.com/v1.0/me')
    response.status.success? ? response.parse : nil
  end

  def update_legacy_outlook_credential(user, tokens, email)
    # Keep legacy credential in sync for backward compatibility with existing email sync
    credential = user.outlook_credential || user.build_outlook_credential
    credential.update!(
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      expires_at: Time.current + tokens[:expires_in].to_i.seconds,
      email: email,
      tenant_id: ENV['OUTLOOK_TENANT_ID'] || 'common'
    )
  end

  def render_popup_close_page(success:, email: nil, error: nil)
    # Get the frontend URL from environment or derive from request
    frontend_url = ENV['FRONTEND_URL'] || 'https://teeemrob.vercel.app'

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
            max-width: 400px;
          }
          .icon { font-size: 48px; margin-bottom: 16px; }
          h1 { color: #{success ? '#166534' : '#991b1b'}; margin: 0 0 8px 0; font-size: 24px; }
          p { color: #6b7280; margin: 0; }
          .services { margin-top: 16px; text-align: left; }
          .service { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .service:last-child { border-bottom: none; }
          .check { color: #22c55e; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">#{success ? '✓' : '✕'}</div>
          <h1>#{success ? 'Microsoft Connected!' : 'Connection Failed'}</h1>
          <p>#{success ? "Connected as #{email}" : error}</p>
          #{success ? services_html : ''}
          <p style="margin-top: 16px; font-size: 14px; color: #9ca3af;">This window will close automatically...</p>
        </div>
        <script>
          // Notify parent window of success/failure
          if (window.opener) {
            window.opener.postMessage({
              type: 'microsoft-oauth-callback',
              success: #{success},
              email: #{email.to_json},
              error: #{error.to_json}
            }, '#{frontend_url}');
          }
          setTimeout(function() { window.close(); }, 2500);
        </script>
      </body>
      </html>
    HTML
    render html: html.html_safe
  end

  def services_html
    <<~HTML
      <div class="services">
        <div class="service"><span class="check">✓</span> Outlook - Email sync enabled</div>
        <div class="service"><span class="check">✓</span> OneDrive - File access enabled</div>
        <div class="service"><span class="check">✓</span> SharePoint - Site access enabled</div>
      </div>
    HTML
  end
end
