class Api::V1::ImapCredentialsController < ApplicationController
  before_action :set_credential, only: [:show, :update, :destroy, :sync, :reveal_password, :create_folder, :delete_folder, :move_email, :update_sharing]

  # GET /api/v1/imap_credentials
  # List user's IMAP accounts (owned + shared)
  # SSoT: accessible_by returns owned OR shared_with_user_ids contains user
  def index
    credentials = ImapCredential.accessible_by(current_user).order(created_at: :desc)

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
  # SSoT: Email owner is the credential owner, creator gets full shared access
  def create
    email_address = params[:imap_credential][:email_address]
    email_owner = User.find_by(email: email_address)

    if email_owner
      # SSoT: Email owner becomes the credential owner
      credential = email_owner.imap_credentials.build(credential_params)

      # Creator (if different) gets full shared access
      if current_user.id != email_owner.id
        credential.shared_with_user_ids = [current_user.id]
      end
    else
      # No matching user in system - creator is owner (external email account)
      credential = current_user.imap_credentials.build(credential_params)
    end

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

  # GET /api/v1/imap_credentials/:id/reveal_password
  # Reveal the decrypted password (admin only)
  def reveal_password
    render json: {
      success: true,
      data: {
        password: @credential.password,
        username: @credential.username
      }
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

  # POST /api/v1/imap_credentials/sync_all
  # Manually trigger sync for ALL user's IMAP accounts
  def sync_all
    credentials = current_user.imap_credentials.where(is_active: true)

    credentials.each do |credential|
      ImapSyncJob.perform_later(credential.id, full_sync: false)
    end

    render json: {
      success: true,
      message: "Sync started for #{credentials.count} account(s). New emails will appear shortly.",
      accounts_synced: credentials.count
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

  # GET /api/v1/imap_credentials/folders
  # Get folders for a specific account (Outlook, MS365 org, or IMAP)
  def folders
    account_id = params[:account_id]
    mailbox_email = params[:mailbox_email]  # For ms365 accounts

    if account_id&.start_with?("ms365_")
      # Fetch folders from Microsoft 365 org using app credentials
      parts = account_id.split("_")
      org_cred_id = parts[1].to_i

      # SSoT: Use MicrosoftCredential
      org_cred = MicrosoftCredential.app_credentials.connected.find_by(id: org_cred_id)
      unless org_cred
        return render json: {
          success: false,
          error: "Microsoft 365 organization not found or not connected"
        }, status: :not_found
      end

      # Get mailbox email from params or extract from account_id
      unless mailbox_email.present?
        return render json: {
          success: false,
          error: "Mailbox email required for Microsoft 365 accounts"
        }, status: :unprocessable_entity
      end

      begin
        client = MicrosoftAppGraphClient.new(org_cred)
        folders = client.get_user_mail_folders(mailbox_email)

        render json: {
          success: true,
          data: folders.map { |f|
            {
              id: f[:id],
              name: f[:name],
              unread_count: f[:unread_count],
              total_items: f[:total_items],
              type: folder_type_from_name(f[:name]),
              depth: f[:depth] || 0,
              parent_id: f[:parent_id]
            }
          }
        }
      rescue => e
        render json: {
          success: false,
          error: "Failed to fetch folders: #{e.message}"
        }, status: :unprocessable_entity
      end
    else
      # Fetch IMAP folders
      credential = current_user.imap_credentials.find_by(id: account_id)
      unless credential
        return render json: {
          success: false,
          error: "Account not found"
        }, status: :not_found
      end

      service = ImapEmailService.new(credential)
      folder_names = service.list_folders

      render json: {
        success: true,
        data: folder_names.map { |name|
          {
            id: name,
            name: folder_display_name(name),
            type: folder_type_from_name(name)
          }
        }
      }
    end
  rescue => e
    render json: {
      success: false,
      error: "Failed to fetch folders: #{e.message}"
    }, status: :unprocessable_entity
  end

  # GET /api/v1/imap_credentials/all_accounts
  # List ALL email accounts (IMAP + connected Microsoft 365 tenants)
  # SSoT: Uses same ordering as navigation (email_nav_positions)
  def all_accounts
    accounts = []
    # SSoT: Use same positions as navigation sidebar for consistent ordering
    saved_positions = current_user.email_nav_positions || {}
    fallback_position = 1000

    # Add connected Microsoft 365 organization accounts
    # These use Application permissions to access mailboxes
    # SSoT: Use MicrosoftCredential for app credentials
    MicrosoftCredential.app_credentials.connected.each do |org_cred|
      # SSoT: User automatically gets access to their own mailbox
      # Plus any additional mailboxes granted via user_mailbox_access config
      user_mailbox_access = org_cred.sync_config&.dig("user_mailbox_access") || {}
      configured_emails = user_mailbox_access[current_user.id.to_s] || []

      # SSoT: Auto-include user's own email ONLY if it exists in this tenant
      tenant_emails = org_cred.list_tenant_users.map { |u| u[:email]&.downcase }.compact
      auto_emails = if current_user.email.present? && tenant_emails.include?(current_user.email.downcase)
        [current_user.email]
      else
        []
      end

      # Combine auto + configured, remove duplicates
      user_emails = (auto_emails + configured_emails).uniq

      # Add each mailbox the user has access to
      user_emails.each_with_index do |email, index|
        account_id = "ms365_#{org_cred.id}_#{Digest::MD5.hexdigest(email)[0..7]}"
        accounts << {
          id: account_id,
          type: "ms365",
          name: "#{org_cred.name}",
          email_address: email,
          provider: "microsoft365",
          is_active: org_cred.status == "connected",
          is_default: index == 0 && accounts.empty?,
          org_credential_id: org_cred.id,
          position: saved_positions[account_id] || (fallback_position += 1)
        }
      end
    end

    # Add IMAP accounts (owned + shared)
    # SSoT: accessible_by returns owned OR shared_with_user_ids contains user
    ImapCredential.accessible_by(current_user).where(is_active: true).each do |cred|
      account_id = cred.id.to_s
      accounts << {
        id: cred.id,
        type: "imap",
        name: cred.display_name,
        email_address: cred.email_address,
        provider: cred.provider,
        is_active: cred.is_active,
        is_default: false,
        email_signature: cred.email_signature,
        email_aliases: cred.email_aliases || [],
        position: saved_positions[account_id] || (fallback_position += 1)
      }
    end

    # Sort by position to match navigation sidebar order
    accounts.sort_by! { |a| a[:position] }

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
  # Send an email via IMAP credential, Outlook, or MS365
  # SSoT: Uses EmailSendingService for all email sending
  def send_email
    # Determine account type from credential_id
    credential_id = params[:credential_id]
    account_type = infer_account_type(credential_id)

    # Handle attachments from uploaded files
    attachments = build_attachments_from_params

    # Use unified EmailSendingService (SSoT)
    result = EmailSendingService.send(
      account_type: account_type,
      credential_id: credential_id,
      user: current_user,
      to: Array(params[:to]),
      cc: Array(params[:cc]),
      bcc: Array(params[:bcc]),
      subject: params[:subject],
      body: params[:body],
      attachments: attachments,
      from_address: params[:from_address],
      reply_to_message_id: params[:reply_to_message_id],
      mailbox_email: params[:mailbox_email]
    )

    if result.success?
      render json: {
        success: true,
        message: "Email sent successfully",
        data: result.data.merge(message_id: result.message_id)
      }
    else
      render json: {
        success: false,
        error: result.error || "Failed to send email"
      }, status: :unprocessable_entity
    end
  rescue => e
    render json: {
      success: false,
      error: "Failed to send email: #{e.message}"
    }, status: :unprocessable_entity
  end

  # POST /api/v1/imap_credentials/schedule_email
  # Schedule an email to be sent at a future time
  # SSoT: Uses EmailSendingService for scheduling
  def schedule_email
    credential_id = params[:credential_id]
    account_type = infer_account_type(credential_id)

    # Use unified EmailSendingService (SSoT)
    result = EmailSendingService.schedule(
      account_type: account_type,
      credential_id: credential_id,
      user: current_user,
      to: Array(params[:to]),
      cc: Array(params[:cc]),
      bcc: Array(params[:bcc]),
      subject: params[:subject],
      body: params[:body],
      from_address: params[:from_address],
      reply_to_message_id: params[:reply_to_message_id],
      mailbox_email: params[:mailbox_email],
      scheduled_for: params[:scheduled_for]
    )

    if result.success?
      render json: {
        success: true,
        message: "Email scheduled successfully",
        data: result.data
      }
    else
      render json: {
        success: false,
        error: result.error || "Failed to schedule email"
      }, status: :unprocessable_entity
    end
  rescue => e
    render json: {
      success: false,
      error: "Failed to schedule email: #{e.message}"
    }, status: :unprocessable_entity
  end

  # GET /api/v1/imap_credentials/scheduled_emails
  # List scheduled emails for the current user
  def scheduled_emails
    emails = ScheduledEmail.for_user(current_user)
                           .order(scheduled_for: :asc)

    # Optional status filter
    if params[:status].present?
      emails = emails.where(status: params[:status])
    end

    render json: {
      success: true,
      data: emails.map do |email|
        {
          id: email.id,
          to: email.to_list,
          subject: email.subject,
          scheduled_for: email.scheduled_for,
          status: email.status,
          created_at: email.created_at,
          sent_at: email.sent_at,
          error_message: email.error_message
        }
      end
    }
  end

  # POST /api/v1/imap_credentials/:id/create_folder
  # Create a new folder on the IMAP server
  def create_folder
    folder_name = params[:folder_name]

    unless folder_name.present?
      return render json: {
        success: false,
        error: "Folder name is required"
      }, status: :unprocessable_entity
    end

    service = ImapEmailService.new(@credential)

    if service.create_folder(folder_name)
      render json: {
        success: true,
        message: "Folder '#{folder_name}' created successfully"
      }
    else
      render json: {
        success: false,
        error: "Failed to create folder. It may already exist."
      }, status: :unprocessable_entity
    end
  rescue => e
    render json: {
      success: false,
      error: "Failed to create folder: #{e.message}"
    }, status: :unprocessable_entity
  end

  # DELETE /api/v1/imap_credentials/:id/delete_folder
  # Delete a folder on the IMAP server
  def delete_folder
    folder_name = params[:folder_name]

    unless folder_name.present?
      return render json: {
        success: false,
        error: "Folder name is required"
      }, status: :unprocessable_entity
    end

    # Prevent deletion of standard folders
    protected_folders = %w[INBOX Sent Drafts Trash Junk Spam Archive]
    if protected_folders.any? { |f| folder_name.downcase.include?(f.downcase) }
      return render json: {
        success: false,
        error: "Cannot delete protected system folder"
      }, status: :unprocessable_entity
    end

    service = ImapEmailService.new(@credential)

    if service.delete_folder(folder_name)
      render json: {
        success: true,
        message: "Folder '#{folder_name}' deleted successfully"
      }
    else
      render json: {
        success: false,
        error: "Failed to delete folder"
      }, status: :unprocessable_entity
    end
  rescue => e
    render json: {
      success: false,
      error: "Failed to delete folder: #{e.message}"
    }, status: :unprocessable_entity
  end

  # PUT /api/v1/imap_credentials/:id/update_sharing
  # Update which users have access to this credential's emails
  def update_sharing
    shared_user_ids = params[:shared_with_user_ids] || []

    # Validate all IDs are valid user IDs
    valid_users = User.where(id: shared_user_ids).pluck(:id)

    # Don't include the owner in shared list
    valid_users.delete(@credential.user_id)

    @credential.update!(shared_with_user_ids: valid_users)

    render json: {
      success: true,
      data: credential_json(@credential),
      message: "Sharing updated successfully"
    }
  rescue => e
    render json: {
      success: false,
      error: "Failed to update sharing: #{e.message}"
    }, status: :unprocessable_entity
  end

  # GET /api/v1/imap_credentials/shareable_users
  # List users who can be granted access to email credentials
  def shareable_users
    users = User.order(:name).map do |user|
      {
        id: user.id,
        name: user.name,
        email: user.email
      }
    end

    render json: {
      success: true,
      data: users
    }
  end

  # POST /api/v1/imap_credentials/:id/move_email
  # Move an email to a different folder
  def move_email
    uid = params[:uid]
    destination_folder = params[:destination_folder]
    source_folder = params[:source_folder] || "INBOX"

    unless uid.present? && destination_folder.present?
      return render json: {
        success: false,
        error: "UID and destination folder are required"
      }, status: :unprocessable_entity
    end

    service = ImapEmailService.new(@credential)

    if service.move_email(uid.to_i, destination_folder, source_folder: source_folder)
      # Update local record if it exists
      email = EmailWarehouse.find_by(imap_credential: @credential, uid: uid.to_i)
      email&.update!(folder_name: destination_folder)

      render json: {
        success: true,
        message: "Email moved to '#{destination_folder}'"
      }
    else
      render json: {
        success: false,
        error: "Failed to move email"
      }, status: :unprocessable_entity
    end
  rescue => e
    render json: {
      success: false,
      error: "Failed to move email: #{e.message}"
    }, status: :unprocessable_entity
  end

  private

  # DEPRECATED: Per-user Outlook credentials have been removed
  # Email sending via personal Outlook is no longer supported
  # Use IMAP or MS365 org credentials instead
  def send_via_outlook
    render json: {
      success: false,
      error: "Personal Outlook sending has been deprecated. Please use IMAP or MS365 organization account."
    }, status: :gone
  end

  def set_credential
    # SSoT: Both owner and shared users have full access
    @credential = ImapCredential.accessible_by(current_user).find(params[:id])
  end

  # Infer account type from credential_id format
  def infer_account_type(credential_id)
    case credential_id.to_s
    when /^ms365_/
      "ms365"
    else
      "imap"
    end
  end

  # Build attachments array from uploaded files
  def build_attachments_from_params
    return [] unless params[:attachments].present?

    params[:attachments].map do |file|
      {
        filename: file.original_filename,
        content: file.read,
        content_type: file.content_type
      }
    end
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
      :is_active,
      :email_signature
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
      created_at: credential.created_at,
      email_signature: credential.email_signature,
      # Sharing fields
      user_id: credential.user_id,
      shared_with_user_ids: credential.shared_with_user_ids || [],
      shared_with_users: User.where(id: credential.shared_with_user_ids || []).map { |u| { id: u.id, name: u.name } }
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

  # Map folder name to standardized type for UI icons
  def folder_type_from_name(name)
    normalized = name.to_s.downcase
    case normalized
    when /inbox/
      "inbox"
    when /sent|sent items|sent mail/
      "sent"
    when /draft/
      "drafts"
    when /trash|deleted|deleted items/
      "trash"
    when /archive/
      "archive"
    when /junk|spam/
      "junk"
    when /important|starred/
      "important"
    else
      "folder"
    end
  end

  # Clean up IMAP folder names for display
  def folder_display_name(name)
    # Remove IMAP prefixes like [Gmail]/, INBOX., etc.
    clean_name = name.to_s
      .gsub(/^\[Gmail\]\//, "")
      .gsub(/^INBOX\./, "")
      .gsub(/^INBOX\//, "")

    # Capitalize nicely
    clean_name.split(/[\s_-]/).map(&:capitalize).join(" ")
  end
end
