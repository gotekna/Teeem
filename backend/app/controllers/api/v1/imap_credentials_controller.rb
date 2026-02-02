class Api::V1::ImapCredentialsController < ApplicationController
  include PresignedUploadHandler

  before_action :set_credential, only: [:show, :update, :destroy, :sync, :sync_status, :toggle_sync_all, :reveal_password, :create_folder, :delete_folder, :move_email, :update_sharing]

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

  # GET /api/v1/imap_credentials/org_status
  # Returns TENANT-SCOPED email health status (for header indicator)
  # Shows breakdown by provider type for user clarity
  # FRC (Jan 2026): Header needs to show accounts' health for current TENANT only
  def org_status
    # SSoT (Jan 2026): Filter by current tenant for multi-tenancy isolation
    tenant = current_tenant

    # Get IMAP credentials for users in this tenant
    tenant_user_ids = tenant&.users&.pluck(:id) || []
    all_imap = ImapCredential.where(is_active: true, user_id: tenant_user_ids)

    # Count by status
    total_imap = all_imap.count
    connected_imap = all_imap.where(last_sync_status: 'success').where(last_sync_error: [nil, '']).count
    error_imap = all_imap.where.not(last_sync_error: [nil, '']).count
    syncing_imap = all_imap.where(last_sync_status: 'syncing').count

    # Get MS365 org credentials for THIS TENANT's organizations only
    tenant_org_ids = tenant&.organizations&.pluck(:id) || []
    ms365_credentials = MicrosoftCredential.app_credentials
                                            .where(organization_id: tenant_org_ids)
                                            .order(is_primary: :desc, name: :asc)
    total_ms365 = ms365_credentials.count
    connected_ms365 = ms365_credentials.where(status: 'connected').count

    # Build MS365 orgs list with status
    ms365_orgs = ms365_credentials.map do |cred|
      {
        name: cred.name,
        status: cred.status == 'connected' ? 'connected' : 'disconnected',
        is_primary: cred.is_primary
      }
    end

    # Calculate overall status
    total = total_imap + total_ms365
    connected = connected_imap + connected_ms365
    has_errors = error_imap > 0
    has_syncing = syncing_imap > 0

    # Determine overall status for header indicator
    overall_status = if total == 0
      'disconnected'
    elsif has_errors
      'error'
    elsif connected == total
      'connected'
    elsif has_syncing
      'degraded'
    else
      'degraded'
    end

    render json: {
      success: true,
      data: {
        total: total,
        connected: connected,
        errors: error_imap,
        syncing: syncing_imap,
        overall_status: overall_status,
        summary: "#{connected}/#{total} accounts connected",
        # Detailed breakdown for popover
        ms365_orgs: ms365_orgs,
        imap: {
          total: total_imap,
          connected: connected_imap,
          errors: error_imap,
          syncing: syncing_imap
        }
      }
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

    # Mark as syncing immediately so UI can show progress
    @credential.update!(last_sync_status: "syncing", last_sync_error: nil)

    ImapSyncJob.perform_later(@credential.id, full_sync: full_sync)

    render json: {
      success: true,
      message: "Sync started. New emails will appear shortly.",
      data: {
        id: @credential.id,
        sync_status: "syncing"
      }
    }
  end

  # GET /api/v1/imap_credentials/:id/sync_status
  # Get current sync status for polling
  def sync_status
    render json: {
      success: true,
      data: {
        id: @credential.id,
        sync_status: @credential.last_sync_status,
        sync_error: @credential.last_sync_error,
        last_synced_at: @credential.last_synced_at,
        email_count: SyncedEmailMailbox.where(imap_credential_id: @credential.id).count
      }
    }
  end

  # PUT /api/v1/imap_credentials/:id/toggle_sync_all
  # Toggle sync_all setting for an IMAP account (Jan 2026: sync all historical emails)
  def toggle_sync_all
    sync_all = ActiveModel::Type::Boolean.new.cast(params[:sync_all])

    @credential.update!(sync_all: sync_all)

    # If enabling sync_all, trigger a sync immediately
    if sync_all
      ImapSyncJob.perform_later(@credential.id, full_sync: true)
    end

    render json: {
      success: true,
      sync_all: sync_all,
      message: sync_all ?
        "Sync All enabled for #{@credential.display_name}. All historical emails will be synced." :
        "Sync All disabled for #{@credential.display_name}. Only recent emails will be synced."
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
      # FRC (Feb 2026): Changed from .connected to .refreshable_app for 24/7 availability
      org_cred = MicrosoftCredential.refreshable_app.find_by(id: org_cred_id)
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
              name: f[:name],  # Full path for filtering (e.g., "Inbox/Investments")
              display_name: f[:display_name] || f[:name],  # Display name for UI
              unread_count: f[:unread_count],
              total_items: f[:total_items],
              type: folder_type_from_name(f[:display_name] || f[:name]),  # Use display_name for type detection
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
      # SSoT: Use accessible_by to include both owned and shared credentials
      credential = ImapCredential.accessible_by(current_user).find_by(id: account_id)
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
  # List email accounts (IMAP + connected Microsoft 365) for CURRENT TENANT
  # SSoT: Uses same ordering as navigation (email_nav_positions)
  def all_accounts
    accounts = []
    # SSoT: Use same positions as navigation sidebar for consistent ordering
    saved_positions = current_user.email_nav_positions || {}
    fallback_position = 1000
    # SSoT: Get user's favorite mailbox IDs
    favorite_ids = EmailMailboxFavorite.favorited_account_ids(current_user.id)

    # SSoT (Jan 2026): Filter by current tenant for multi-tenancy isolation
    tenant_org_ids = current_tenant&.organizations&.pluck(:id) || []

    # Add connected Microsoft 365 organization accounts FOR THIS TENANT ONLY
    # These use Application permissions to access mailboxes
    # SSoT: Use MicrosoftCredential for app credentials
    # SSoT: Order by is_primary DESC so primary tenancy comes first
    ms365_credentials = MicrosoftCredential.app_credentials
                                            .connected
                                            .where(organization_id: tenant_org_ids)
                                            .order(is_primary: :desc, name: :asc)

    ms365_credentials.each do |org_cred|
      # SSoT: User automatically gets access to their own mailbox
      # Plus any additional mailboxes granted via user_mailbox_access config
      user_mailbox_access = org_cred.sync_config&.dig("user_mailbox_access") || {}
      configured_emails = user_mailbox_access[current_user.id.to_s] || []

      # SSoT: Auto-include user's own email if it matches the org credential's known domain
      # PERFORMANCE FIX: Don't call list_tenant_users (Graph API call was causing 30+ second delays)
      # Instead, use a simple domain check based on the credential's name/known domains
      auto_emails = []
      if current_user.email.present?
        user_domain = current_user.email.split("@").last&.downcase

        # Known domains per org name
        # TODO: Move to MicrosoftCredential.metadata[:email_domains] for SSoT
        # These are hardcoded because:
        # 1. Graph API call to get domains was too slow (30+ sec)
        # 2. Multiple tenants exist with different domains
        known_domains = {
          "Tekna" => TenantSetting.internal_email_domains,
          "100xBestLife" => ["100xbestlife.com"],
          "Homes of Hope" => ["homesofhope.org.au"],
          "Love Your World" => ["loveyourworld.org"]
        }

        # Get domains for this org
        org_domains = known_domains[org_cred.name] || []

        # Include user's email if their domain matches this tenant
        if org_domains.any? { |d| d.casecmp?(user_domain) }
          auto_emails = [current_user.email]
        end
      end

      # Combine auto + configured, remove duplicates
      user_emails = (auto_emails + configured_emails).uniq

      # Add each mailbox the user has access to
      user_emails.each_with_index do |email, index|
        account_id = "ms365_#{org_cred.id}_#{Digest::MD5.hexdigest(email)[0..7]}"
        # SSoT: Primary tenancy (is_primary flag) gets is_default for first mailbox
        is_primary_account = org_cred.is_primary && index == 0
        accounts << {
          id: account_id,
          type: "ms365",
          name: "#{org_cred.name}",
          email_address: email,
          provider: "microsoft365",
          is_active: org_cred.status == "connected",
          is_default: is_primary_account,
          org_credential_id: org_cred.id,
          credential_id: org_cred.id,
          position: saved_positions[account_id] || (fallback_position += 1),
          is_favorite: favorite_ids.include?(account_id),
          last_synced_at: org_cred.last_sync_at&.iso8601,
          last_sync_status: org_cred.status
        }
      end
    end

    # Add IMAP accounts (owned + shared)
    # SSoT: accessible_by returns owned OR shared_with_user_ids contains user
    ImapCredential.accessible_by(current_user).where(is_active: true).each do |cred|
      account_id = cred.id.to_s
      is_shared = cred.user_id != current_user.id
      accounts << {
        id: cred.id,
        type: "imap",
        name: cred.display_name,
        email_address: cred.email_address,
        provider: cred.provider,
        is_active: cred.is_active,
        is_default: false,
        is_shared: is_shared,
        owner_name: is_shared ? cred.user&.name : nil,
        email_signature: cred.email_signature,
        email_aliases: cred.email_aliases || [],
        position: saved_positions[account_id] || (fallback_position += 1),
        is_favorite: favorite_ids.include?(account_id),
        last_synced_at: cred.last_synced_at&.iso8601,
        last_sync_status: cred.last_sync_status
      }
    end

    # Add PolarisMail accounts (EmailMailbox)
    # These are mailboxes from email subscriptions managed by PolarisMail/EmailArray
    EmailMailbox.active.includes(:email_subscription).each do |mailbox|
      # Skip if subscription isn't active
      next unless mailbox.email_subscription&.status == "active"

      account_id = "polaris_#{mailbox.id}"
      accounts << {
        id: account_id,
        type: "polaris",
        name: mailbox.display_name.presence || mailbox.email_address.split("@").first,
        email_address: mailbox.email_address,
        provider: "polaris",
        is_active: true,
        is_default: false,
        email_mailbox_id: mailbox.id,
        position: saved_positions[account_id] || (fallback_position += 1),
        is_favorite: favorite_ids.include?(account_id)
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
    # SSoT: Use send_and_log to immediately store sent email in SyncedEmail
    # This ensures sent emails appear in Sent Items without waiting for sync
    result = EmailSendingService.send_and_log(
      account_type: account_type,
      credential_id: credential_id,
      user: current_user,
      to: parse_recipients(params[:to]),
      cc: parse_recipients(params[:cc]),
      bcc: parse_recipients(params[:bcc]),
      subject: params[:subject],
      body: params[:body],
      attachments: attachments,
      from_address: params[:from_address],
      reply_to_message_id: params[:reply_to_message_id],
      mailbox_email: params[:mailbox_email],
      sm_task_id: params[:sm_task_id]  # Optional: Link sent email to SM task
    )

    if result.success?
      render json: {
        success: true,
        message: "Email sent successfully",
        data: (result.data || {}).merge(message_id: result.message_id)
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
      to: parse_recipients(params[:to]),
      cc: parse_recipients(params[:cc]),
      bcc: parse_recipients(params[:bcc]),
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
  # SSoT (Jan 2026): Filter by current tenant for multi-tenancy isolation
  def shareable_users
    tenant_user_ids = current_tenant&.users&.pluck(:id) || []
    users = User.where(id: tenant_user_ids).order(:name).map do |user|
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
      email = SyncedEmail.find_by(imap_credential: @credential, uid: uid.to_i)
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

  # POST /api/v1/imap_credentials/save_folder_order
  # Save user's custom folder ordering for an email account
  # SSoT: Uses EmailFolderPreference model
  def save_folder_order
    account_id = params[:account_id]
    folder_ids = params[:folder_ids]

    if account_id.blank? || folder_ids.blank?
      return render json: {
        success: false,
        error: "account_id and folder_ids are required"
      }, status: :unprocessable_entity
    end

    EmailFolderPreference.save_order(current_user.id, account_id, folder_ids)

    render json: {
      success: true,
      message: "Folder order saved"
    }
  rescue => e
    render json: {
      success: false,
      error: "Failed to save folder order: #{e.message}"
    }, status: :unprocessable_entity
  end

  # GET /api/v1/imap_credentials/folder_order
  # Get user's custom folder ordering for an email account
  def folder_order
    account_id = params[:account_id]

    if account_id.blank?
      return render json: {
        success: false,
        error: "account_id is required"
      }, status: :unprocessable_entity
    end

    folder_ids = EmailFolderPreference.ordered_folder_ids(current_user.id, account_id)

    render json: {
      success: true,
      data: { folder_ids: folder_ids }
    }
  end

  # POST /api/v1/imap_credentials/toggle_mailbox_favorite
  # Toggle a mailbox as favorite/bookmarked
  # Only favorited mailboxes appear in sidebar by default
  def toggle_mailbox_favorite
    account_id = params[:account_id]

    if account_id.blank?
      return render json: {
        success: false,
        error: "account_id is required"
      }, status: :unprocessable_entity
    end

    is_favorite = EmailMailboxFavorite.toggle!(current_user.id, account_id)

    render json: {
      success: true,
      data: {
        account_id: account_id,
        is_favorite: is_favorite
      }
    }
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

  # Parse recipients from comma-separated string or array
  # Handles: "a@b.com, c@d.com" or ["a@b.com", "c@d.com"] or ["a@b.com, c@d.com"]
  def parse_recipients(value)
    return [] if value.blank?

    # Handle both array and string inputs
    values = value.is_a?(Array) ? value : [value]

    # Split each value by comma/semicolon, strip whitespace, remove blanks
    values.flat_map { |v| v.to_s.split(/[,;]/).map(&:strip) }.reject(&:blank?)
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

  # SSoT: Build attachments array from either uploaded files or storage keys
  def build_attachments_from_params
    attachments = []

    # Handle direct file uploads
    if params[:attachments].present?
      Array(params[:attachments]).each do |file|
        attachments << {
          filename: file.original_filename,
          content: file.read,
          content_type: file.content_type
        }
      end
    end

    # Handle attachment_data (new format with filenames - Ultra fix Jan 2026)
    # Format: [{ key: "storage/path", filename: "document.pdf", content_type: "application/pdf" }]
    if params[:attachment_data].present?
      att_data_array = Array(params[:attachment_data])
      Rails.logger.info "[SendEmail] Processing #{att_data_array.size} attachment_data items"

      att_data_array.each_with_index do |att_data, idx|
        # Support both string keys and symbol keys
        storage_key = att_data[:key] || att_data["key"]
        filename = att_data[:filename] || att_data["filename"]
        content_type = att_data[:content_type] || att_data["content_type"]

        if storage_key.blank?
          Rails.logger.warn "[SendEmail] Attachment #{idx + 1}/#{att_data_array.size} '#{filename}': No storage_key, skipping"
          next
        end

        Rails.logger.info "[SendEmail] Attachment #{idx + 1}/#{att_data_array.size} '#{filename}': Downloading from #{storage_key}"
        file = download_from_storage(storage_key)

        unless file
          Rails.logger.error "[SendEmail] Attachment #{idx + 1}/#{att_data_array.size} '#{filename}': FAILED to download from #{storage_key}"
          next
        end

        # FRC (Jan 2026): Read file content and ensure binary encoding to prevent PDF corruption
        file_content = file.read
        file_content = file_content.dup.force_encoding(Encoding::ASCII_8BIT) if file_content

        Rails.logger.info "[SendEmail] Attachment #{idx + 1}/#{att_data_array.size} '#{filename}': SUCCESS (#{file_content&.bytesize || 0} bytes, encoding: #{file_content&.encoding})"

        # Use provided filename (preserves original name), fallback to extracted filename
        attachments << {
          filename: filename.presence || file.original_filename,
          content: file_content,
          content_type: content_type.presence || file.content_type
        }
      end

      Rails.logger.info "[SendEmail] Processed #{attachments.size} of #{att_data_array.size} attachments successfully"
    end

    # Legacy: Handle storage keys (from presigned URL uploads) - for backwards compatibility
    if params[:attachment_storage_keys].present?
      Array(params[:attachment_storage_keys]).each do |storage_key|
        file = download_from_storage(storage_key)
        next unless file

        attachments << {
          filename: file.original_filename,
          content: file.read,
          content_type: file.content_type
        }
      end
    end

    attachments
  end

  def credential_params
    permitted = params.require(:imap_credential).permit(
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
      :email_signature,
      :email_aliases  # Accepts comma-separated string from frontend
    )

    # FRC (Jan 2026): Don't update password if blank - preserves existing password during edits
    # Frontend sends password: "" for security (doesn't prefill existing password)
    permitted.delete(:password) if permitted[:password].blank?

    # Convert comma-separated string to array for email_aliases
    if permitted[:email_aliases].is_a?(String)
      permitted[:email_aliases] = permitted[:email_aliases]
        .split(",")
        .map(&:strip)
        .reject(&:blank?)
    end

    permitted
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
      sync_all: credential.respond_to?(:sync_all) ? credential.sync_all : false,  # Jan 2026: Sync all historical emails
      last_synced_at: credential.last_synced_at,
      last_sync_status: credential.last_sync_status,
      last_sync_error: credential.last_sync_error,
      created_at: credential.created_at,
      email_signature: credential.email_signature,
      email_aliases: credential.email_aliases || [],  # Send-from aliases
      # Sharing fields
      user_id: credential.user_id,
      owner_name: credential.user&.name,
      is_shared: credential.user_id != current_user.id,
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
