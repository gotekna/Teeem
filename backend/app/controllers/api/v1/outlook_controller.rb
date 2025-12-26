class Api::V1::OutlookController < ApplicationController
  # Skip authentication for OAuth callback - Microsoft redirects here without auth token
  skip_before_action :authorize_request, only: [ :callback ]

  # GET /api/v1/outlook/auth_url
  # Get the OAuth authorization URL for connecting the current user's Outlook
  def auth_url
    client_id = ENV["OUTLOOK_CLIENT_ID"]
    redirect_uri = "#{request.base_url}/api/v1/outlook/callback"
    tenant = ENV["OUTLOOK_TENANT_ID"] || "common"

    if client_id.blank?
      render json: { error: "Outlook OAuth not configured. Please set OUTLOOK_CLIENT_ID environment variable." }, status: :unprocessable_entity
      return
    end

    # Scopes needed for reading and sending mail
    scopes = [
      "https://graph.microsoft.com/Mail.Read",
      "https://graph.microsoft.com/Mail.Send",
      "https://graph.microsoft.com/MailboxSettings.Read",
      "offline_access"
    ].join(" ")

    # Encode user_id in state parameter so we know who to associate on callback
    state_data = { user_id: current_user.id, nonce: SecureRandom.hex(8) }
    state = Base64.urlsafe_encode64(state_data.to_json)

    auth_url = "https://login.microsoftonline.com/#{tenant}/oauth2/v2.0/authorize?" + URI.encode_www_form({
      client_id: client_id,
      response_type: "code",
      redirect_uri: redirect_uri,
      response_mode: "query",
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
      return render_popup_close_page(success: false, error: "No authorization code received")
    end

    # Decode state to get user_id
    user_id = nil
    if state.present?
      begin
        state_data = JSON.parse(Base64.urlsafe_decode64(state))
        user_id = state_data["user_id"]
      rescue => e
        Rails.logger.error "Failed to decode OAuth state: #{e.message}"
      end
    end

    unless user_id
      return render_popup_close_page(success: false, error: "Invalid OAuth state - please try again")
    end

    user = User.find_by(id: user_id)
    unless user
      return render_popup_close_page(success: false, error: "User not found - please try again")
    end

    # Exchange code for tokens
    client_id = ENV["OUTLOOK_CLIENT_ID"]
    client_secret = ENV["OUTLOOK_CLIENT_SECRET"]
    redirect_uri = "#{request.base_url}/api/v1/outlook/callback"
    tenant = ENV["OUTLOOK_TENANT_ID"] || "common"

    response = HTTP.post("https://login.microsoftonline.com/#{tenant}/oauth2/v2.0/token",
      form: {
        client_id: client_id,
        client_secret: client_secret,
        code: code,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code",
        scope: "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/MailboxSettings.Read offline_access"
      }
    )

    if response.status.success?
      data = response.parse

      # Get user info to store email
      user_response = HTTP.auth("Bearer #{data['access_token']}").get("https://graph.microsoft.com/v1.0/me")
      outlook_email = user_response.parse["mail"] || user_response.parse["userPrincipalName"]

      # Create or update the user's credential
      credential = user.outlook_credential || user.build_outlook_credential
      credential.update!(
        access_token: data["access_token"],
        refresh_token: data["refresh_token"],
        expires_at: Time.current + data["expires_in"].to_i.seconds,
        email: outlook_email,
        tenant_id: tenant
      )

      Rails.logger.info "Outlook connected successfully for user #{user.id} (#{outlook_email})"
      render_popup_close_page(success: true, email: outlook_email)
    else
      error_message = response.parse["error_description"] || response.parse["error"] || "Failed to exchange code for token"
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
      message: credential.present? ? "Outlook is connected" : "Outlook not connected"
    }
  end

  # DELETE /api/v1/outlook/disconnect
  # Disconnect current user's Outlook
  def disconnect
    credential = current_user.outlook_credential
    if credential
      credential.destroy
      render json: { success: true, message: "Outlook disconnected successfully" }
    else
      render json: { error: "Outlook not connected" }, status: :not_found
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
      folder: params[:folder] || "inbox"
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
      folder: params[:folder] || "inbox"
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

  # GET /api/v1/outlook/job_search_suggestions/:job_id
  # Get search suggestions based on job data (title, location, client emails)
  def job_search_suggestions
    job = Job.find(params[:job_id])

    suggestions = []

    # Add job title (usually address)
    if job.title.present?
      suggestions << { type: "address", value: job.title, label: "Address: #{job.title}" }

      # Extract street name from title (e.g., "32 Mcilwraith Street" -> "Mcilwraith")
      street_match = job.title.match(/\d+\s+(.+?)\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Crescent|Cres|Boulevard|Blvd)/i)
      if street_match
        street_name = street_match[1]
        suggestions << { type: "street", value: street_name, label: "Street: #{street_name}" }
      end
    end

    # Add location
    if job.location.present? && job.location != job.title
      suggestions << { type: "location", value: job.location, label: "Location: #{job.location}" }
    end

    # Add client/contact emails
    job.contacts.each do |contact|
      if contact.email.present?
        suggestions << { type: "email", value: contact.email, label: "Contact: #{contact.display_name || contact.email}" }
      end
    end

    # Add site supervisor email
    if job.site_supervisor_email.present?
      suggestions << { type: "email", value: job.site_supervisor_email, label: "Site Supervisor: #{job.site_supervisor_name}" }
    end

    render json: {
      job_id: job.id,
      job_title: job.title,
      suggestions: suggestions.uniq { |s| s[:value] }
    }
  rescue => e
    Rails.logger.error "Failed to get job search suggestions: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST /api/v1/outlook/search_for_job
  # Search Outlook emails for a job with preview (without importing)
  def search_for_job
    job = Job.find(params[:job_id])
    outlook = OutlookService.new(current_user)

    # Use provided search or build from job details
    search_query = params[:search].presence

    options = {
      search: search_query,
      top: params[:top] || 50,
      folder: params[:folder] || "inbox"
    }

    emails_data = outlook.search_emails(options)

    # Mark which emails are already imported (using EmailWarehouse as SSoT)
    existing_message_ids = EmailWarehouse.where(internet_message_id: emails_data.map { |e| e[:message_id] }).pluck(:internet_message_id)

    emails_with_status = emails_data.map do |email|
      email.merge(
        already_imported: existing_message_ids.include?(email[:message_id]),
        preview_body: email[:body_text]&.truncate(200)
      )
    end

    render json: {
      job_id: job.id,
      emails: emails_with_status,
      count: emails_with_status.length,
      new_count: emails_with_status.count { |e| !e[:already_imported] }
    }
  rescue OutlookService::NotConnectedError => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue => e
    Rails.logger.error "Failed to search Outlook for job: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST /api/v1/outlook/import_for_job
  # Import emails for a specific job from current user's Outlook
  def import_for_job
    job = Job.find(params[:job_id])
    outlook = OutlookService.new(current_user)

    # Use provided search or build default from job details
    search_query = params[:search].presence
    if search_query.blank?
      search_terms = []
      search_terms << job.title if job.title.present?
      search_query = search_terms.first # Use just the title/address
    end

    options = {
      search: search_query,
      top: params[:top] || 50,
      folder: params[:folder] || "inbox"
    }

    # If specific message IDs provided, only import those
    message_ids_to_import = params[:message_ids]

    emails_data = outlook.search_emails(options)
    imported_count = 0
    skipped_count = 0

    emails_data.each do |email_data|
      # If specific IDs requested, skip emails not in the list
      if message_ids_to_import.present?
        next unless message_ids_to_import.include?(email_data[:message_id])
      end

      # Check if email already exists (using EmailWarehouse as SSoT)
      if EmailWarehouse.exists?(internet_message_id: email_data[:message_id])
        skipped_count += 1
        next
      end

      # Create EmailWarehouse record
      email = EmailWarehouse.new(
        internet_message_id: email_data[:message_id],
        source_type: "outlook",
        from_email: email_data[:from_email],
        from_name: email_data[:from_email]&.split("@")&.first,
        to_emails: email_data[:to_emails] || [],
        cc_emails: email_data[:cc_emails] || [],
        subject: email_data[:subject],
        body_text: email_data[:body_text] || email_data[:text_body],
        body_html: email_data[:body_html] || email_data[:html_body],
        received_at: email_data[:received_at] || email_data[:date],
        has_attachments: email_data[:has_attachments] || false,
        conversation_id: email_data[:conversation_id],
        outlook_id: email_data[:outlook_id],
        folder_name: params[:folder] || "inbox",
        synced_by_user: current_user,
        first_synced_at: Time.current,
        last_synced_at: Time.current,
        job_id: job.id  # Force assignment to this job
      )

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
      skipped_count: skipped_count,
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
