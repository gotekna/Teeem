class Api::V1::OutlookController < ApplicationController
  # Skip authentication for OAuth callback - Microsoft redirects here without auth token
  skip_before_action :authorize_request, only: [:callback]

  # GET /api/v1/outlook/auth_url
  # Get the OAuth authorization URL for connecting Outlook
  def auth_url
    client_id = ENV['OUTLOOK_CLIENT_ID']
    redirect_uri = "#{request.base_url}/api/v1/outlook/callback"
    tenant = ENV['OUTLOOK_TENANT_ID'] || 'common'

    if client_id.blank?
      render json: { error: 'Outlook OAuth not configured. Please set OUTLOOK_CLIENT_ID environment variable.' }, status: :unprocessable_entity
      return
    end

    # Scopes needed for reading mail
    scopes = [
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/MailboxSettings.Read',
      'offline_access'
    ].join(' ')

    auth_url = "https://login.microsoftonline.com/#{tenant}/oauth2/v2.0/authorize?" + URI.encode_www_form({
      client_id: client_id,
      response_type: 'code',
      redirect_uri: redirect_uri,
      response_mode: 'query',
      scope: scopes,
      state: SecureRandom.hex(16)
    })

    render json: { auth_url: auth_url }
  end

  # GET /api/v1/outlook/callback
  # OAuth callback endpoint
  def callback
    code = params[:code]
    error = params[:error]
    error_description = params[:error_description]

    if error.present?
      Rails.logger.error "Outlook OAuth error: #{error} - #{error_description}"
      redirect_to "#{ENV['FRONTEND_URL']}/settings?outlook_error=#{ERB::Util.url_encode(error_description || error)}"
      return
    end

    if code.blank?
      redirect_to "#{ENV['FRONTEND_URL']}/settings?outlook_error=No authorization code received"
      return
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
        scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/MailboxSettings.Read offline_access'
      }
    )

    if response.status.success?
      data = response.parse

      # Get user info to store email
      user_response = HTTP.auth("Bearer #{data['access_token']}").get('https://graph.microsoft.com/v1.0/me')
      user_email = user_response.parse['mail'] || user_response.parse['userPrincipalName']

      # Create or update the organization credential
      credential = OrganizationOutlookCredential.first_or_initialize
      credential.update!(
        access_token: data['access_token'],
        refresh_token: data['refresh_token'],
        expires_at: Time.current + data['expires_in'].to_i.seconds,
        email: user_email,
        tenant_id: tenant
      )

      Rails.logger.info "Outlook connected successfully for #{user_email}"
      redirect_to "#{ENV['FRONTEND_URL']}/settings?outlook_success=true"
    else
      error_message = response.parse['error_description'] || response.parse['error'] || 'Failed to exchange code for token'
      Rails.logger.error "Failed to get Outlook token: #{response.status} - #{error_message}"
      redirect_to "#{ENV['FRONTEND_URL']}/settings?outlook_error=#{ERB::Util.url_encode(error_message)}"
    end
  rescue => e
    Rails.logger.error "Error in Outlook callback: #{e.message}"
    redirect_to "#{ENV['FRONTEND_URL']}/settings?outlook_error=#{ERB::Util.url_encode(e.message)}"
  end

  # GET /api/v1/outlook/status
  # Check if Outlook is configured
  def status
    credential = OrganizationOutlookCredential.current
    render json: {
      configured: credential.present?,
      email: credential&.email,
      expires_at: credential&.expires_at,
      expired: credential&.expired?,
      message: credential.present? ? 'Outlook is configured' : 'Outlook not connected'
    }
  end

  # DELETE /api/v1/outlook/disconnect
  # Disconnect Outlook
  def disconnect
    credential = OrganizationOutlookCredential.current
    if credential
      credential.destroy
      render json: { success: true, message: 'Outlook disconnected successfully' }
    else
      render json: { error: 'Outlook not connected' }, status: :not_found
    end
  end

  # GET /api/v1/outlook/folders
  # List available mail folders
  def folders
    outlook = OutlookService.new
    folders = outlook.list_folders

    render json: { folders: folders }
  rescue => e
    Rails.logger.error "Failed to list Outlook folders: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST /api/v1/outlook/search
  # Search Outlook emails without importing
  def search
    outlook = OutlookService.new

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
  rescue => e
    Rails.logger.error "Failed to search Outlook: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST /api/v1/outlook/import
  # Import emails from Outlook into the system
  def import
    outlook = OutlookService.new

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
  rescue => e
    Rails.logger.error "Failed to import from Outlook: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST /api/v1/outlook/import_for_job
  # Import emails for a specific construction job
  def import_for_job
    construction = Job.find(params[:job_id])
    outlook = OutlookService.new

    # Build search query based on job details
    search_terms = []
    search_terms << construction.title if construction.title.present?
    search_terms << construction.id.to_s

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

      # Force assignment to this construction
      email.construction = construction

      if email.save
        imported_count += 1
        Rails.logger.info "Imported email for job #{construction.id}: #{email.subject}"
      else
        Rails.logger.error "Failed to import email: #{email.errors.full_messages.join(', ')}"
      end
    end

    render json: {
      success: true,
      imported_count: imported_count,
      construction_id: construction.id,
      message: "Successfully imported #{imported_count} emails for #{construction.title}"
    }
  rescue => e
    Rails.logger.error "Failed to import emails for job: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

end
