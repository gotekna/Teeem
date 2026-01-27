class Api::V1::MicrosoftAppController < ApplicationController
  # Controller for organization-wide Microsoft app permissions (Client Credentials flow)
  # This uses Application permissions, not Delegated permissions
  # Once set up, can access ANY user's mailbox without individual OAuth

  skip_before_action :authorize_request, only: [ :admin_consent_callback ]

  # Required Application permissions in Azure AD:
  # - Mail.Read (Application) - Read all users' mail
  # - Mail.ReadWrite (Application) - Read/write all users' mail (if sending needed)
  # - User.Read.All (Application) - List users in tenant
  # - Files.Read.All (Application) - Read all files in OneDrive/SharePoint
  # - Sites.Read.All (Application) - Read all SharePoint sites
  APPLICATION_PERMISSIONS = [
    "https://graph.microsoft.com/Mail.Read",
    "https://graph.microsoft.com/Mail.ReadWrite",
    "https://graph.microsoft.com/User.Read.All",
    "https://graph.microsoft.com/Files.Read.All",
    "https://graph.microsoft.com/Sites.Read.All"
  ].freeze

  # GET /api/v1/microsoft_app/status
  # Check the org-wide Microsoft app credential status (all organizations)
  def status
    # Check if env vars are configured
    env_configured = ENV["OUTLOOK_CLIENT_ID"].present? &&
                     ENV["OUTLOOK_CLIENT_SECRET"].present? &&
                     ENV["OUTLOOK_TENANT_ID"].present?

    # SSoT: Use MicrosoftCredential only
    credentials = MicrosoftCredential.active_credentials

    if credentials.empty?
      render json: {
        configured: false,
        status: "not_configured",
        message: "Organization-wide Microsoft access not configured",
        env_configured: env_configured,
        tenant_id: ENV["OUTLOOK_TENANT_ID"],
        organizations: []
      }
    else
      # Return all configured organizations
      organizations = credentials.map do |credential|
        {
          id: credential.id,
          name: credential.name,
          configured: true,
          status: credential.status,
          tenant_id: credential.tenant_id,
          admin_consent_granted_at: credential.admin_consent_granted_at,
          admin_consent_granted_by: credential.admin_consent_granted_by,
          last_sync_at: credential.try(:last_sync_at) || credential.try(:last_synced_at),
          last_error: credential.try(:last_error) || credential.try(:error_message),
          token_valid: !credential.token_expired?
        }
      end

      render json: {
        configured: true,
        status: credentials.any? { |c| c.status == "connected" } ? "connected" : "pending",
        env_configured: env_configured,
        organizations: organizations
      }
    end
  end

  # GET /api/v1/microsoft_app/health_dashboard
  # Health dashboard for 4-square status display
  # Shows overall health, connected count, needs attention, and self-healing status
  def health_dashboard
    # Available organizations (SSoT - defined in one place)
    available_org_names = %w[Tekna 100xBestLife Homes\ of\ Hope Love\ Your\ World]
    total_count = available_org_names.length

    # SSoT: Get all active MicrosoftCredential (app type)
    all_creds = MicrosoftCredential.app_credentials.active.to_a

    connected_count = all_creds.count { |c| c.status == "connected" }
    error_count = all_creds.count { |c| c.status.in?(%w[error dead]) }
    warning_count = all_creds.count { |c| c.token_expired? && c.status == "connected" }

    # Check self-healing status (last token refresh from RefreshIntegrationTokensJob)
    # SSoT: Only check MicrosoftCredential
    last_refresh = MicrosoftCredential.maximum(:last_refresh_attempt_at)

    self_healing_active = last_refresh.present? && last_refresh > 20.minutes.ago

    # Determine overall status
    overall_status = if error_count > 0
                       "critical"
                     elsif warning_count > 0
                       "warning"
                     elsif connected_count == 0
                       "disconnected"
                     else
                       "healthy"
                     end

    render json: {
      success: true,
      overall_status: overall_status,
      connected_count: connected_count,
      total_count: total_count,
      needs_attention_count: error_count,
      warning_count: warning_count,
      self_healing: {
        active: self_healing_active,
        last_refresh_at: last_refresh,
        status: self_healing_active ? "active" : "inactive"
      },
      # Per-org breakdown
      organizations: all_creds.map do |cred|
        {
          id: cred.id,
          name: cred.name,
          status: cred.status,
          token_valid: !cred.token_expired?,
          token_expires_at: cred.token_expires_at,
          consecutive_failures: cred.try(:consecutive_failures) || 0,
          last_refresh_attempt_at: cred.try(:last_refresh_attempt_at),
          last_error: cred.try(:last_error) || cred.try(:error_message),
          self_healing_available: true # App credentials can auto-heal
        }
      end
    }
  end

  # POST /api/v1/microsoft_app/setup
  # Initial setup - uses existing OUTLOOK_* env vars OR manual input
  # Now supports multiple organizations via :name parameter
  def setup
    unless current_user_admin?
      return render json: { error: "Only admins can configure organization-wide Microsoft access" }, status: :forbidden
    end

    # Name is required for multi-org support
    org_name = params[:name].presence || "Default"

    # Use env vars if available, otherwise use params
    client_id = params[:client_id].presence || ENV["OUTLOOK_CLIENT_ID"]
    client_secret = params[:client_secret].presence || ENV["OUTLOOK_CLIENT_SECRET"]
    tenant_id = params[:tenant_id].presence || ENV["OUTLOOK_TENANT_ID"]

    if client_id.blank? || client_secret.blank? || tenant_id.blank?
      return render json: {
        error: "Missing credentials. Either set OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_TENANT_ID env vars or provide them manually."
      }, status: :unprocessable_entity
    end

    # SSoT: Use MicrosoftCredential only
    # Check if org with this name already exists (active OR inactive)
    existing = MicrosoftCredential.app_credentials.find_by(name: org_name)
    if existing
      # Reactivate and update existing credential
      existing.update!(
        client_id: client_id,
        client_secret: client_secret,
        tenant_id: tenant_id,
        setup_by: current_user,
        status: "pending",
        is_active: true
      )
      credential = existing
    else
      # SSoT (Jan 2026): Derive organization from tenant
      org = current_tenant&.organizations&.first
      credential = MicrosoftCredential.create!(
        name: org_name,
        credential_type: "app",
        organization: org,
        client_id: client_id,
        client_secret: client_secret,
        tenant_id: tenant_id,
        setup_by: current_user,
        status: "pending",
        is_active: true
      )
    end

    render json: {
      success: true,
      message: "App credentials saved for #{org_name}. Now grant admin consent to activate.",
      admin_consent_url: admin_consent_url_for(credential),
      organization_id: credential.id,
      organization_name: credential.name,
      using_env_vars: params[:client_id].blank?
    }
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST /api/v1/microsoft_app/setup_from_env
  # Quick setup using existing env vars - no manual input needed
  # Now supports multiple organizations via :name parameter
  def setup_from_env
    unless current_user_admin?
      return render json: { error: "Only admins can configure organization-wide Microsoft access" }, status: :forbidden
    end

    org_name = params[:name].presence || "Tekna"

    client_id = ENV["OUTLOOK_CLIENT_ID"]
    client_secret = ENV["OUTLOOK_CLIENT_SECRET"]
    tenant_id = ENV["OUTLOOK_TENANT_ID"]

    # Graceful degradation: return configured: false instead of error for local dev
    if client_id.blank? || client_secret.blank? || tenant_id.blank?
      return render json: {
        success: false,
        configured: false,
        message: "Microsoft 365 credentials not configured in environment. Set OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, and OUTLOOK_TENANT_ID to enable."
      }
    end

    # SSoT: Use MicrosoftCredential only
    # Check if org with this name already exists (active OR inactive)
    existing = MicrosoftCredential.app_credentials.find_by(name: org_name)
    if existing
      # Reactivate and update existing credential
      existing.update!(
        client_id: client_id,
        client_secret: client_secret,
        tenant_id: tenant_id,
        setup_by: current_user,
        status: "pending",
        is_active: true
      )
      credential = existing
    else
      # SSoT (Jan 2026): Derive organization from tenant
      org = current_tenant&.organizations&.first
      credential = MicrosoftCredential.create!(
        name: org_name,
        credential_type: "app",
        organization: org,
        client_id: client_id,
        client_secret: client_secret,
        tenant_id: tenant_id,
        setup_by: current_user,
        status: "pending",
        is_active: true
      )
    end

    render json: {
      success: true,
      message: "Using existing Microsoft credentials for #{org_name}. Now grant admin consent to enable organization-wide access.",
      admin_consent_url: admin_consent_url_for(credential),
      organization_id: credential.id,
      organization_name: credential.name,
      tenant_id: tenant_id
    }
  end

  # GET /api/v1/microsoft_app/admin_consent_url
  # Get URL for Azure AD admin to grant organization-wide consent
  def admin_consent_url
    unless current_user_admin?
      return render json: { error: "Only admins can request organization-wide consent" }, status: :forbidden
    end

    credential = find_credential_with_org_context
    unless credential
      return render json: { error: "Please set up app credentials first" }, status: :unprocessable_entity
    end

    render json: {
      admin_consent_url: admin_consent_url_for(credential),
      message: "Click this URL to grant organization-wide consent. You must be an Azure AD admin."
    }
  end

  # GET /api/v1/microsoft_app/admin_consent_callback
  # Callback after Azure AD admin grants consent
  def admin_consent_callback
    error = params[:error]
    error_description = params[:error_description]
    admin_consent = params[:admin_consent]
    tenant = params[:tenant]
    state = params[:state]

    frontend_url = ENV["FRONTEND_URL"] || "http://localhost:3000"

    if error.present?
      Rails.logger.error "[MicrosoftApp] Admin consent error: #{error} - #{error_description}"
      return redirect_to "#{frontend_url}/settings/integrations/microsoft?app_consent_error=#{CGI.escape(error_description || error)}", allow_other_host: true
    end

    if admin_consent == "True"
      # Find the credential from state (supports multi-org)
      credential = nil
      admin_email = nil
      org_name = nil

      if state.present?
        begin
          state_data = JSON.parse(Base64.urlsafe_decode64(state))
          # Multi-org: find by credential_id from state (SSoT: MicrosoftCredential)
          if state_data["credential_id"]
            credential = MicrosoftCredential.find_by(id: state_data["credential_id"])
          end
          admin_user = User.find_by(id: state_data["admin_id"])
          admin_email = admin_user&.email
          org_name = credential&.name
        rescue => e
          Rails.logger.warn "[MicrosoftApp] Could not decode state: #{e.message}"
        end
      end

      # Fallback to credential lookup with org context if state didn't work
      # Note: In callback, we may not have org context in params, so use fallback with warning
      if credential.nil?
        Rails.logger.warn "[MicrosoftAppController] Admin consent callback fallback - no credential_id in state"
        credential = MicrosoftCredential.active_credential
      end

      if credential
        # Update the credential with the actual tenant_id from the org that granted consent
        # This is important for multi-tenant apps where we use 'organizations' endpoint
        if tenant.present? && tenant != credential.tenant_id
          credential.update!(tenant_id: tenant)
          Rails.logger.info "[MicrosoftApp] Updated tenant_id for #{credential.name} to #{tenant}"
        end

        # Test the connection and fetch initial token
        if credential.test_connection!
          credential.mark_admin_consent!(admin_email || "unknown")
          Rails.logger.info "[MicrosoftApp] Admin consent granted for #{credential.name} (tenant: #{tenant})"

          redirect_to "#{frontend_url}/settings/integrations/microsoft?app_consent_success=true&org=#{CGI.escape(credential.name || '')}", allow_other_host: true
        else
          Rails.logger.error "[MicrosoftApp] Admin consent granted but connection test failed: #{credential.last_error}"
          redirect_to "#{frontend_url}/settings/integrations/microsoft?app_consent_error=#{CGI.escape(credential.last_error || 'Connection test failed')}", allow_other_host: true
        end
      else
        Rails.logger.error "[MicrosoftApp] No active credential found after admin consent"
        redirect_to "#{frontend_url}/settings/integrations/microsoft?app_consent_error=#{CGI.escape('No credential found')}", allow_other_host: true
      end
    else
      redirect_to "#{frontend_url}/settings/integrations/microsoft?app_consent_error=#{CGI.escape('Admin consent was not granted')}", allow_other_host: true
    end
  end

  # POST /api/v1/microsoft_app/test
  # Test the connection for a specific organization
  def test
    unless current_user_admin?
      return render json: { error: "Only admins can test organization-wide Microsoft access" }, status: :forbidden
    end

    # Support testing specific org by id or name (uses org-scoped helper)
    credential = find_credential_with_org_context

    unless credential
      return render json: { error: "No app credential configured" }, status: :not_found
    end

    if credential.test_connection!
      render json: {
        success: true,
        message: "Connection successful for #{credential.name}! Can access organization mailboxes.",
        organization_id: credential.id,
        organization_name: credential.name,
        status: credential.status
      }
    else
      render json: {
        success: false,
        error: credential.last_error,
        organization_name: credential.name,
        status: credential.status
      }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/microsoft_app/users
  # List all users in the tenant that can be synced
  def users
    unless current_user_admin?
      return render json: { error: "Only admins can view organization users" }, status: :forbidden
    end

    # Support fetching users for specific org by id or name (uses org-scoped helper)
    credential = find_credential_with_org_context

    unless credential&.status == "connected"
      return render json: { error: "Organization Microsoft access not connected" }, status: :not_found
    end

    users = credential.list_tenant_users

    render json: {
      users: users,
      total: users.count
    }
  end

  # POST /api/v1/microsoft_app/configure_sync
  # Configure which users' emails to sync
  def configure_sync
    unless current_user_admin?
      return render json: { error: "Only admins can configure sync settings" }, status: :forbidden
    end

    credential = find_credential_with_org_context
    unless credential
      return render json: { error: "No app credential configured" }, status: :not_found
    end

    # Update sync configuration
    # sync_all: true - sync all users
    # user_emails: ['user1@org.com', 'user2@org.com'] - sync specific users
    sync_config = {
      sync_all: params[:sync_all] || false,
      user_emails: params[:user_emails] || [],
      folders: params[:folders] || [ "inbox", "sentitems" ],
      sync_years: params[:sync_years] || 3
    }

    credential.update!(sync_config: sync_config)

    render json: {
      success: true,
      message: "Sync configuration updated",
      sync_config: credential.sync_config
    }
  end

  # GET /api/v1/microsoft_app/organizations_with_mailboxes
  # List all MS365 orgs with their available mailboxes (for admin config UI)
  def organizations_with_mailboxes
    unless current_user_admin?
      return render json: { error: "Only admins can view organization mailboxes" }, status: :forbidden
    end

    # Get all TEEEM users for the mapping UI (include all users so admins can pre-configure access)
    teeem_users = User.order(:name).map do |u|
      { id: u.id, name: u.name, email: u.email }
    end

    # SSoT: Use MicrosoftCredential
    organizations = MicrosoftCredential.app_credentials.active.order(:name).map do |org|
      # Get mailboxes from tenant
      all_mailboxes = if org.status == "connected"
        begin
          org.list_tenant_users.map { |u| u[:email] }.compact
        rescue => e
          Rails.logger.error "[MicrosoftApp] Failed to fetch mailboxes for #{org.name}: #{e.message}"
          []
        end
      else
        []
      end

      # Show all mailboxes from the tenant for each org
      # Since all orgs may share the same Microsoft tenant, we don't filter by domain
      # Admins configure which users can access which mailboxes per org
      mailboxes = all_mailboxes.sort

      # Get current user-mailbox access configuration
      user_mailbox_access = org.sync_config&.dig("user_mailbox_access") || {}
      # Get sync_all setting (Jan 2026: Option B - sync all tenant mailboxes)
      sync_all = org.sync_config&.dig("sync_all") || false

      {
        id: org.id,
        name: org.name,
        status: org.status,
        mailboxes: mailboxes,
        user_mailbox_access: user_mailbox_access,
        sync_all: sync_all
      }
    end

    render json: {
      success: true,
      organizations: organizations,
      teeem_users: teeem_users
    }
  end

  # PUT /api/v1/microsoft_app/:organization_id/user_mailbox_access
  # Configure which TEEEM users can access which mailboxes
  # FRC (Jan 2026): Also auto-updates user_emails to sync all accessible mailboxes
  def update_user_mailbox_access
    unless current_user_admin?
      return render json: { error: "Only admins can configure mailbox access" }, status: :forbidden
    end

    # SSoT: Use MicrosoftCredential
    credential = MicrosoftCredential.find_by(id: params[:id])
    unless credential
      return render json: { error: "Organization not found" }, status: :not_found
    end

    # user_mailbox_access format:
    # { "34": ["robert@tekna.com.au", "rob.w@tekna.com.au"], "56": ["sam@tekna.com.au"] }
    # Keys are TEEEM user IDs, values are arrays of allowed mailbox emails
    user_mailbox_access = params[:user_mailbox_access] || {}

    # FRC (Jan 2026): Auto-derive user_emails from all accessible mailboxes
    # If ANY user has access to a mailbox, it should be synced automatically
    # This fixes the bug where granting access didn't enable syncing
    all_accessible_mailboxes = user_mailbox_access.values.flatten.uniq.sort

    # Merge with existing sync_config, updating BOTH user_mailbox_access AND user_emails
    existing_config = credential.sync_config || {}
    new_sync_config = existing_config.merge(
      "user_mailbox_access" => user_mailbox_access,
      "user_emails" => all_accessible_mailboxes
    )
    credential.update!(sync_config: new_sync_config)

    # Trigger incremental sync to pick up any new mailboxes
    if all_accessible_mailboxes.any?
      OrgEmailSyncJob.perform_later("incremental", credential_id: credential.id)
    end

    render json: {
      success: true,
      message: "Mailbox access configuration saved for #{credential.name}. Syncing #{all_accessible_mailboxes.count} mailbox(es).",
      user_mailbox_access: user_mailbox_access,
      user_emails: all_accessible_mailboxes
    }
  end

  # PUT /api/v1/microsoft_app/:id/toggle_sync_all
  # Toggle sync_all setting for an organization (Jan 2026: Option B - sync all tenant mailboxes)
  # When enabled, OrgEmailSyncJob will sync ALL mailboxes from the tenant
  def toggle_sync_all
    unless current_user_admin?
      return render json: { error: "Only admins can toggle sync settings" }, status: :forbidden
    end

    credential = MicrosoftCredential.find_by(id: params[:id])
    unless credential
      return render json: { error: "Organization not found" }, status: :not_found
    end

    sync_all = ActiveModel::Type::Boolean.new.cast(params[:sync_all])

    # Update sync_config with new sync_all value
    existing_config = credential.sync_config || {}
    new_sync_config = existing_config.merge("sync_all" => sync_all)
    credential.update!(sync_config: new_sync_config)

    # If enabling sync_all, trigger a sync immediately
    if sync_all
      OrgEmailSyncJob.perform_later("incremental", credential_id: credential.id)
    end

    render json: {
      success: true,
      sync_all: sync_all,
      message: sync_all ?
        "Sync All enabled for #{credential.name}. All tenant mailboxes will be synced." :
        "Sync All disabled for #{credential.name}. Only configured mailboxes will be synced."
    }
  end

  # DELETE /api/v1/microsoft_app/disconnect
  # Remove the organization-wide Microsoft access for a specific org
  def disconnect
    unless current_user_admin?
      return render json: { error: "Only admins can disconnect organization-wide Microsoft access" }, status: :forbidden
    end

    # Support disconnecting specific org by id or name
    # Check both query params and request body for flexibility
    org_id = params[:organization_id] || params[:id]
    org_name = params[:name]

    Rails.logger.info "[MicrosoftApp] Disconnect called - org_id: #{org_id}, org_name: #{org_name}, all params: #{params.to_unsafe_h}"

    # SSoT: Use org-scoped credential lookup
    credential = find_credential_with_org_context

    if credential
      org_name = credential.name
      credential.disconnect!  # Clear credentials when disconnecting
      render json: {
        success: true,
        message: "Organization-wide Microsoft access for #{org_name} has been disconnected"
      }
    else
      render json: { error: "No organization found to disconnect" }, status: :not_found
    end
  end

  # ==========================================
  # SharePoint/OneDrive Endpoints
  # ==========================================

  # GET /api/v1/microsoft_app/sharepoint_sites
  # List all SharePoint sites in the tenant
  def sharepoint_sites
    unless current_user_admin?
      return render json: { error: "Only admins can view SharePoint sites" }, status: :forbidden
    end

    credential = find_credential_with_org_context
    unless credential&.status == "connected"
      return render json: { error: "Organization Microsoft access not connected" }, status: :not_found
    end

    begin
      client = MicrosoftAppGraphClient.new
      sites = client.get_all_sites(top: params[:top]&.to_i || 100)

      render json: {
        sites: sites,
        total: sites.count
      }
    rescue MicrosoftAppGraphClient::ApiError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/microsoft_app/site_drives
  # List drives (document libraries) for a SharePoint site
  def site_drives
    unless current_user_admin?
      return render json: { error: "Only admins can view site drives" }, status: :forbidden
    end

    site_id = params[:site_id]
    unless site_id.present?
      return render json: { error: "site_id is required" }, status: :bad_request
    end

    credential = find_credential_with_org_context
    unless credential&.status == "connected"
      return render json: { error: "Organization Microsoft access not connected" }, status: :not_found
    end

    begin
      client = MicrosoftAppGraphClient.new
      drives = client.get_site_drives(site_id)

      render json: {
        site_id: site_id,
        drives: drives,
        total: drives.count
      }
    rescue MicrosoftAppGraphClient::ApiError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/microsoft_app/browse
  # Browse files in a drive (SharePoint or OneDrive)
  def browse
    unless current_user_admin?
      return render json: { error: "Only admins can browse files" }, status: :forbidden
    end

    drive_id = params[:drive_id]
    unless drive_id.present?
      return render json: { error: "drive_id is required" }, status: :bad_request
    end

    credential = find_credential_with_org_context
    unless credential&.status == "connected"
      return render json: { error: "Organization Microsoft access not connected" }, status: :not_found
    end

    begin
      client = MicrosoftAppGraphClient.new
      items = client.list_drive_items(
        drive_id,
        folder_path: params[:folder_path],
        folder_id: params[:folder_id],
        top: params[:top]&.to_i || 100
      )

      render json: {
        drive_id: drive_id,
        folder_path: params[:folder_path],
        folder_id: params[:folder_id],
        items: items,
        total: items.count
      }
    rescue MicrosoftAppGraphClient::ApiError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/microsoft_app/search_files
  # Search across all SharePoint sites in the tenant
  def search_files
    unless current_user_admin?
      return render json: { error: "Only admins can search files" }, status: :forbidden
    end

    query = params[:q]
    unless query.present?
      return render json: { error: "q (search query) is required" }, status: :bad_request
    end

    credential = find_credential_with_org_context
    unless credential&.status == "connected"
      return render json: { error: "Organization Microsoft access not connected" }, status: :not_found
    end

    begin
      client = MicrosoftAppGraphClient.new

      # Search in specific drive if provided, otherwise search all
      if params[:drive_id].present?
        results = client.search_drive(params[:drive_id], query, top: params[:top]&.to_i || 50)
      else
        results = client.search_all_files(query, top: params[:top]&.to_i || 50)
      end

      render json: {
        query: query,
        drive_id: params[:drive_id],
        results: results,
        total: results.count
      }
    rescue MicrosoftAppGraphClient::ApiError => e
      render json: { error: e.message }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/microsoft_app/test_sharepoint
  # Test SharePoint access specifically
  def test_sharepoint
    unless current_user_admin?
      return render json: { error: "Only admins can test SharePoint access" }, status: :forbidden
    end

    credential = find_credential_with_org_context
    unless credential&.status == "connected"
      return render json: { error: "Organization Microsoft access not connected" }, status: :not_found
    end

    begin
      client = MicrosoftAppGraphClient.new
      sites = client.list_sharepoint_sites(top: 5)

      render json: {
        success: true,
        message: "SharePoint access working! Found #{sites.count} site(s).",
        sample_sites: sites.map { |s| { name: s[:display_name], url: s[:web_url] } }
      }
    rescue MicrosoftAppGraphClient::ApiError => e
      render json: {
        success: false,
        error: e.message,
        hint: "Ensure Files.Read.All and Sites.Read.All Application permissions are granted"
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/microsoft_app/sync_to_storage
  # Sync emails to SyncedEmail and upload to configured storage provider (SSoT: StorageConfiguration)
  def sync_to_storage
    unless current_user_admin?
      return render json: { error: "Only admins can trigger storage sync" }, status: :forbidden
    end

    # Queue the storage upload job (respects StorageConfiguration provider)
    UploadEmailsToStorageJob.perform_later(batch_size: 500)

    render json: {
      success: true,
      message: "Email storage upload job queued. Emails will be uploaded to configured storage provider."
    }
  rescue StandardError => e
    Rails.logger.error "[MicrosoftApp] Sync to storage failed: #{e.message}"
    render json: {
      success: false,
      error: e.message
    }, status: :unprocessable_entity
  end

  # POST /api/v1/microsoft_app/sync_to_sharepoint
  # Legacy endpoint - redirects to sync_to_storage for backwards compatibility
  def sync_to_sharepoint
    sync_to_storage
  end

  # ==========================================
  # SharePoint Configuration for Attachments (TEEEM's Single SharePoint)
  # ==========================================

  # GET /api/v1/microsoft_app/sharepoint_config
  # Get current TEEEM SharePoint configuration for attachment storage
  def sharepoint_config
    unless current_user_admin?
      return render json: { error: "Only admins can view SharePoint configuration" }, status: :forbidden
    end

    # SSoT: Use MicrosoftCredential
    sp_config = MicrosoftCredential.teeem_sharepoint_config

    if sp_config
      render json: {
        configured: true,
        site_id: sp_config[:site_id],
        drive_id: sp_config[:drive_id],
        drive_name: sp_config[:drive_name],
        credential_name: sp_config[:credential].name
      }
    else
      render json: {
        configured: false,
        message: "SharePoint not configured for attachment storage. Please configure TEEEM's SharePoint site and drive."
      }
    end
  end

  # POST /api/v1/microsoft_app/configure_sharepoint
  # Configure TEEEM's SharePoint site/drive for attachment storage
  # This discovers available sites and drives for selection
  def configure_sharepoint
    unless current_user_admin?
      return render json: { error: "Only admins can configure SharePoint" }, status: :forbidden
    end

    # Get the credential to use for SharePoint (org-scoped)
    credential = find_credential_with_org_context

    unless credential&.status == "connected"
      return render json: { error: "No connected Microsoft credential found" }, status: :not_found
    end

    begin
      # Auto-discover SharePoint sites
      client = MicrosoftAppGraphClient.new(credential)
      sites = client.list_sharepoint_sites(top: 50)

      # Get drives for each site
      sites_with_drives = sites.map do |site|
        begin
          drives = client.get_site_drives(site[:id])
          {
            site_id: site[:id],
            site_name: site[:display_name] || site[:name],
            site_url: site[:web_url],
            drives: drives.map { |d| { id: d["id"], name: d["name"], type: d["driveType"] } }
          }
        rescue => e
          Rails.logger.error "[MicrosoftApp] Failed to get drives for site #{site[:id]}: #{e.message}"
          nil
        end
      end.compact

      # Get current config (SSoT: MicrosoftCredential)
      current_config = MicrosoftCredential.teeem_sharepoint_config

      render json: {
        success: true,
        sites: sites_with_drives,
        current_config: current_config ? {
          site_id: current_config[:site_id],
          drive_id: current_config[:drive_id],
          drive_name: current_config[:drive_name],
          credential_name: current_config[:credential].name
        } : nil
      }
    rescue StandardError => e
      Rails.logger.error "[MicrosoftApp] Failed to discover SharePoint sites: #{e.message}"
      render json: {
        success: false,
        error: e.message
      }, status: :unprocessable_entity
    end
  end

  # PUT /api/v1/microsoft_app/update_sharepoint_config
  # Update TEEEM's SharePoint configuration for attachment storage
  def update_sharepoint_config
    unless current_user_admin?
      return render json: { error: "Only admins can configure SharePoint" }, status: :forbidden
    end

    site_id = params[:site_id]
    drive_id = params[:drive_id]
    drive_name = params[:drive_name]

    unless site_id.present? && drive_id.present?
      return render json: { error: "site_id and drive_id are required" }, status: :bad_request
    end

    # SSoT: Update StorageConfiguration instead of MicrosoftCredential
    # MicrosoftCredential only holds auth tokens, StorageConfiguration holds connection config
    storage_config = StorageConfiguration.instance
    unless storage_config
      return render json: { error: "No StorageConfiguration found" }, status: :not_found
    end

    # Update the SharePoint connection config
    storage_config.update!(
      connection_config: storage_config.connection_config.merge(
        "site_id" => site_id,
        "drive_id" => drive_id,
        "drive_name" => drive_name
      ),
      status: "connected"
    )

    render json: {
      success: true,
      message: "SharePoint configuration saved. All attachment uploads will now go to TEEEM's SharePoint.",
      config: {
        site_id: storage_config.site_id,
        drive_id: storage_config.drive_id,
        drive_name: storage_config.drive_name,
        provider_type: storage_config.provider_type
      }
    }
  rescue StandardError => e
    Rails.logger.error "[MicrosoftApp] Failed to update SharePoint config: #{e.message}"
    render json: {
      success: false,
      error: e.message
    }, status: :unprocessable_entity
  end

  # POST /api/v1/microsoft_app/backfill_attachments
  # Trigger backfill job to upload existing attachments to SharePoint
  def backfill_attachments
    unless current_user_admin?
      return render json: { error: "Only admins can trigger attachment backfill" }, status: :forbidden
    end

    organization_id = params[:organization_id]
    unless organization_id.present?
      return render json: { error: "organization_id is required" }, status: :bad_request
    end

    # SSoT: Use MicrosoftCredential
    credential = MicrosoftCredential.find_by(id: organization_id)
    unless credential&.status == "connected"
      return render json: { error: "Organization not connected" }, status: :not_found
    end

    unless StorageConfiguration.instance&.connected?
      return render json: { error: "Storage not configured. Please configure storage provider first." }, status: :unprocessable_entity
    end

    # Queue the backfill job
    BackfillAttachmentUploadsJob.perform_later(credential.id)

    render json: {
      success: true,
      message: "Backfill job queued for #{credential.name}. Existing attachments will be uploaded to storage."
    }
  rescue StandardError => e
    Rails.logger.error "[MicrosoftApp] Attachment backfill failed: #{e.message}"
    render json: {
      success: false,
      error: e.message
    }, status: :unprocessable_entity
  end

  private

  def current_user_admin?
    # SSoT: admin? now checks user_roles join table
    current_user&.admin? || current_user&.permissions&.include?("admin")
  end

  # SSoT: Find organization by ID, name, or slug
  # Returns nil if not found
  def find_organization
    org_id = params[:organization_id].presence || params[:org_id].presence
    org_name = params[:organization_name].presence || params[:org_name].presence || params[:name].presence

    if org_id.present?
      Organization.find_by(id: org_id)
    elsif org_name.present?
      Organization.find_by_name_or_slug(org_name)
    end
  end

  # SSoT: Find credential with org context
  # Uses organization_id if provided, otherwise falls back to legacy patterns (with warning)
  def find_credential_with_org_context
    org = find_organization

    if org.present?
      # SSoT: Org-scoped lookup (MicrosoftCredential only)
      MicrosoftCredential.active_for_org(org)
    elsif params[:id].present? || params[:credential_id].present?
      # Lookup by credential ID
      cred_id = params[:id].presence || params[:credential_id].presence
      MicrosoftCredential.find_by(id: cred_id)
    else
      # Fallback - logs warning
      Rails.logger.warn "[MicrosoftAppController] Credential lookup without org context. " \
                        "Pass organization_id parameter for proper isolation. " \
                        "Action: #{action_name}, Params: #{params.keys.join(', ')}"
      MicrosoftCredential.active_credential
    end
  end

  # SSoT: Ensure organization exists for credential operations
  def find_or_create_organization_for_credential(org_name)
    Organization.find_or_create_by!(name: org_name) do |org|
      org.slug = org_name.parameterize
    end
  end

  # Create/update unified MicrosoftCredential for app credentials
  # SSoT: MicrosoftCredential is THE ONE (legacy tables dropped Jan 2026)
  def dual_write_app_credential(old_credential)
    Rails.logger.info "[MicrosoftApp] DUAL-WRITE: Creating/updating MicrosoftCredential for #{old_credential.name}..."

    # SSoT: Ensure organization exists and link it
    organization = find_or_create_organization_for_credential(old_credential.name)

    mc = MicrosoftCredential.find_or_initialize_by(
      name: old_credential.name,
      credential_type: "app"
    )

    mc.update!(
      organization_id: organization.id,
      client_id: old_credential.client_id,
      client_secret: old_credential.client_secret,
      tenant_id: old_credential.tenant_id,
      status: old_credential.status,
      setup_by_id: old_credential.setup_by_id,
      is_active: old_credential.is_active
    )

    # Also update the legacy credential's organization_id
    old_credential.update_column(:organization_id, organization.id) if old_credential.organization_id.nil?

    Rails.logger.info "[MicrosoftApp] DUAL-WRITE: MicrosoftCredential created/updated: #{mc.id}, org: #{organization.name}"
    mc
  rescue StandardError => e
    # Don't fail the whole operation if dual-write fails
    Rails.logger.error "[MicrosoftApp] DUAL-WRITE failed (non-fatal): #{e.message}"
    nil
  end

  # DUAL-WRITE: Update MicrosoftCredential after admin consent
  def dual_write_app_credential_consent(old_credential, admin_email)
    Rails.logger.info "[MicrosoftApp] DUAL-WRITE: Updating MicrosoftCredential after admin consent..."

    mc = MicrosoftCredential.find_by(name: old_credential.name, credential_type: "app")
    return unless mc

    # Note: sharepoint_* columns removed from MicrosoftCredential in Phase 5
    # SSoT: SharePoint config now lives in StorageConfiguration
    mc.update!(
      access_token: old_credential.access_token,
      token_expires_at: old_credential.token_expires_at,
      status: "connected",
      admin_consent_granted_at: Time.current,
      admin_consent_granted_by: admin_email
    )

    Rails.logger.info "[MicrosoftApp] DUAL-WRITE: MicrosoftCredential marked connected: #{mc.id}"
    mc
  rescue StandardError => e
    Rails.logger.error "[MicrosoftApp] DUAL-WRITE consent failed (non-fatal): #{e.message}"
    nil
  end

  def admin_consent_url_for(credential)
    redirect_uri = "#{request.base_url}/api/v1/microsoft_app/admin_consent_callback"

    # Include credential_id in state for multi-org support
    state_data = {
      admin_id: current_user&.id,
      credential_id: credential.id,
      org_name: credential.name
    }
    state = Base64.urlsafe_encode64(state_data.to_json)

    # Use 'organizations' for multi-tenant apps - allows any Azure AD tenant to consent
    # The actual tenant_id will be captured from the callback response
    "https://login.microsoftonline.com/organizations/adminconsent?" + URI.encode_www_form({
      client_id: credential.client_id,
      redirect_uri: redirect_uri,
      state: state
    })
  end
end
