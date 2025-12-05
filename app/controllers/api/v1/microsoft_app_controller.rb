class Api::V1::MicrosoftAppController < ApplicationController
  # Controller for organization-wide Microsoft app permissions (Client Credentials flow)
  # This uses Application permissions, not Delegated permissions
  # Once set up, can access ANY user's mailbox without individual OAuth

  skip_before_action :authorize_request, only: [:admin_consent_callback]

  # Required Application permissions in Azure AD:
  # - Mail.Read (Application) - Read all users' mail
  # - Mail.ReadWrite (Application) - Read/write all users' mail (if sending needed)
  # - User.Read.All (Application) - List users in tenant
  APPLICATION_PERMISSIONS = [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/User.Read.All'
  ].freeze

  # GET /api/v1/microsoft_app/status
  # Check the org-wide Microsoft app credential status
  def status
    # Check if env vars are configured
    env_configured = ENV['OUTLOOK_CLIENT_ID'].present? &&
                     ENV['OUTLOOK_CLIENT_SECRET'].present? &&
                     ENV['OUTLOOK_TENANT_ID'].present?

    credential = OrganizationMicrosoftAppCredential.active_credential

    if credential.nil?
      render json: {
        configured: false,
        status: 'not_configured',
        message: 'Organization-wide Microsoft access not configured',
        env_configured: env_configured,
        tenant_id: ENV['OUTLOOK_TENANT_ID']
      }
    else
      render json: {
        configured: true,
        status: credential.status,
        tenant_id: credential.tenant_id,
        admin_consent_granted_at: credential.admin_consent_granted_at,
        admin_consent_granted_by: credential.admin_consent_granted_by,
        last_sync_at: credential.last_sync_at,
        last_error: credential.last_error,
        token_valid: !credential.token_expired?,
        env_configured: env_configured
      }
    end
  end

  # POST /api/v1/microsoft_app/setup
  # Initial setup - uses existing OUTLOOK_* env vars OR manual input
  def setup
    unless current_user_admin?
      return render json: { error: 'Only admins can configure organization-wide Microsoft access' }, status: :forbidden
    end

    # Use env vars if available, otherwise use params
    client_id = params[:client_id].presence || ENV['OUTLOOK_CLIENT_ID']
    client_secret = params[:client_secret].presence || ENV['OUTLOOK_CLIENT_SECRET']
    tenant_id = params[:tenant_id].presence || ENV['OUTLOOK_TENANT_ID']

    if client_id.blank? || client_secret.blank? || tenant_id.blank?
      return render json: {
        error: 'Missing credentials. Either set OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_TENANT_ID env vars or provide them manually.'
      }, status: :unprocessable_entity
    end

    # Deactivate any existing credential
    OrganizationMicrosoftAppCredential.active.update_all(is_active: false)

    credential = OrganizationMicrosoftAppCredential.new(
      client_id: client_id,
      client_secret: client_secret,
      tenant_id: tenant_id,
      setup_by: current_user,
      status: 'pending'
    )

    if credential.save
      render json: {
        success: true,
        message: 'App credentials saved. Now grant admin consent to activate.',
        admin_consent_url: admin_consent_url_for(credential),
        using_env_vars: params[:client_id].blank?
      }
    else
      render json: { error: credential.errors.full_messages.join(', ') }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/microsoft_app/setup_from_env
  # Quick setup using existing env vars - no manual input needed
  def setup_from_env
    unless current_user_admin?
      return render json: { error: 'Only admins can configure organization-wide Microsoft access' }, status: :forbidden
    end

    client_id = ENV['OUTLOOK_CLIENT_ID']
    client_secret = ENV['OUTLOOK_CLIENT_SECRET']
    tenant_id = ENV['OUTLOOK_TENANT_ID']

    if client_id.blank? || client_secret.blank? || tenant_id.blank?
      return render json: {
        error: 'Environment variables not configured. Please set OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, and OUTLOOK_TENANT_ID.'
      }, status: :unprocessable_entity
    end

    # Deactivate any existing credential
    OrganizationMicrosoftAppCredential.active.update_all(is_active: false)

    credential = OrganizationMicrosoftAppCredential.create!(
      client_id: client_id,
      client_secret: client_secret,
      tenant_id: tenant_id,
      setup_by: current_user,
      status: 'pending'
    )

    render json: {
      success: true,
      message: 'Using existing Microsoft credentials. Now grant admin consent to enable organization-wide access.',
      admin_consent_url: admin_consent_url_for(credential),
      tenant_id: tenant_id
    }
  end

  # GET /api/v1/microsoft_app/admin_consent_url
  # Get URL for Azure AD admin to grant organization-wide consent
  def admin_consent_url
    unless current_user_admin?
      return render json: { error: 'Only admins can request organization-wide consent' }, status: :forbidden
    end

    credential = OrganizationMicrosoftAppCredential.active_credential
    unless credential
      return render json: { error: 'Please set up app credentials first' }, status: :unprocessable_entity
    end

    render json: {
      admin_consent_url: admin_consent_url_for(credential),
      message: 'Click this URL to grant organization-wide consent. You must be an Azure AD admin.'
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

    frontend_url = ENV['FRONTEND_URL'] || 'http://localhost:3000'

    if error.present?
      Rails.logger.error "[MicrosoftApp] Admin consent error: #{error} - #{error_description}"
      return redirect_to "#{frontend_url}/settings/integrations/microsoft?app_consent_error=#{CGI.escape(error_description || error)}", allow_other_host: true
    end

    if admin_consent == 'True'
      # Find and update the credential
      credential = OrganizationMicrosoftAppCredential.active_credential

      if credential
        # Test the connection and fetch initial token
        if credential.test_connection!
          # Get admin email from state if available
          admin_email = nil
          if state.present?
            begin
              state_data = JSON.parse(Base64.urlsafe_decode64(state))
              admin_user = User.find_by(id: state_data['admin_id'])
              admin_email = admin_user&.email
            rescue => e
              Rails.logger.warn "[MicrosoftApp] Could not decode state: #{e.message}"
            end
          end

          credential.mark_admin_consent!(admin_email || 'unknown')
          Rails.logger.info "[MicrosoftApp] Admin consent granted and connection verified for tenant #{tenant}"

          redirect_to "#{frontend_url}/settings/integrations/microsoft?app_consent_success=true", allow_other_host: true
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
  # Test the connection
  def test
    unless current_user_admin?
      return render json: { error: 'Only admins can test organization-wide Microsoft access' }, status: :forbidden
    end

    credential = OrganizationMicrosoftAppCredential.active_credential
    unless credential
      return render json: { error: 'No app credential configured' }, status: :not_found
    end

    if credential.test_connection!
      render json: {
        success: true,
        message: 'Connection successful! Can access organization mailboxes.',
        status: credential.status
      }
    else
      render json: {
        success: false,
        error: credential.last_error,
        status: credential.status
      }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/microsoft_app/users
  # List all users in the tenant that can be synced
  def users
    unless current_user_admin?
      return render json: { error: 'Only admins can view organization users' }, status: :forbidden
    end

    credential = OrganizationMicrosoftAppCredential.active_credential
    unless credential&.status == 'connected'
      return render json: { error: 'Organization Microsoft access not connected' }, status: :not_found
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
      return render json: { error: 'Only admins can configure sync settings' }, status: :forbidden
    end

    credential = OrganizationMicrosoftAppCredential.active_credential
    unless credential
      return render json: { error: 'No app credential configured' }, status: :not_found
    end

    # Update sync configuration
    # sync_all: true - sync all users
    # user_emails: ['user1@org.com', 'user2@org.com'] - sync specific users
    sync_config = {
      sync_all: params[:sync_all] || false,
      user_emails: params[:user_emails] || [],
      folders: params[:folders] || ['inbox', 'sentitems'],
      sync_years: params[:sync_years] || 3
    }

    credential.update!(sync_config: sync_config)

    render json: {
      success: true,
      message: 'Sync configuration updated',
      sync_config: credential.sync_config
    }
  end

  # DELETE /api/v1/microsoft_app/disconnect
  # Remove the organization-wide Microsoft access
  def disconnect
    unless current_user_admin?
      return render json: { error: 'Only admins can disconnect organization-wide Microsoft access' }, status: :forbidden
    end

    credential = OrganizationMicrosoftAppCredential.active_credential
    credential&.deactivate!

    render json: {
      success: true,
      message: 'Organization-wide Microsoft access has been disconnected'
    }
  end

  private

  def current_user_admin?
    current_user&.role == 'admin' || current_user&.permissions&.include?('admin')
  end

  def admin_consent_url_for(credential)
    redirect_uri = "#{request.base_url}/api/v1/microsoft_app/admin_consent_callback"

    state_data = { admin_id: current_user&.id }
    state = Base64.urlsafe_encode64(state_data.to_json)

    "https://login.microsoftonline.com/#{credential.tenant_id}/adminconsent?" + URI.encode_www_form({
      client_id: credential.client_id,
      redirect_uri: redirect_uri,
      state: state
    })
  end
end