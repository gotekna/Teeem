class Api::V1::ImapCredentialsController < ApplicationController
  before_action :set_credential, only: [:show, :update, :destroy, :sync, :test_connection]

  # GET /api/v1/imap_credentials
  # List user's IMAP accounts
  def index
    credentials = current_user.imap_credentials.order(created_at: :desc)

    render json: {
      success: true,
      data: credentials.map { |c| credential_json(c) }
    }
  end

  # GET /api/v1/imap_credentials/:id
  def show
    render json: {
      success: true,
      data: credential_json(@credential, include_folders: true)
    }
  end

  # POST /api/v1/imap_credentials
  # Add a new IMAP account
  def create
    credential = current_user.imap_credentials.build(credential_params)

    # Apply provider preset if specified
    credential.apply_provider_preset! if credential.provider.present?

    # Test connection before saving
    test_result = credential.test_connection
    unless test_result[:success]
      return render json: {
        success: false,
        error: "Connection failed: #{test_result[:error]}"
      }, status: :unprocessable_entity
    end

    if credential.save
      # Trigger initial sync
      ImapSyncJob.perform_later(credential.id, full_sync: true)

      render json: {
        success: true,
        data: credential_json(credential),
        message: "Email account connected successfully. Initial sync started."
      }, status: :created
    else
      render json: {
        success: false,
        error: credential.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/imap_credentials/:id
  def update
    if @credential.update(credential_params)
      render json: {
        success: true,
        data: credential_json(@credential)
      }
    else
      render json: {
        success: false,
        error: @credential.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/imap_credentials/:id
  def destroy
    @credential.destroy!

    render json: {
      success: true,
      message: "Email account disconnected"
    }
  end

  # POST /api/v1/imap_credentials/:id/sync
  # Manually trigger sync for an account
  def sync
    full_sync = params[:full_sync] == "true"

    ImapSyncJob.perform_later(@credential.id, full_sync: full_sync)

    render json: {
      success: true,
      message: "Sync started. New emails will appear shortly."
    }
  end

  # POST /api/v1/imap_credentials/test
  # Test connection without saving
  def test
    credential = ImapCredential.new(credential_params)
    credential.user = current_user

    # Apply provider preset if specified
    credential.apply_provider_preset! if credential.provider.present?

    result = credential.test_connection

    render json: {
      success: result[:success],
      data: result,
      error: result[:error]
    }
  end

  # GET /api/v1/imap_credentials/all_accounts
  # List ALL email accounts (IMAP + connected Outlook)
  def all_accounts
    accounts = []

    # Add connected Outlook account if exists
    if current_user.outlook_credential.present?
      outlook = current_user.outlook_credential
      accounts << {
        id: "outlook",
        type: "outlook",
        name: "Outlook (Microsoft 365)",
        email_address: outlook.email,
        provider: "outlook",
        is_active: !outlook.expired?,
        is_default: true
      }
    end

    # Add IMAP accounts
    current_user.imap_credentials.where(is_active: true).order(created_at: :desc).each do |cred|
      accounts << {
        id: cred.id,
        type: "imap",
        name: cred.display_name,
        email_address: cred.email_address,
        provider: cred.provider,
        is_active: cred.is_active,
        is_default: false
      }
    end

    render json: {
      success: true,
      data: accounts
    }
  end

  # GET /api/v1/imap_credentials/providers
  # List available provider presets
  def providers
    providers = ImapCredential::PROVIDER_PRESETS.map do |key, settings|
      {
        id: key,
        name: key.titleize,
        settings: settings
      }
    end

    # Add custom option
    providers << {
      id: "custom",
      name: "Custom / Other",
      settings: nil
    }

    render json: {
      success: true,
      data: providers
    }
  end

  # POST /api/v1/imap_credentials/send_email
  # Send an email via IMAP credential or Outlook
  def send_email
    # Handle Outlook send
    if params[:credential_id] == "outlook"
      return send_via_outlook
    end

    credential = current_user.imap_credentials.find(params[:credential_id])

    service = ImapEmailService.new(credential)

    # Handle attachments from uploaded files
    attachments = []
    if params[:attachments].present?
      params[:attachments].each do |file|
        attachments << {
          filename: file.original_filename,
          content: file.read,
          content_type: file.content_type
        }
      end
    end

    mail = service.send_email(
      to: Array(params[:to]),
      subject: params[:subject],
      body: params[:body],
      cc: Array(params[:cc]),
      bcc: Array(params[:bcc]),
      attachments: attachments,
      reply_to_message_id: params[:reply_to_message_id]
    )

    render json: {
      success: true,
      message: "Email sent successfully",
      data: {
        message_id: mail.message_id,
        to: mail.to,
        subject: mail.subject
      }
    }
  rescue => e
    render json: {
      success: false,
      error: "Failed to send email: #{e.message}"
    }, status: :unprocessable_entity
  end

  private

  def send_via_outlook
    unless current_user.outlook_credential&.valid_credential?
      return render json: {
        success: false,
        error: "Outlook not connected or token expired"
      }, status: :unprocessable_entity
    end

    outlook = OutlookService.new(current_user)

    # Build attachments array
    attachments = []
    if params[:attachments].present?
      params[:attachments].each do |file|
        attachments << {
          name: file.original_filename,
          content: Base64.strict_encode64(file.read),
          content_type: file.content_type
        }
      end
    end

    result = outlook.send_email(
      to: Array(params[:to]),
      subject: params[:subject],
      body: params[:body],
      cc: Array(params[:cc]),
      bcc: Array(params[:bcc]),
      attachments: attachments
    )

    if result[:success]
      render json: {
        success: true,
        message: "Email sent successfully via Outlook",
        data: { message_id: result[:message_id] }
      }
    else
      render json: {
        success: false,
        error: result[:error] || "Failed to send email via Outlook"
      }, status: :unprocessable_entity
    end
  end

  def set_credential
    @credential = current_user.imap_credentials.find(params[:id])
  end

  def credential_params
    params.require(:imap_credential).permit(
      :name,
      :email_address,
      :provider,
      :imap_host,
      :imap_port,
      :imap_ssl,
      :smtp_host,
      :smtp_port,
      :smtp_auth,
      :username,
      :password,
      :sync_interval_minutes,
      :is_active
    )
  end

  def credential_json(credential, include_folders: false)
    json = {
      id: credential.id,
      name: credential.display_name,
      email_address: credential.email_address,
      provider: credential.provider,
      imap_host: credential.imap_host,
      imap_port: credential.imap_port,
      smtp_host: credential.smtp_host,
      smtp_port: credential.smtp_port,
      sync_interval_minutes: credential.sync_interval_minutes,
      is_active: credential.is_active,
      last_synced_at: credential.last_synced_at,
      last_sync_status: credential.last_sync_status,
      last_sync_error: credential.last_sync_error,
      created_at: credential.created_at
    }

    if include_folders
      begin
        service = ImapEmailService.new(credential)
        json[:folders] = service.list_folders
      rescue
        json[:folders] = []
      end
    end

    json
  end
end
