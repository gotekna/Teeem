class Api::V1::EmailWarehouseController < ApplicationController
  before_action :set_email, only: [ :show, :assign_to_job, :unassign, :mark_as_spam, :delete_from_outlook, :move_to_folder, :summarize, :link_contact, :unlink_contact, :quick_create_contact ]
  before_action :require_admin, only: [ :bulk_delete_spam ]

  # GET /api/v1/email_warehouse
  # List emails from warehouse with filtering
  def index
    emails = EmailWarehouse.all

    # Filter to only current user's emails (my_emails mode)
    # Skip this filter if microsoft_credential_id is provided (we'll filter by that instead)
    if params[:my_emails] == "true" && params[:microsoft_credential_id].blank?
      # SSoT: Use accessible_by scope which includes owned AND shared credentials
      user_imap_ids = ImapCredential.accessible_by(current_user).pluck(:id)

      # Get MS365 org credentials the user has mailbox access to
      ms365_cred_ids = []
      ms365_mailbox_emails = []
      # SSoT: Use MicrosoftCredential
      MicrosoftCredential.app_credentials.connected.each do |org_cred|
        user_mailboxes = org_cred.sync_config&.dig("user_mailbox_access", current_user.id.to_s) || []
        if user_mailboxes.any?
          ms365_cred_ids << org_cred.id
          ms365_mailbox_emails.concat(user_mailboxes)
        end
      end

      conditions = []
      bind_values = []

      # IMAP accounts
      if user_imap_ids.any?
        conditions << "(source_type = 'imap' AND imap_credential_id IN (?))"
        bind_values << user_imap_ids
      end

      # MS365 org mailboxes - filter by credential AND mailbox email
      if ms365_cred_ids.any?
        conditions << "(microsoft_credential_id IN (?) AND mailbox_owner_email IN (?))"
        bind_values << ms365_cred_ids
        bind_values << ms365_mailbox_emails
      end

      if conditions.any?
        emails = emails.where(conditions.join(" OR "), *bind_values)
      else
        # No accounts connected - return empty
        emails = emails.none
      end
    end

    # Filter by job
    if params[:job_id].present?
      emails = emails.for_job(params[:job_id])
    end

    # Filter by unassigned only
    if params[:unassigned] == "true"
      emails = emails.unassigned
    end

    # Filter to show only latest in thread (hide conversation history)
    if params[:latest_only] != "false"
      emails = emails.latest_in_thread
    end

    # Full-text search
    if params[:search].present?
      emails = emails.search_text(params[:search])
    end

    # Filter by email address involvement
    if params[:email].present?
      emails = emails.involving_email(params[:email])
    end

    # Date range filters
    if params[:since].present?
      emails = emails.received_after(params[:since].to_datetime)
    end
    if params[:until].present?
      emails = emails.received_before(params[:until].to_datetime)
    end

    # Search operators - specific field filters
    # from: - filter by sender email address
    if params[:from].present?
      emails = emails.where("LOWER(from_email) LIKE ?", "%#{params[:from].downcase}%")
    end

    # to: - filter by recipient email addresses
    if params[:to].present?
      to_lower = params[:to].downcase
      emails = emails.where("EXISTS (SELECT 1 FROM unnest(to_emails) AS e WHERE LOWER(e) LIKE ?)", "%#{to_lower}%")
    end

    # subject: - filter by subject line
    if params[:subject].present?
      emails = emails.where("subject ILIKE ?", "%#{params[:subject]}%")
    end

    # has:attachment - filter emails with attachments
    if params[:has_attachments] == "true"
      emails = emails.where(has_attachments: true)
    end

    # is:unread - filter unread emails (based on email's is_read flag)
    if params[:unread] == "true"
      emails = emails.where(is_read: false)
    end

    # is:starred - filter starred emails (requires join to user state)
    if params[:starred] == "true"
      emails = emails.joins(:email_user_states)
                     .where(email_user_states: { user_id: current_user.id, is_starred: true })
    end

    # Filter by source type (outlook, imap)
    if params[:source_type].present?
      emails = emails.where(source_type: params[:source_type])
    end

    # Filter by IMAP credential
    if params[:imap_credential_id].present?
      emails = emails.where(imap_credential_id: params[:imap_credential_id])
    end

    # Filter by folder name or ID (e.g., "Sent Items", "Inbox", etc.)
    # SSoT: Use in_folder scope for case-insensitive matching (Gmail=INBOX, Outlook=Inbox, etc.)
    if params[:folder_id].present?
      emails = emails.in_folder(params[:folder_id])
    end
    if params[:folder_name].present?
      emails = emails.in_folder(params[:folder_name])
    end

    # Filter by direction (sent, received, cc, bcc)
    # Note: direction column may not exist yet (pending migration)
    if params[:direction].present? && EmailWarehouse.column_names.include?("direction")
      emails = emails.where(direction: params[:direction])
    end

    # Filter by importance (high, normal, low)
    if params[:importance].present?
      emails = emails.where(importance: params[:importance])
    end

    # Filter by Microsoft 365 credential (org-level app credentials)
    # Also validates user has access to this credential's mailboxes
    if params[:microsoft_credential_id].present?
      # SSoT: Use MicrosoftCredential
      org_cred = MicrosoftCredential.find_by(id: params[:microsoft_credential_id])
      if org_cred
        # Get the mailboxes this user is authorized to access
        user_mailboxes = org_cred.sync_config&.dig("user_mailbox_access", current_user.id.to_s) || []
        if user_mailboxes.any?
          emails = emails.where(microsoft_credential_id: params[:microsoft_credential_id])
          # If specific mailbox requested, filter to that (if user has access)
          if params[:mailbox].present? && user_mailboxes.map(&:downcase).include?(params[:mailbox].downcase)
            emails = emails.where(mailbox_owner_email: params[:mailbox])
          else
            emails = emails.where(mailbox_owner_email: user_mailboxes)
          end
        else
          # User has no access to this credential's mailboxes
          emails = emails.none
        end
      else
        emails = emails.none
      end
    end

    # ========================================
    # Split Inbox Mode
    # ========================================
    if params[:split_inbox] == "true"
      return render_split_inbox(emails)
    end

    # Pagination
    page = (params[:page] || 1).to_i
    per_page = [ (params[:per_page] || 50).to_i, 200 ].min
    total = emails.count

    # Performance: Eager load job association and paginate
    emails = emails.includes(:job).recent_first.offset((page - 1) * per_page).limit(per_page)

    # Performance: Batch load all contacts and user states for this page to avoid N+1
    all_contact_ids = emails.flat_map { |e| [e.primary_contact_id, *(e.contact_ids || [])] }.compact.uniq
    contacts_cache = Contact.where(id: all_contact_ids).index_by(&:id)
    all_email_ids = emails.map(&:id)
    user_states_cache = EmailUserState.where(email_warehouse_id: all_email_ids, user_id: current_user.id).index_by(&:email_warehouse_id)

    render json: {
      emails: emails.map { |e| email_json(e, contacts_cache: contacts_cache, user_states_cache: user_states_cache) },
      pagination: {
        page: page,
        per_page: per_page,
        total: total,
        total_pages: (total.to_f / per_page).ceil
      }
    }
  end

  # GET /api/v1/email_warehouse/:id
  # Performance: Batch load all related data for email + thread to avoid N+1
  def show
    # Get conversation thread with eager loading (1 query)
    thread_emails = if @email.conversation_id.present?
      EmailWarehouse.where(conversation_id: @email.conversation_id)
                    .includes(:job)
                    .order(received_at: :asc)
                    .to_a
    else
      [ @email ]
    end

    # Batch load all user states for thread (1 query)
    email_ids = thread_emails.map(&:id)
    user_states_cache = EmailUserState.where(email_warehouse_id: email_ids, user_id: current_user.id)
                                      .index_by(&:email_warehouse_id)

    # Batch load all contacts for thread (1 query)
    all_contact_ids = thread_emails.flat_map { |e| [e.primary_contact_id, *(e.contact_ids || [])] }.compact.uniq
    contacts_cache = Contact.where(id: all_contact_ids).index_by(&:id)

    render json: email_json(
      @email,
      include_body: true,
      include_thread: true,
      thread_emails: thread_emails,
      contacts_cache: contacts_cache,
      user_states_cache: user_states_cache
    )
  end

  # GET /api/v1/email_warehouse/for_job/:job_id
  # Get emails for a specific job with conversation threading
  def for_job
    job = Job.find(params[:job_id])

    # Get emails assigned to this job
    emails = EmailWarehouse.for_job(job.id)

    # Show only latest in thread by default
    if params[:show_all_in_thread] != "true"
      emails = emails.latest_in_thread
    end

    # Performance: Eager load, batch contacts, and batch thread counts
    emails = emails.includes(:job).recent_first.to_a  # Materialize for caching
    all_contact_ids = emails.flat_map { |e| [e.primary_contact_id, *(e.contact_ids || [])] }.compact.uniq
    contacts_cache = Contact.where(id: all_contact_ids).index_by(&:id)

    # Performance: Batch thread count queries (N+1 → 1 query)
    conversation_ids = emails.map(&:conversation_id).compact.uniq
    thread_counts_cache = EmailWarehouse.where(conversation_id: conversation_ids)
                                        .group(:conversation_id)
                                        .count

    # Also get suggested matches (unassigned emails that might match)
    suggested = []
    if params[:include_suggestions] == "true"
      suggested = find_suggested_emails_for_job(job)
    end

    render json: {
      job_id: job.id,
      emails: emails.map { |e| email_json(e, include_thread_count: true, contacts_cache: contacts_cache, thread_counts_cache: thread_counts_cache) },
      count: emails.count,
      suggested: suggested.map { |s| suggestion_json(s) }
    }
  end

  # GET /api/v1/email_warehouse/unassigned
  # Get unassigned emails for review
  def unassigned
    emails = EmailWarehouse.unassigned.latest_in_thread.recent_first

    # Optional search
    if params[:search].present?
      emails = emails.search_text(params[:search])
    end

    # Pagination
    page = (params[:page] || 1).to_i
    per_page = [ (params[:per_page] || 50).to_i, 200 ].min
    total = emails.count

    # Performance: Eager load and batch contacts
    emails = emails.includes(:job).offset((page - 1) * per_page).limit(per_page)
    all_contact_ids = emails.flat_map { |e| [e.primary_contact_id, *(e.contact_ids || [])] }.compact.uniq
    contacts_cache = Contact.where(id: all_contact_ids).index_by(&:id)

    render json: {
      emails: emails.map { |e| email_json(e, include_suggestions: true, contacts_cache: contacts_cache) },
      pagination: {
        page: page,
        per_page: per_page,
        total: total,
        total_pages: (total.to_f / per_page).ceil
      }
    }
  end

  # POST /api/v1/email_warehouse/:id/assign_to_job
  def assign_to_job
    job = Job.find(params[:job_id])

    @email.assign_to_job!(job, by_user: current_user)

    # Also assign all emails in the same conversation
    if params[:assign_thread] == "true" && @email.conversation_id.present?
      @email.conversation_thread.each do |thread_email|
        thread_email.assign_to_job!(job, by_user: current_user) if thread_email.job_id.nil?
      end
    end

    render json: {
      success: true,
      message: "Email assigned to #{job.title}",
      email: email_json(@email)
    }
  end

  # POST /api/v1/email_warehouse/:id/unassign
  def unassign
    @email.update!(job_id: nil, match_type: nil, match_confidence: nil, matched_at: nil)

    render json: {
      success: true,
      message: "Email unassigned from job",
      email: email_json(@email)
    }
  end

  # POST /api/v1/email_warehouse/:id/dismiss_suggestion
  # Dismiss this email from showing as a suggestion for a specific job
  def dismiss_suggestion
    job_id = params[:job_id].to_i
    return render json: { error: "job_id required" }, status: :bad_request if job_id.zero?

    # Add job_id to dismissed list if not already there
    dismissed_ids = @email.dismissed_from_job_ids || []
    unless dismissed_ids.include?(job_id)
      @email.update!(dismissed_from_job_ids: dismissed_ids + [job_id])
    end

    render json: {
      success: true,
      message: "Email dismissed from suggestions"
    }
  end

  # GET /api/v1/email_warehouse/sync_status
  # Get sync status - org-wide sync runs automatically every 15 minutes
  def sync_status
    # SSoT: Use MicrosoftCredential
    org_cred = MicrosoftCredential.app_credentials.find_by(name: "Tekna")

    render json: {
      status: "automatic",
      message: "Email sync runs automatically every 15 minutes via org-wide sync",
      last_sync_at: org_cred&.last_sync_at,
      sync_interval: "15 minutes"
    }
  end

  # GET /api/v1/email_warehouse/search
  # Search warehouse emails
  def search
    return render json: { error: "Search query required" }, status: :bad_request if params[:q].blank?

    # Performance: Eager load and batch contacts
    emails = EmailWarehouse.search_text(params[:q]).includes(:job).latest_in_thread.recent_first.limit(100)
    all_contact_ids = emails.flat_map { |e| [e.primary_contact_id, *(e.contact_ids || [])] }.compact.uniq
    contacts_cache = Contact.where(id: all_contact_ids).index_by(&:id)

    render json: {
      query: params[:q],
      emails: emails.map { |e| email_json(e, contacts_cache: contacts_cache) },
      count: emails.count
    }
  end

  # GET /api/v1/email_warehouse/stats
  # Get warehouse statistics
  def stats
    render json: {
      total_emails: EmailWarehouse.count,
      assigned_emails: EmailWarehouse.assigned.count,
      unassigned_emails: EmailWarehouse.unassigned.count,
      conversations: EmailWarehouse.distinct.count(:conversation_id),
      oldest_email: EmailWarehouse.minimum(:received_at),
      newest_email: EmailWarehouse.maximum(:received_at),
      jobs_with_emails: EmailWarehouse.assigned.distinct.count(:job_id),
      spam_emails: EmailWarehouse.spam.count,
      with_ai_summary: EmailWarehouse.with_ai_summary.count
    }
  end

  # GET /api/v1/email_warehouse/unread_counts
  # Get unread email counts for the sidebar badge
  def unread_counts
    begin
      # Get emails user has access to (same logic as index my_emails)
      emails = EmailWarehouse.all
      # SSoT: Use accessible_by scope which includes owned AND shared credentials
      user_imap_credentials = ImapCredential.accessible_by(current_user)
      user_imap_ids = user_imap_credentials.pluck(:id)

      # Build list of all email accounts user has access to
      all_accounts = []

      # IMAP accounts (owned + shared)
      user_imap_credentials.each do |cred|
        all_accounts << cred.email_address if cred.email_address.present?
      end

      # Get MS365 org credentials the user has mailbox access to
      ms365_cred_ids = []
      ms365_mailbox_emails = []
      MicrosoftCredential.app_credentials.connected.each do |org_cred|
        user_mailboxes = org_cred.sync_config&.dig("user_mailbox_access", current_user.id.to_s) || []
        if user_mailboxes.any?
          ms365_cred_ids << org_cred.id
          ms365_mailbox_emails.concat(user_mailboxes)
          all_accounts.concat(user_mailboxes)
        end
      end

      conditions = []
      bind_values = []

      # IMAP accounts
      if user_imap_ids.any?
        conditions << "(source_type = 'imap' AND imap_credential_id IN (?))"
        bind_values << user_imap_ids
      end

      # MS365 org mailboxes
      if ms365_cred_ids.any?
        conditions << "(microsoft_credential_id IN (?) AND mailbox_owner_email IN (?))"
        bind_values << ms365_cred_ids
        bind_values << ms365_mailbox_emails
      end

      if conditions.any?
        emails = emails.where(conditions.join(" OR "), *bind_values)
      else
        # No accounts connected
        return render json: { total: 0, by_account: [] }
      end

      # Filter to unread only
      unread_emails = emails.where(is_read: false)

      # Get counts by mailbox/account
      unread_by_account = unread_emails.group(:mailbox_owner_email).count

      # Build result including all accounts (even with 0 unread)
      by_account = all_accounts.uniq.map do |email|
        { email: email, count: unread_by_account[email] || 0 }
      end.sort_by { |a| [ -a[:count], a[:email] ] }

      render json: {
        total: unread_emails.count,
        by_account: by_account
      }
    rescue StandardError => e
      # Graceful fallback - sidebar badge should not crash the page
      Rails.logger.error "[EmailWarehouse#unread_counts] Error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
      render json: { total: 0, by_account: [] }
    end
  end

  # GET /api/v1/email_warehouse/spam
  # List all spam emails
  def spam
    emails = EmailWarehouse.spam.recent_first

    # Pagination
    page = (params[:page] || 1).to_i
    per_page = [ (params[:per_page] || 50).to_i, 200 ].min
    total = emails.count

    # Performance: Eager load and batch contacts
    emails = emails.includes(:job).offset((page - 1) * per_page).limit(per_page)
    all_contact_ids = emails.flat_map { |e| [e.primary_contact_id, *(e.contact_ids || [])] }.compact.uniq
    contacts_cache = Contact.where(id: all_contact_ids).index_by(&:id)

    render json: {
      emails: emails.map { |e| email_json(e, contacts_cache: contacts_cache) },
      pagination: {
        page: page,
        per_page: per_page,
        total: total,
        total_pages: (total.to_f / per_page).ceil
      }
    }
  end

  # POST /api/v1/email_warehouse/:id/mark_as_spam
  # Mark a single email as spam
  def mark_as_spam
    delete_from_outlook = params[:delete_from_outlook] == "true"

    # SSoT: Use MicrosoftCredential for email operations (per-user Outlook removed)
    if delete_from_outlook && @email.microsoft_credential_id.present? && @email.outlook_id.present?
      org_cred = MicrosoftCredential.find_by(id: @email.microsoft_credential_id)
      if org_cred&.connected?
        graph_client = MicrosoftAppGraphClient.for_org(org_cred.organization)
        graph_client.delete_user_email(@email.mailbox_owner_email, @email.outlook_id)
        @email.mark_as_spam!(delete_from_outlook: true)
      else
        @email.mark_as_spam!(delete_from_outlook: false)
      end
    else
      @email.mark_as_spam!(delete_from_outlook: false)
    end

    render json: {
      success: true,
      message: delete_from_outlook ? "Email marked as spam and deleted from Outlook" : "Email marked as spam",
      email: email_json(@email)
    }
  end

  # DELETE /api/v1/email_warehouse/:id/delete_from_outlook
  # Delete a single email from Outlook (without marking as spam)
  # SSoT: Uses org credentials (per-user Outlook removed)
  def delete_from_outlook
    unless @email.outlook_id.present?
      return render json: { error: "Email has no Outlook ID" }, status: :unprocessable_entity
    end

    # SSoT: Use MicrosoftCredential for email operations
    org_cred = MicrosoftCredential.find_by(id: @email.microsoft_credential_id)
    unless org_cred&.connected?
      return render json: { error: "Organization MS365 not connected" }, status: :unprocessable_entity
    end

    graph_client = MicrosoftAppGraphClient.for_org(org_cred.organization)
    result = graph_client.delete_user_email(@email.mailbox_owner_email, @email.outlook_id)

    if result
      # Mark as deleted in our database
      @email.update!(
        email_classification: (@email.email_classification || {}).merge("deleted_from_outlook" => true, "deleted_at" => Time.current.iso8601)
      )

      render json: {
        success: true,
        message: "Email deleted from Outlook",
        email_id: @email.id
      }
    else
      render json: { error: "Failed to delete email from Outlook" }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/email_warehouse/:id/move_to_folder
  # Move email to a different folder (Outlook/MS365)
  # SSoT: Uses org credentials (per-user Outlook removed)
  def move_to_folder
    folder_id = params[:folder_id]
    folder_name = params[:folder_name]

    unless folder_id.present? || folder_name.present?
      return render json: { error: "folder_id or folder_name required" }, status: :unprocessable_entity
    end

    # SSoT: Use MicrosoftCredential for MS365 emails
    if @email.microsoft_credential_id.present? && @email.outlook_id.present?
      org_cred = MicrosoftCredential.find_by(id: @email.microsoft_credential_id)
      unless org_cred&.connected?
        return render json: { error: "MS365 organization not connected" }, status: :unprocessable_entity
      end

      graph_client = MicrosoftAppGraphClient.for_org(org_cred.organization)
      result = graph_client.move_user_email(@email.mailbox_owner_email, @email.outlook_id, folder_id)

      if result
        @email.update!(folder_name: folder_name || folder_id)
        render json: {
          success: true,
          message: "Email moved to #{folder_name || folder_id}",
          email: email_json(@email)
        }
      else
        render json: { error: "Failed to move email" }, status: :unprocessable_entity
      end
    else
      # IMAP - Use imap_credentials controller instead
      render json: { error: "Use /api/v1/imap_credentials/:id/move_email for IMAP emails" }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/email_warehouse/:id/summarize
  # Generate AI summary for an email
  def summarize
    # Return existing summary if available and not forcing refresh
    if @email.ai_summary.present? && params[:refresh] != "true"
      return render json: {
        success: true,
        data: {
          summary: @email.ai_summary,
          action_items: @email.action_items || [],
          entities: @email.extracted_entities || {},
          cached: true
        }
      }
    end

    begin
      service = EmailSummaryService.new(@email)
      result = service.summarize!

      render json: {
        success: true,
        data: {
          summary: result[:summary],
          action_items: result[:action_items] || [],
          entities: result[:entities] || {},
          sentiment: result[:sentiment],
          category: result[:category],
          cached: false
        }
      }
    rescue EmailSummaryService::AIError => e
      render json: {
        success: false,
        error: e.message
      }, status: :unprocessable_entity
    rescue StandardError => e
      Rails.logger.error "[EmailSummarize] Error: #{e.message}"
      render json: {
        success: false,
        error: "Failed to generate summary"
      }, status: :internal_server_error
    end
  end

  # POST /api/v1/email_warehouse/:id/link_contact
  # Link a contact to an email
  def link_contact
    contact = Contact.find(params[:contact_id])

    # Add contact to contact_ids array if not already present
    current_ids = @email.contact_ids || []
    unless current_ids.include?(contact.id)
      current_ids << contact.id
    end

    # Set as primary if requested or if no primary exists
    set_primary = params[:set_primary] == "true" || @email.primary_contact_id.nil?

    @email.update!(
      contact_ids: current_ids,
      primary_contact_id: set_primary ? contact.id : @email.primary_contact_id,
      contacts_matched_at: Time.current
    )

    render json: {
      success: true,
      message: "Contact linked to email",
      email: email_json(@email)
    }
  rescue ActiveRecord::RecordNotFound
    render json: { success: false, error: "Contact not found" }, status: :not_found
  end

  # POST /api/v1/email_warehouse/:id/unlink_contact
  # Unlink a contact from an email
  def unlink_contact
    contact_id = params[:contact_id].to_i

    current_ids = @email.contact_ids || []
    current_ids.delete(contact_id)

    # Clear primary if we're unlinking the primary contact
    new_primary = @email.primary_contact_id == contact_id ? current_ids.first : @email.primary_contact_id

    @email.update!(
      contact_ids: current_ids,
      primary_contact_id: new_primary
    )

    render json: {
      success: true,
      message: "Contact unlinked from email",
      email: email_json(@email)
    }
  end

  # POST /api/v1/email_warehouse/:id/quick_create_contact
  # Creates a contact from the email sender and links it to the email
  # Reuses EmailToContactExtractionService for company suggestion and creation
  def quick_create_contact
    # Check if contact already exists with this email (emails stored in ContactEmail model)
    contact_email = ContactEmail.find_by(email: @email.from_email&.downcase)
    if contact_email
      existing = contact_email.contact
      # Just link it if not already linked
      current_ids = @email.contact_ids || []
      unless current_ids.include?(existing.id)
        current_ids << existing.id
      end
      @email.update!(
        contact_ids: current_ids,
        primary_contact_id: @email.primary_contact_id || existing.id,
        contacts_matched_at: Time.current
      )

      return render json: {
        success: true,
        contact: existing.as_json(only: [ :id, :display_name ]).merge(email: contact_email.email),
        message: "Contact already exists, linked to email",
        already_existed: true
      }
    end

    # Use existing service for company suggestion and creation
    service = EmailToContactExtractionService.new(user: current_user)

    # Build selection for bulk_create
    selection = {
      email: @email.from_email,
      display_name: @email.from_name.presence || @email.from_email.split("@").first.titleize,
      entity_type: "person"
    }

    # Get company suggestion from domain
    company_suggestion = service.suggest_company_for_email(@email.from_email)
    if company_suggestion && company_suggestion[:existing_company_id]
      selection[:company_action] = "link"
      selection[:company_id] = company_suggestion[:existing_company_id]
    elsif company_suggestion && company_suggestion[:name]
      selection[:company_action] = "create"
      selection[:company_name] = company_suggestion[:name]
    end

    result = service.bulk_create([ selection ])

    if result[:success] && result[:created_contacts].present?
      contact = result[:created_contacts].first
      contact_record = Contact.find(contact[:id])

      # Link to email
      current_ids = @email.contact_ids || []
      current_ids << contact_record.id unless current_ids.include?(contact_record.id)
      @email.update!(
        contact_ids: current_ids,
        primary_contact_id: @email.primary_contact_id || contact_record.id,
        contacts_matched_at: Time.current
      )

      render json: {
        success: true,
        contact: contact,
        company: result[:created_companies]&.first,
        message: "Contact created and linked"
      }
    else
      render json: {
        success: false,
        error: result[:errors]&.first || "Failed to create contact"
      }, status: :unprocessable_entity
    end
  rescue StandardError => e
    Rails.logger.error("quick_create_contact error: #{e.message}")
    Rails.logger.error(e.backtrace.join("\n"))
    render json: {
      success: false,
      error: e.message
    }, status: :internal_server_error
  end

  # GET /api/v1/email_warehouse/:id/suggest_contacts
  # Get contact suggestions for linking based on email addresses
  def suggest_contacts
    email = EmailWarehouse.find(params[:id])

    # Extract all email addresses from the email
    email_addresses = [ email.from_email ]
    email_addresses.concat(email.to_emails || [])
    email_addresses.concat(email.cc_emails || [])
    email_addresses = email_addresses.compact.uniq.map(&:downcase)

    # Find contacts matching these email addresses
    suggestions = Contact.where("LOWER(email) IN (?)", email_addresses)
                         .or(Contact.where("LOWER(secondary_email) IN (?)", email_addresses))
                         .limit(10)

    # Also check AI-extracted entities if available
    if email.extracted_entities.present?
      entities = email.extracted_entities.with_indifferent_access
      if entities[:contacts].present?
        entity_names = entities[:contacts].map { |c| c["name"] }.compact
        name_matches = Contact.where("display_name ILIKE ANY(ARRAY[?])", entity_names.map { |n| "%#{n}%" }).limit(5)
        suggestions = (suggestions + name_matches).uniq
      end
    end

    render json: {
      success: true,
      data: {
        suggestions: suggestions.map { |c| contact_summary(c) },
        email_addresses: email_addresses,
        already_linked: email.contact_ids || []
      }
    }
  end

  # GET /api/v1/email_warehouse/:id/attachments/:attachment_id/download
  # Download an attachment - tries SharePoint first (SSoT), falls back to Outlook
  # attachment_id can be either local EmailAttachment ID or outlook_attachment_id
  def download_attachment
    attachment_id = params[:attachment_id]

    # Try to find local EmailAttachment first
    email_attachment = @email.email_attachments.find_by(id: attachment_id)
    outlook_attachment_id = email_attachment&.outlook_attachment_id || attachment_id
    filename_hint = email_attachment&.filename || email_attachment&.attachment&.filename
    content_type_hint = email_attachment&.attachment&.content_type

    # SSoT: Try SharePoint first if attachment is synced there
    if email_attachment&.attachment&.sharepoint_file_id.present?
      sp_config = MicrosoftCredential.teeem_sharepoint_config
      if sp_config
        begin
          Rails.logger.info "[EmailWarehouse] Downloading attachment from SharePoint: #{email_attachment.attachment.sharepoint_file_id}"
          teeem_client = MicrosoftAppGraphClient.new(sp_config[:credential])
          content = teeem_client.get_drive_item_content(
            drive_id: sp_config[:drive_id],
            item_id: email_attachment.attachment.sharepoint_file_id
          )

          if content.present?
            filename = filename_hint || "attachment"
            content_type = content_type_hint || "application/octet-stream"

            return send_data(
              content,
              filename: filename,
              type: content_type,
              disposition: "attachment"
            )
          end
        rescue StandardError => e
          # SharePoint download failed - fall back to Outlook
          Rails.logger.warn "[EmailWarehouse] SharePoint download failed, falling back to Outlook: #{e.message}"
        end
      end
    end

    # Fallback: Download from Outlook API
    # SSoT: Use MicrosoftCredential - same pattern as sync_attachments!
    credential = if @email.microsoft_credential_id.present?
                   MicrosoftCredential.find_by(id: @email.microsoft_credential_id)
                 else
                   MicrosoftCredential.app_credentials.connected.first
                 end

    unless credential&.valid_credential?
      return render json: { error: "No valid Microsoft credentials configured" }, status: :unprocessable_entity
    end

    # Get mailbox email
    mailbox = @email.mailbox_owner_email
    unless mailbox.present?
      return render json: { error: "Mailbox information not available" }, status: :unprocessable_entity
    end

    # Fetch attachment from Microsoft Graph (Outlook)
    Rails.logger.info "[EmailWarehouse] Downloading attachment from Outlook: #{outlook_attachment_id}"
    client = MicrosoftAppGraphClient.new(credential)
    attachment_data = client.download_email_attachment(mailbox, @email.outlook_id, outlook_attachment_id)

    if attachment_data && attachment_data[:content]
      filename = filename_hint || attachment_data[:filename] || "attachment"
      content_type = attachment_data[:content_type] || "application/octet-stream"

      send_data(
        attachment_data[:content],
        filename: filename,
        type: content_type,
        disposition: "attachment"
      )
    else
      render json: { error: "Failed to download attachment" }, status: :not_found
    end
  rescue StandardError => e
    Rails.logger.error "[EmailWarehouse] Attachment download failed: #{e.message}"
    render json: { error: "Download failed" }, status: :internal_server_error
  end

  # GET /api/v1/email_warehouse/rules
  # Get email classification rules and current user's email stats
  def rules
    user_email = current_user.email&.downcase

    # Get user's email stats
    user_emails = EmailWarehouse.where("synced_by_user_id = ? OR LOWER(from_email) = ? OR ? = ANY(LOWER(to_emails::text)::text[])",
                                       current_user.id, user_email, user_email)

    # Classification breakdown for user
    classification_counts = user_emails.group("email_classification->>'email_type'").count

    # Ephemeral breakdown
    ephemeral_count = user_emails.where("email_classification->>'ephemeral' = ?", "true").count
    expired_ephemeral = user_emails.where("email_classification->>'ephemeral' = ?", "true")
                                   .where("(email_classification->>'expires_at')::timestamp < ?", Time.current).count

    # Build rules response with current system rules
    render json: {
      user_stats: {
        total_emails: user_emails.count,
        by_classification: {
          business: classification_counts["business"] || 0,
          transactional: classification_counts["transactional"] || 0,
          marketing: classification_counts["marketing"] || 0,
          spam: classification_counts["spam"] || 0,
          unclassified: classification_counts[nil] || 0
        },
        ephemeral: {
          total: ephemeral_count,
          expired: expired_ephemeral
        }
      },
      rules: {
        spam_detection: {
          description: "Emails flagged as spam based on these indicators",
          indicators: [
            { name: "ALL CAPS subject", description: "Subject is all capitals with 10+ characters (unless business pattern)" },
            { name: "Excessive punctuation", description: "3+ exclamation marks in subject" },
            { name: "Spam keywords", description: "Contains phrases like 'you've won', 'claim your prize', '$$$'" }
          ],
          trusted_domains: EmailClassificationService::TRUSTED_DOMAINS,
          note: "Emails from trusted domains are never marked as spam"
        },
        marketing_detection: {
          description: "Newsletter and promotional email detection",
          indicators: [
            { name: "Marketing headers", description: "List-Unsubscribe header, X-Campaign-Id, etc." },
            { name: "Marketing keywords", description: "Unsubscribe links, 'view in browser', sale/discount language" },
            { name: "Marketing domains", description: "Known email marketing platforms" }
          ],
          marketing_domains: EmailClassificationService::MARKETING_DOMAINS
        },
        ephemeral_rules: {
          description: "Automated emails with limited retention - deleted after expiry",
          categories: EmailClassificationService::EPHEMERAL_PATTERNS.map do |type, config|
            {
              type: type.to_s,
              retention_days: config[:retention_days],
              from_pattern: config[:from_pattern].source,
              examples: ephemeral_examples(type)
            }
          end
        },
        transactional_detection: {
          description: "Order confirmations, receipts, shipping notifications",
          keywords: EmailClassificationService::TRANSACTIONAL_KEYWORDS.map(&:source)
        }
      },
      cleanup_preview: {
        spam_pending_delete: EmailWarehouse.spam.count,
        ephemeral_expired: expired_ephemeral
      }
    }
  end

  # POST /api/v1/email_warehouse/bulk_delete_spam
  # Delete all spam emails from Outlook (and optionally from database)
  # SSoT: Uses org credentials (per-user Outlook removed)
  # Security: Requires admin (before_action), org isolation via credential grouping
  def bulk_delete_spam
    # Note: Org isolation is enforced via microsoft_credential_id grouping below
    # Each credential belongs to exactly one org, so deletions are org-scoped
    spam_emails = EmailWarehouse.spam.where.not(outlook_id: nil).where.not(microsoft_credential_id: nil)

    deleted_count = 0
    failed_count = 0
    errors = []

    # SSoT: Group by credential to minimize client creation
    spam_emails.group_by(&:microsoft_credential_id).each do |cred_id, emails|
      org_cred = MicrosoftCredential.find_by(id: cred_id)
      next unless org_cred&.connected?

      graph_client = MicrosoftAppGraphClient.for_org(org_cred.organization)

      emails.each do |email|
        result = graph_client.delete_user_email(email.mailbox_owner_email, email.outlook_id)
        if result
          # Mark as deleted in our database
          email.update!(
            email_classification: (email.email_classification || {}).merge("deleted_from_outlook" => true, "deleted_at" => Time.current.iso8601)
          )
          deleted_count += 1
        else
          failed_count += 1
          errors << "Failed to delete email #{email.id}"
        end
      rescue StandardError => e
        failed_count += 1
        errors << "Error deleting email #{email.id}: #{e.message}"
      end
    end

    # Optionally delete from our database too
    if params[:delete_from_database] == "true"
      EmailWarehouse.spam.where("email_classification->>'deleted_from_outlook' = ?", "true").destroy_all
    end

    render json: {
      success: failed_count == 0,
      message: "Deleted #{deleted_count} spam emails from Outlook",
      deleted_count: deleted_count,
      failed_count: failed_count,
      errors: errors.first(10)  # Limit errors in response
    }
  end

  private

  def set_email
    @email = EmailWarehouse.includes(:job).find(params[:id])
  end

  # Check if attachment is a signature/embedded image that should be hidden
  def signature_attachment?(attachment_data)
    filename = attachment_data["name"].to_s.downcase
    is_inline = attachment_data["isInline"] == true
    file_size = attachment_data["size"].to_i
    content_type = attachment_data["contentType"].to_s.downcase

    # Only filter images
    return false unless content_type.start_with?("image/")

    # Signature patterns
    signature_patterns = [
      /^image\d{3}\.(png|jpg|jpeg|gif)$/i,  # image001.png, image002.jpg
      /^[a-f0-9]{32}\.(png|jpg|jpeg|gif)$/i, # 32-char hex filenames
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|jpeg|gif)$/i, # UUID filenames
      /^cid:/i,                              # Content-ID references
      /^outlook-signature[_-]/i,             # Outlook signature files
    ]

    # Filter if matches signature pattern (inline or not)
    return true if signature_patterns.any? { |pattern| filename.match?(pattern) }

    # Filter very small inline images (< 10KB) - likely icons
    return true if is_inline && file_size < 10_000

    false
  end

  def email_json(email, include_body: false, include_thread: false, include_thread_count: false, include_suggestions: false, contacts_cache: nil, thread_counts_cache: nil, user_states_cache: nil, thread_emails: nil)
    # Get user's read state - check cache first, then database
    user_state = if user_states_cache
      user_states_cache[email.id]
    else
      EmailUserState.find_by(email_warehouse_id: email.id, user_id: current_user.id)
    end
    # Default to unread if no state exists (new emails are unread)
    is_read = user_state&.is_read || false

    json = {
      id: email.id,
      subject: email.subject,
      from_email: email.from_email,
      from_address: email.from_email,
      from_name: email.from_name,
      display_from: email.display_from,
      to_emails: email.to_emails,
      to_addresses: email.to_emails,
      cc_emails: email.cc_emails,
      received_at: email.received_at,
      has_attachments: email.has_attachments,
      # SSoT: Use stored attachment_count (updated when email is viewed or synced)
      attachment_count: email.attachment_count.to_i,
      snippet: email.preview_body(length: 200),
      body_preview: email.preview_body(length: 200),
      job_id: email.job_id,
      job_number: email.job&.job_number,
      match_type: email.match_type,
      match_confidence: email.match_confidence,
      is_latest_in_thread: email.is_latest_in_thread,
      is_read: is_read,
      conversation_id: email.conversation_id,
      source_type: email.source_type || "outlook",
      imap_credential_id: email.imap_credential_id,
      mailbox: email.mailbox_owner_email,
      # Direction and importance (direction column may not exist yet)
      direction: email.respond_to?(:direction) ? email.direction : nil,
      importance: email.importance,
      # Classification
      email_classification: email.email_classification,
      classification_type: email.email_classification&.dig("email_type"),
      classification_confidence: email.email_classification&.dig("confidence"),
      # AI Summary
      ai_summary: email.ai_summary,
      # Contact matching
      # Performance: Use contacts_cache if provided to avoid N+1 queries
      primary_contact_id: email.primary_contact_id,
      contact_ids: email.contact_ids || [],
      primary_contact: email.primary_contact_id ? contact_summary(
        contacts_cache ? contacts_cache[email.primary_contact_id] : Contact.find_by(id: email.primary_contact_id)
      ) : nil,
      contacts: email.contact_ids.present? ? (
        contacts_cache ?
          email.contact_ids.filter_map { |id| contact_summary(contacts_cache[id]) } :
          Contact.where(id: email.contact_ids).map { |c| contact_summary(c) }
      ) : []
    }

    if include_body
      json[:body_text] = email.body_text
      json[:body_html] = email.body_html
      # Include attachments for full email view
      json[:attachments] = build_attachments_list(email)
    end

    if include_thread_count
      # Performance: Use thread_counts_cache if provided to avoid N+1 queries
      json[:thread_count] = if thread_counts_cache && email.conversation_id.present?
                              thread_counts_cache[email.conversation_id] || 1
                            else
                              email.thread_count
                            end
    end

    if include_thread && email.conversation_id.present?
      # Performance: Use pre-fetched thread_emails if provided to avoid N+1
      thread = thread_emails || email.conversation_thread
      json[:thread] = thread.map { |e| email_json(e, contacts_cache: contacts_cache, user_states_cache: user_states_cache) }
    end

    if include_suggestions && email.job_id.nil?
      matches = email.find_matching_jobs.first(3)
      json[:suggested_jobs] = matches.map do |m|
        {
          job_id: m[:job].id,
          job_title: m[:job].title,
          confidence: m[:confidence],
          reason: m[:reason]
        }
      end
    end

    json
  end

  # Build attachments list - use synced records or fetch from MS365
  def build_attachments_list(email)
    # First try local email_attachments (already synced to SharePoint)
    synced = email.email_attachments.includes(:attachment)
    if synced.any?
      return synced.map do |ea|
        {
          id: ea.id,
          name: ea.filename || ea.attachment&.filename || "Unknown",
          content_type: ea.attachment&.content_type,
          size: ea.attachment&.file_size,
          outlook_attachment_id: ea.outlook_attachment_id
        }
      end
    end

    # If no synced attachments but email has attachments, fetch from MS365
    return [] unless email.has_attachments && email.outlook_id.present?

    begin
      credential = if email.microsoft_credential_id.present?
                     MicrosoftCredential.find_by(id: email.microsoft_credential_id)
                   else
                     MicrosoftCredential.app_credentials.connected.first
                   end

      return [] unless credential&.valid_credential?

      mailbox = email.mailbox_owner_email
      return [] unless mailbox.present?

      client = MicrosoftAppGraphClient.new(credential)
      ms_attachments = client.get_email_attachments(mailbox, email.outlook_id)

      # Filter out signature/embedded images
      filtered = ms_attachments.reject { |att| signature_attachment?(att) }

      # SSoT: Update attachment_count when we discover actual count from Outlook
      # This ensures the count is accurate for future list views
      if filtered.any? && email.attachment_count.to_i != filtered.size
        email.update_column(:attachment_count, filtered.size)
      end

      filtered.map do |att|
        {
          id: nil,  # No local ID yet
          name: att["name"] || "attachment",
          content_type: att["contentType"],
          size: att["size"],
          outlook_attachment_id: att["id"]
        }
      end
    rescue StandardError => e
      Rails.logger.warn "[EmailWarehouse] Failed to fetch attachments from MS365: #{e.message}"
      []
    end
  end

  def suggestion_json(suggestion)
    json = {
      email: email_json(suggestion[:email]),
      confidence: suggestion[:confidence],
      reason: suggestion[:reason]
    }

    # Include suggested job if email body mentions a different job
    if suggestion[:suggested_job].present?
      json[:suggested_job] = {
        id: suggestion[:suggested_job].id,
        name: suggestion[:suggested_job].name,
        match_reason: suggestion[:suggested_job_reason]
      }
    end

    json
  end

  def find_suggested_emails_for_job(job)
    suggestions = []

    # Get job contacts' emails
    contact_emails = job.contacts.pluck(:email).compact

    # Find unassigned emails involving these contacts (excluding dismissed)
    contact_emails.each do |email_addr|
      EmailWarehouse.unassigned
        .involving_email(email_addr)
        .where.not("? = ANY(dismissed_from_job_ids)", job.id)
        .latest_in_thread
        .limit(10).each do |email|

        # Check if email body mentions a DIFFERENT job's address
        # If so, skip this suggestion - the email belongs elsewhere
        potential_matches = email.find_potential_job_matches
        if potential_matches.any?
          best_match = potential_matches.first
          # If the email clearly mentions a different job, don't suggest it here
          if best_match[:job].id != job.id
            # Skip - this email belongs to a different job
            next
          end
        end

        # Also check if email mentions THIS job's context (address, job ID)
        # For contact-based matches, require job context to avoid noise
        mentions_this_job = email.email_mentions_job_context?(job)

        # Only suggest if email mentions this job's context
        # OR if there are no other job matches (general correspondence)
        next unless mentions_this_job || potential_matches.empty?

        suggestions << {
          email: email,
          confidence: mentions_this_job ? 0.9 : 0.6,
          reason: "Contact email match: #{email_addr}"
        }
      end
    end

    # Find emails mentioning job address (excluding dismissed)
    if job.title.present?
      EmailWarehouse.unassigned
        .search_text(job.title)
        .where.not("? = ANY(dismissed_from_job_ids)", job.id)
        .latest_in_thread
        .limit(10).each do |email|
        suggestions << {
          email: email,
          confidence: 0.8,
          reason: "Address match: #{job.title}"
        }
      end
    end

    # Deduplicate and sort
    suggestions
      .uniq { |s| s[:email].id }
      .sort_by { |s| -s[:confidence] }
      .first(20)
  end

  def ephemeral_examples(type)
    case type
    when :github_notifications
      [ "GitHub Actions run failed/succeeded", "CI/CD notifications", "Deploy status" ]
    when :calendar_notifications
      [ "Meeting reminders", "Calendar invitations", "Event updates" ]
    when :system_alerts
      [ "Heroku alerts", "Sentry error notifications", "Uptime monitors" ]
    when :shipping_tracking
      [ "AusPost tracking", "Package delivered", "Shipment in transit" ]
    else
      []
    end
  end

  def contact_summary(contact)
    return nil unless contact

    {
      id: contact.id,
      display_name: contact.display_name,
      email: contact.email,
      phone: contact.phone,
      company_name: contact.company_name,
      avatar_url: contact.try(:avatar_url)
    }
  end

  # ========================================
  # Split Inbox Rendering
  # ========================================

  def render_split_inbox(base_scope)
    service = SplitInboxService.new(current_user, base_scope)

    # If a specific category is requested, return paginated emails for that category
    if params[:category].present?
      category = params[:category].to_sym
      page = (params[:page] || 1).to_i
      per_page = [ (params[:per_page] || 50).to_i, 200 ].min

      emails = service.emails_for_category(category, page: page, per_page: per_page)
      total = service.category_counts[category] || 0

      # Performance: Batch load contacts and user states for this category
      all_contact_ids = emails.flat_map { |e| [e.primary_contact_id, *(e.contact_ids || [])] }.compact.uniq
      contacts_cache = Contact.where(id: all_contact_ids).index_by(&:id)
      all_email_ids = emails.map(&:id)
      user_states_cache = EmailUserState.where(email_warehouse_id: all_email_ids, user_id: current_user.id).index_by(&:email_warehouse_id)

      return render json: {
        success: true,
        data: {
          category: params[:category],
          emails: emails.map { |e| email_json(e, contacts_cache: contacts_cache, user_states_cache: user_states_cache) },
          pagination: {
            page: page,
            per_page: per_page,
            total: total,
            total_pages: (total.to_f / per_page).ceil
          }
        }
      }
    end

    # Return overview with all categories
    overview = service.overview
    unread = service.unread_counts

    # Performance: Batch load contacts and user states for ALL categories at once
    all_emails = overview.values.flat_map { |cat| cat[:emails] }
    all_contact_ids = all_emails.flat_map { |e| [e.primary_contact_id, *(e.contact_ids || [])] }.compact.uniq
    contacts_cache = Contact.where(id: all_contact_ids).index_by(&:id)
    all_email_ids = all_emails.map(&:id)
    user_states_cache = EmailUserState.where(email_warehouse_id: all_email_ids, user_id: current_user.id).index_by(&:email_warehouse_id)

    render json: {
      success: true,
      data: {
        categories: {
          vip: {
            count: overview[:vip][:count],
            unread_count: unread[:vip],
            emails: overview[:vip][:emails].map { |e| email_json(e, contacts_cache: contacts_cache, user_states_cache: user_states_cache) }
          },
          team: {
            count: overview[:team][:count],
            unread_count: unread[:team],
            emails: overview[:team][:emails].map { |e| email_json(e, contacts_cache: contacts_cache, user_states_cache: user_states_cache) }
          },
          newsletters: {
            count: overview[:newsletters][:count],
            unread_count: unread[:newsletters],
            emails: overview[:newsletters][:emails].map { |e| email_json(e, contacts_cache: contacts_cache, user_states_cache: user_states_cache) }
          },
          other: {
            count: overview[:other][:count],
            unread_count: unread[:other],
            emails: overview[:other][:emails].map { |e| email_json(e, contacts_cache: contacts_cache, user_states_cache: user_states_cache) }
          }
        },
        team_domains: CorporateCompanySetting.team_email_domains
      }
    }
  end
end
