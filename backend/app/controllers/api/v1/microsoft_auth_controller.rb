class Api::V1::MicrosoftAuthController < ApplicationController
  # Skip authentication for OAuth callback - Microsoft redirects here without auth token
  skip_before_action :authorize_request, only: [ :callback, :admin_consent_callback ]

  # All Microsoft Graph scopes needed for the app
  # These must match what's been granted via admin consent in Azure AD
  REQUIRED_SCOPES = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "https://graph.microsoft.com/Mail.Read",
    "https://graph.microsoft.com/Mail.Send",
    "https://graph.microsoft.com/Files.ReadWrite.All",
    "https://graph.microsoft.com/Sites.ReadWrite.All",
    "https://graph.microsoft.com/User.Read"
  ].freeze

  # GET /api/v1/microsoft/auth_url
  # Get the OAuth authorization URL for connecting all Microsoft services
  def auth_url
    client_id = ENV["OUTLOOK_CLIENT_ID"]
    tenant = ENV["OUTLOOK_TENANT_ID"] || "common"

    if client_id.blank?
      render json: { error: "Microsoft OAuth not configured. Please set OUTLOOK_CLIENT_ID environment variable." }, status: :unprocessable_entity
      return
    end

    # Determine redirect URI based on environment
    redirect_uri = microsoft_redirect_uri

    # Encode user_id and frontend_url in state parameter so we know who to associate on callback
    # and where to redirect back to
    frontend_url = request.referer.present? ? URI.parse(request.referer).tap { |u| u.path = ""; u.query = nil }.to_s : ENV["FRONTEND_URL"]
    state_data = { user_id: current_user.id, nonce: SecureRandom.hex(8), frontend_url: frontend_url }
    state = Base64.urlsafe_encode64(state_data.to_json)

    # Build auth URL params
    auth_params = {
      client_id: client_id,
      response_type: "code",
      redirect_uri: redirect_uri,
      response_mode: "query",
      scope: REQUIRED_SCOPES.join(" "),
      state: state
    }

    # Only force account picker if not using tenant-specific auth
    # When OUTLOOK_TENANT_ID is set, users from that org are pre-consented
    # and can sign in seamlessly without being asked for consent again
    if tenant == "common"
      auth_params[:prompt] = "select_account"
    end
    # For tenant-specific apps with admin consent, let Microsoft decide the flow

    auth_url = "https://login.microsoftonline.com/#{tenant}/oauth2/v2.0/authorize?" + URI.encode_www_form(auth_params)

    render json: { url: auth_url, auth_url: auth_url }
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
      return render_popup_close_page(success: false, error: "No authorization code received")
    end

    # Decode state to get user_id and frontend_url
    user_id = nil
    frontend_url = nil
    if state.present?
      begin
        state_data = JSON.parse(Base64.urlsafe_decode64(state))
        user_id = state_data["user_id"]
        frontend_url = state_data["frontend_url"]
      rescue => e
        Rails.logger.error "Failed to decode OAuth state: #{e.message}"
      end
    end

    unless user_id
      return render_popup_close_page(success: false, error: "Invalid OAuth state - please try again", frontend_url: frontend_url)
    end

    user = User.find_by(id: user_id)
    unless user
      return render_popup_close_page(success: false, error: "User not found - please try again", frontend_url: frontend_url)
    end

    # Exchange code for tokens
    tokens = exchange_code_for_tokens(code)
    unless tokens
      return render_popup_close_page(success: false, error: "Failed to exchange code for tokens", frontend_url: frontend_url)
    end

    # Get user info from Microsoft Graph
    user_info = get_microsoft_user_info(tokens[:access_token])
    microsoft_email = user_info&.dig("mail") || user_info&.dig("userPrincipalName")

    # SSoT: Create/update unified MicrosoftCredential for the user
    update_unified_microsoft_credential(user, tokens, microsoft_email)

    # SSoT: Create org-level SharePoint credential for shared access
    # Uses MicrosoftCredential.delegated_credentials.org_level
    update_organization_onedrive_credential(user, tokens)

    Rails.logger.info "Microsoft connected successfully for user #{user.id} (#{microsoft_email})"
    render_popup_close_page(success: true, email: microsoft_email, frontend_url: frontend_url)
  rescue => e
    Rails.logger.error "Error in Microsoft callback: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
    render_popup_close_page(success: false, error: e.message)
  end

  # GET /api/v1/microsoft/status
  # Check current user's Microsoft connection status
  # Auto-refreshes token if needed, returns needs_reconnect if refresh fails
  def status
    microsoft_token = current_user.microsoft_token

    # SSoT: Using org-wide credentials for email sync (OrgEmailSyncJob)
    # Per-user OAuth via MicrosoftCredential for personal OneDrive/SharePoint

    if microsoft_token.present?
      # Auto-refresh if token is expired or about to expire
      needs_reconnect = false
      if microsoft_token.needs_refresh? && microsoft_token.refresh_token.present?
        Rails.logger.info "[Microsoft Status] Token needs refresh for user #{current_user.id}, attempting auto-refresh..."
        unless microsoft_token.refresh_access_token!
          Rails.logger.warn "[Microsoft Status] Auto-refresh failed for user #{current_user.id}: #{microsoft_token.sync_error}"
          needs_reconnect = true
        end
        microsoft_token.reload
      end

      # If token is in error state, it needs reconnect
      needs_reconnect = true if microsoft_token.status == "error"

      render json: {
        connected: microsoft_token.status == "connected",
        email: microsoft_token.email,
        status: microsoft_token.status,
        expires_at: microsoft_token.token_expires_at,
        needs_refresh: microsoft_token.needs_refresh?,
        needs_reconnect: needs_reconnect,
        # New fields for seamless auto-reconnect
        refresh_token_dead: microsoft_token.refresh_token_dead?,
        reconnect_reason: microsoft_token.reconnect_reason,
        can_auto_reconnect: ENV["OUTLOOK_CLIENT_ID"].present?,
        consecutive_failures: microsoft_token.consecutive_failures,
        last_refresh_attempt_at: microsoft_token.last_refresh_attempt_at,
        # Existing fields
        last_sync_at: microsoft_token.last_sync_at,
        sync_error: microsoft_token.sync_error,
        services: {
          outlook: microsoft_token.status == "connected",
          onedrive: microsoft_token.status == "connected",
          sharepoint: microsoft_token.status == "connected"
        }
      }
    else
      render json: {
        connected: false,
        email: nil,
        status: "disconnected",
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
      render json: { error: "No Microsoft connection to refresh" }, status: :not_found
      return
    end

    if microsoft_token.refresh_access_token!
      render json: {
        success: true,
        message: "Token refreshed successfully",
        expires_at: microsoft_token.token_expires_at
      }
    else
      render json: {
        success: false,
        error: microsoft_token.sync_error || "Failed to refresh token"
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/microsoft/disconnect
  # Disconnect current user's Microsoft account
  def disconnect
    microsoft_token = current_user.microsoft_token
    microsoft_token&.disconnect!

    render json: { success: true, message: "Microsoft account disconnected successfully" }
  end

  # GET /api/v1/microsoft/my_data_stats
  # Get personal data warehouse stats for current user
  def my_data_stats
    microsoft_token = current_user.microsoft_token
    user_email = microsoft_token&.email || current_user.email

    # Email sync stats for this user
    email_sync_status = EmailSyncStatus.find_by(user: current_user)

    # Count emails synced by this user
    emails_synced_by_user = SyncedEmail.where(synced_by_user_id: current_user.id).count

    # Get user's email sync stats
    email_stats = {
      total_synced: email_sync_status&.total_emails_synced || 0,
      last_sync: email_sync_status&.last_sync_at,
      sync_status: email_sync_status&.status || "not_started",
      emails_in_warehouse: emails_synced_by_user
    }

    # Calendar events (upcoming in next 7 days)
    calendar_stats = {
      upcoming_events: 0,  # Would need Graph API call
      last_sync: nil
    }

    # OneDrive personal storage stats (would need Graph API call)
    onedrive_stats = {
      files_accessed: 0,
      last_activity: nil
    }

    render json: {
      user_email: user_email,
      connected: microsoft_token&.status == "connected",
      connected_at: microsoft_token&.created_at,
      email: email_stats,
      calendar: calendar_stats,
      onedrive: onedrive_stats
    }
  end

  # GET /api/v1/microsoft/connections
  # Get detailed connection info for all 4 Microsoft services
  def connections
    microsoft_token = current_user.microsoft_token
    user_email = microsoft_token&.email || current_user.email

    # SSoT: Use MicrosoftCredential
    org_credential = MicrosoftCredential.sharepoint_credential
    sharepoint_info = build_sharepoint_connection_info(org_credential)

    # Get personal OneDrive info (requires user's token)
    onedrive_info = build_onedrive_connection_info(microsoft_token, user_email)

    # Email connection info
    email_info = build_email_connection_info(microsoft_token, user_email)

    # Calendar connection info
    calendar_info = build_calendar_connection_info(microsoft_token, user_email)

    render json: {
      sharepoint: sharepoint_info,
      onedrive: onedrive_info,
      email: email_info,
      calendar: calendar_info
    }
  end

  # GET /api/v1/microsoft/admin_consent_url
  # Get the admin consent URL - allows Azure AD admin to grant permissions for all users
  def admin_consent_url
    # SSoT: admin? now checks user_roles join table
    unless current_user&.admin?
      render json: { error: "Only admins can request organization-wide consent" }, status: :forbidden
      return
    end

    client_id = ENV["OUTLOOK_CLIENT_ID"]
    tenant = ENV["OUTLOOK_TENANT_ID"]

    if client_id.blank? || tenant.blank?
      render json: { error: "Microsoft OAuth not fully configured. OUTLOOK_TENANT_ID is required for admin consent." }, status: :unprocessable_entity
      return
    end

    redirect_uri = "#{request.base_url}/api/v1/microsoft/admin_consent_callback"

    # Admin consent URL uses the /adminconsent endpoint
    consent_url = "https://login.microsoftonline.com/#{tenant}/adminconsent?" + URI.encode_www_form({
      client_id: client_id,
      redirect_uri: redirect_uri,
      state: Base64.urlsafe_encode64({ admin_id: current_user.id }.to_json)
    })

    render json: {
      admin_consent_url: consent_url,
      message: "Click this URL to grant organization-wide consent. You must be an Azure AD admin."
    }
  end

  # GET /api/v1/microsoft/admin_consent_callback
  # Callback after admin grants consent for the organization
  def admin_consent_callback
    error = params[:error]
    error_description = params[:error_description]
    admin_consent = params[:admin_consent]
    tenant = params[:tenant]

    if error.present?
      Rails.logger.error "Admin consent error: #{error} - #{error_description}"
      return render_admin_consent_page(success: false, error: error_description || error)
    end

    if admin_consent == "True"
      Rails.logger.info "Admin consent granted for tenant #{tenant}"

      # Store that admin consent was granted in environment variable via Heroku config
      # For now, we just log it - the consent is stored in Azure AD
      # TODO: Add a settings table or column to persist this if needed

      render_admin_consent_page(success: true, tenant: tenant)
    else
      render_admin_consent_page(success: false, error: "Admin consent was not granted")
    end
  end

  private

  def microsoft_redirect_uri
    # Use the request's base URL for the redirect
    "#{request.base_url}/api/v1/microsoft/callback"
  end

  def exchange_code_for_tokens(code)
    client_id = ENV["OUTLOOK_CLIENT_ID"]
    client_secret = ENV["OUTLOOK_CLIENT_SECRET"]
    tenant = ENV["OUTLOOK_TENANT_ID"] || "common"
    redirect_uri = microsoft_redirect_uri

    response = HTTP.post("https://login.microsoftonline.com/#{tenant}/oauth2/v2.0/token",
      form: {
        client_id: client_id,
        client_secret: client_secret,
        code: code,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code",
        scope: REQUIRED_SCOPES.join(" ")
      }
    )

    if response.status.success?
      data = response.parse
      {
        access_token: data["access_token"],
        refresh_token: data["refresh_token"],
        expires_in: data["expires_in"],
        scope: data["scope"]
      }
    else
      error_data = response.parse
      Rails.logger.error "Failed to exchange code: #{response.status} - #{error_data['error_description']}"
      nil
    end
  end

  def get_microsoft_user_info(access_token)
    response = HTTP.auth("Bearer #{access_token}").get("https://graph.microsoft.com/v1.0/me")
    response.status.success? ? response.parse : nil
  end

  # SSoT: Create/update unified MicrosoftCredential for the user
  # This is THE source of truth for user Microsoft credentials
  def update_unified_microsoft_credential(user, tokens, email)
    Rails.logger.info "[Microsoft Auth] SSoT: Updating MicrosoftCredential for user #{user.id}..."

    # Get default organization for user-level credentials
    # TODO: Use user.organization when User model has organization association
    default_org = Organization.first

    # Find or create user's MicrosoftCredential
    credential = MicrosoftCredential.find_or_initialize_by(
      owner_type: "User",
      owner_id: user.id,
      credential_type: "delegated"
    )

    # Set organization if new record (required FK)
    credential.organization ||= default_org

    credential.mark_connected!(
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      expires_in: tokens[:expires_in],
      scope: tokens[:scope],
      email: email,
      connected_by_id: user.id
    )

    Rails.logger.info "[Microsoft Auth] SSoT: MicrosoftCredential #{credential.id} updated for user #{user.id}"
    credential
  rescue StandardError => e
    Rails.logger.error "[Microsoft Auth] SSoT MicrosoftCredential update failed: #{e.message}"
    raise # Re-raise - this is now critical, not optional
  end

  def update_organization_onedrive_credential(user, tokens)
    # SSoT: Use MicrosoftCredential for organization-level SharePoint access
    Rails.logger.info "[Microsoft Auth] Updating organization OneDrive credential..."

    # Deactivate any existing org-level delegated credentials
    MicrosoftCredential.delegated_credentials.org_level.active.update_all(is_active: false)

    # Create new credential
    credential = MicrosoftCredential.create!(
      credential_type: "delegated",
      organization: Organization.first,
      access_token: tokens[:access_token],
      refresh_token: tokens[:refresh_token],
      token_expires_at: Time.current + tokens[:expires_in].to_i.seconds,
      connected_by: user,
      status: "connected",
      is_active: true
    )

    Rails.logger.info "[Microsoft Auth] Created org credential ID: #{credential.id}"

    # SSoT: Get SharePoint site name from StorageConfiguration or company settings (Jan 2026)
    # No hardcoded org names - tenant configures their own site name
    storage_config = StorageConfiguration.instance
    site_name = storage_config&.site_name.presence || CorporateCompanySetting.instance.company_name
    site_name_lower = site_name&.downcase || ""

    begin
      client = MicrosoftGraphClient.new(credential)

      # Try to find the configured SharePoint site
      Rails.logger.info "[Microsoft Auth] Looking for SharePoint site: #{site_name}..."

      # Search for the site by name
      begin
        result = client.use_sharepoint_site(site_name)
        Rails.logger.info "[Microsoft Auth] Connected to SharePoint site: #{result[:site]['displayName'] || site_name}"
      rescue StandardError => e
        Rails.logger.warn "[Microsoft Auth] Could not find #{site_name} site by name: #{e.message}"

        # Try searching for it
        begin
          sites = client.list_sharepoint_sites
          matching_site = sites.find { |s| s[:name]&.downcase&.include?(site_name_lower) }

          if matching_site
            result = client.use_sharepoint_site(matching_site[:id])
            Rails.logger.info "[Microsoft Auth] Connected to SharePoint via search: #{matching_site[:name]}"
          else
            # Fall back to personal OneDrive
            Rails.logger.warn "[Microsoft Auth] No #{site_name} SharePoint found, using personal OneDrive"
            drive_info = client.get("/me/drive")
            credential.update!(
              drive_id: drive_info["id"],
              drive_name: drive_info["name"] || "My OneDrive",
              metadata: {
                drive_type: "personal",
                owner_name: drive_info.dig("owner", "user", "displayName")
              }
            )
          end
        rescue StandardError => search_error
          Rails.logger.warn "[Microsoft Auth] SharePoint search failed: #{search_error.message}"
          # Still use personal OneDrive as fallback
          drive_info = client.get("/me/drive")
          credential.update!(
            drive_id: drive_info["id"],
            drive_name: drive_info["name"] || "My OneDrive",
            metadata: { drive_type: "personal" }
          )
        end
      end
    rescue StandardError => e
      Rails.logger.error "[Microsoft Auth] Failed to set up SharePoint: #{e.message}"
      # The credential is still valid for basic OneDrive operations
    end

    credential
  end

  def render_popup_close_page(success:, email: nil, error: nil, frontend_url: nil)
    # Use provided frontend_url from state, or fall back to referer/env
    frontend_url ||= get_frontend_url_from_referer

    # Build the redirect URL with status params
    redirect_path = "/settings/integrations/microsoft"
    query_params = success ? "?connected=true&email=#{CGI.escape(email || '')}" : "?error=#{CGI.escape(error || 'Unknown error')}"
    redirect_url = "#{frontend_url}#{redirect_path}#{query_params}"

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
          <p style="margin-top: 16px; font-size: 14px; color: #9ca3af;">Redirecting back to settings...</p>
        </div>
        <script>
          // If this was opened as a popup, notify parent and close
          if (window.opener) {
            window.opener.postMessage({
              type: 'microsoft-oauth-callback',
              success: #{success},
              email: #{email.to_json},
              error: #{error.to_json}
            }, '#{frontend_url}');
            setTimeout(function() { window.close(); }, 2000);
          } else {
            // Not a popup - redirect back to the settings page
            setTimeout(function() {
              window.location.href = '#{redirect_url}';
            }, 1500);
          }
        </script>
      </body>
      </html>
    HTML
    render html: html.html_safe
  end

  def get_frontend_url_from_referer
    # Try to get from referer header (where user came from)
    referer = request.referer
    if referer.present?
      begin
        uri = URI.parse(referer)
        return "#{uri.scheme}://#{uri.host}#{uri.port && ![ 80, 443 ].include?(uri.port) ? ":#{uri.port}" : ''}"
      rescue URI::InvalidURIError
        # Fall through to defaults
      end
    end

    # Fall back to environment variable
    ENV["FRONTEND_URL"] || "https://teeemrob.vercel.app"
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

  def render_admin_consent_page(success:, tenant: nil, error: nil)
    frontend_url = ENV["FRONTEND_URL"] || "https://teeemrob.vercel.app"

    html = <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <title>#{success ? 'Admin Consent Granted' : 'Admin Consent Failed'}</title>
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
            max-width: 500px;
          }
          .icon { font-size: 48px; margin-bottom: 16px; }
          h1 { color: #{success ? '#166534' : '#991b1b'}; margin: 0 0 8px 0; font-size: 24px; }
          p { color: #6b7280; margin: 8px 0; }
          .info { background: #f3f4f6; padding: 16px; border-radius: 8px; margin-top: 16px; text-align: left; }
          .info p { margin: 4px 0; font-size: 14px; }
          a { color: #4f46e5; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">#{success ? '✓' : '✕'}</div>
          <h1>#{success ? 'Organization Consent Granted!' : 'Admin Consent Failed'}</h1>
          #{success ? admin_consent_success_html(tenant) : "<p>#{error}</p>"}
          <p style="margin-top: 24px;"><a href="#{frontend_url}/admin/system?tab=company&subtab=Connections">Return to TEEEM Settings</a></p>
        </div>
      </body>
      </html>
    HTML
    render html: html.html_safe
  end

  def admin_consent_success_html(tenant)
    <<~HTML
      <p>All users in your organization can now connect their Microsoft 365 accounts.</p>
      <div class="info">
        <p><strong>What this means:</strong></p>
        <p>• Users won't need to individually grant permissions</p>
        <p>• When they click "Connect Microsoft 365", they just need to sign in</p>
        <p>• Their Outlook, OneDrive, and SharePoint access will be enabled automatically</p>
      </div>
      <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">Tenant ID: #{tenant}</p>
    HTML
  end

  def build_sharepoint_connection_info(org_credential)
    # SSoT: Use company name from settings, not hardcoded (Jan 2026)
    company_name = CorporateCompanySetting.instance.company_name
    display_name = "#{company_name} SharePoint"
    return { connected: false, name: display_name, auth_type: "organization" } unless org_credential

    # Get the actual authenticated user from Graph API
    authenticated_as = nil
    begin
      client = MicrosoftGraphClient.new(org_credential)
      me = client.get("/me")
      authenticated_as = me["mail"] || me["userPrincipalName"]
    rescue StandardError => e
      Rails.logger.warn "[Connections] Failed to get SharePoint auth user: #{e.message}"
    end

    # SSoT: Get SharePoint config from StorageConfiguration
    storage_config = StorageConfiguration.instance
    site_url = storage_config&.site_url.presence
    # SSoT: drive_name comes from StorageConfiguration - no hardcoded fallback
    drive_name = storage_config&.drive_name.presence
    documents_url = (site_url && drive_name) ? "#{site_url}/#{drive_name.gsub(' ', '%20')}" : nil

    {
      connected: true,
      name: display_name,  # SSoT: Dynamic from company settings (Jan 2026)
      url: documents_url,
      document_library: drive_name,
      root_folder: storage_config&.root_path,
      authenticated_as: authenticated_as,
      auth_type: "organization",
      drive_id: storage_config&.drive_id
    }
  end

  def build_onedrive_connection_info(microsoft_token, user_email)
    connected = microsoft_token&.status == "connected"

    # Build personal OneDrive URL from email
    # SSoT: Derive OneDrive domain from SharePoint site URL
    # Format: gotekna-my.sharepoint.com/personal/robert_tekna_com_au
    onedrive_url = nil

    if user_email.present?
      # Get the tenant prefix from SharePoint site URL (e.g., "gotekna" from "gotekna.sharepoint.com")
      # SSoT: Use StorageConfiguration for site URL
      site_url = StorageConfiguration.instance.site_url
      tenant_prefix = site_url&.match(/https?:\/\/([^.]+)\.sharepoint\.com/)&.[](1)

      if tenant_prefix.present?
        # Convert email to OneDrive path format: robert@tekna.com.au -> robert_tekna_com_au
        email_path = user_email.gsub("@", "_").gsub(".", "_")
        onedrive_url = "https://#{tenant_prefix}-my.sharepoint.com/personal/#{email_path}/Documents"
      end
    end

    {
      connected: connected,
      name: "Personal OneDrive",
      url: onedrive_url,
      authenticated_as: connected ? user_email : nil,
      auth_type: "personal"
    }
  end

  def build_email_connection_info(microsoft_token, user_email)
    connected = microsoft_token&.status == "connected"

    {
      connected: connected,
      name: "Outlook Email",
      url: "https://outlook.office.com/mail/",
      authenticated_as: connected ? user_email : nil,
      auth_type: "personal"
    }
  end

  def build_calendar_connection_info(microsoft_token, user_email)
    connected = microsoft_token&.status == "connected"

    {
      connected: connected,
      name: "Outlook Calendar",
      url: "https://outlook.office.com/calendar/",
      authenticated_as: connected ? user_email : nil,
      auth_type: "personal"
    }
  end
end
