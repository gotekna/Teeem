# Renamed from EmailWarehouseController (Jan 2026)
class Api::V1::SyncedEmailsController < ApplicationController
  before_action :set_email, only: [ :show, :assign_to_job, :unassign, :mark_as_spam, :delete_from_outlook, :move_to_folder, :summarize, :link_contact, :unlink_contact, :quick_create_contact, :download_attachment, :download_eml, :attachment_presigned_url ]
  before_action :require_admin, only: [ :bulk_delete_spam ]

  # GET /api/v1/synced_emails
  # List synced emails with filtering
  def index
    emails = SyncedEmail.all

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

      # Ultra Email Architecture: MS365 org mailboxes - filter via mailbox_appearances join table
      # This allows emails sent to multiple recipients to be seen by all of them
      if ms365_cred_ids.any?
        # Join with mailbox_appearances to find emails visible to this user's mailboxes
        conditions << "(id IN (SELECT synced_email_id FROM synced_email_mailboxes WHERE microsoft_credential_id IN (?) AND LOWER(mailbox_owner_email) IN (?)))"
        bind_values << ms365_cred_ids
        bind_values << ms365_mailbox_emails.map(&:downcase)
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

    # Filter by mailbox_owner_email (for Warehouse links to historical mailboxes)
    # This allows filtering by mailbox even if it's not a connected account
    if params[:mailbox_owner_email].present?
      emails = emails.where("LOWER(mailbox_owner_email) = LOWER(?)", params[:mailbox_owner_email])
    end

    # Filter by folder name or ID (e.g., "Sent Items", "Inbox", etc.)
    # SSoT: Use in_folder scope for case-insensitive matching (Gmail=INBOX, Outlook=Inbox, etc.)
    if params[:folder_id].present?
      emails = emails.in_folder(params[:folder_id])
    end
    if params[:folder_name].present?
      Rails.logger.info "[SyncedEmail] Filtering by folder_name: #{params[:folder_name].inspect}"
      emails = emails.in_folder(params[:folder_name])
      Rails.logger.info "[SyncedEmail] After folder filter, count: #{emails.count}"
    end

    # Filter by direction (sent, received, cc, bcc)
    # Note: direction column may not exist yet (pending migration)
    if params[:direction].present? && SyncedEmail.column_names.include?("direction")
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
        # SSoT: Match the same logic as all_accounts endpoint
        configured_mailboxes = org_cred.sync_config&.dig("user_mailbox_access", current_user.id.to_s) || []

        # SSoT: Auto-include user's own email if it exists in this tenant
        # This matches all_accounts endpoint which also auto-includes user's email
        auto_mailboxes = []
        if current_user.email.present?
          # Check if user's email exists in this tenant's synced emails (case-insensitive)
          # (Cheaper than calling list_tenant_users which is an API call)
          user_email_exists = SyncedEmail.where(microsoft_credential_id: org_cred.id)
            .where("LOWER(mailbox_owner_email) = LOWER(?)", current_user.email)
            .exists?
          auto_mailboxes = [current_user.email.downcase] if user_email_exists
        end

        # Combine configured + auto-included mailboxes (case-insensitive dedup)
        user_mailboxes = (auto_mailboxes + configured_mailboxes).map(&:downcase).uniq

        Rails.logger.info "[SyncedEmail] MS365 filter: credential=#{org_cred.id}, user_mailboxes=#{user_mailboxes.inspect}"

        if user_mailboxes.any?
          # Ultra Email Architecture: Filter via mailbox_appearances join table
          # This allows emails sent to multiple recipients to be seen by all of them
          if params[:mailbox].present? && user_mailboxes.map(&:downcase).include?(params[:mailbox].downcase)
            # Specific mailbox requested - use join table
            emails = emails.joins(:mailbox_appearances)
              .where(synced_email_mailboxes: { microsoft_credential_id: params[:microsoft_credential_id] })
              .where("LOWER(synced_email_mailboxes.mailbox_owner_email) = LOWER(?)", params[:mailbox])
              .distinct
          else
            # All user's mailboxes - use join table
            emails = emails.joins(:mailbox_appearances)
              .where(synced_email_mailboxes: { microsoft_credential_id: params[:microsoft_credential_id] })
              .where("LOWER(synced_email_mailboxes.mailbox_owner_email) IN (?)", user_mailboxes.map(&:downcase))
              .distinct
          end
        else
          # User has no access to this credential's mailboxes
          Rails.logger.warn "[SyncedEmail] User #{current_user.id} has no access to MS365 credential #{org_cred.id}"
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
    user_states_cache = EmailUserState.where(synced_email_id: all_email_ids, user_id: current_user.id).index_by(&:synced_email_id)

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

  # GET /api/v1/synced_email/:id
  # Performance: Batch load all related data for email + thread to avoid N+1
  # Supports thread_summary=true for lightweight thread expansion (~70% smaller payload)
  def show
    # Performance: Thread summary mode returns lightweight data (no bodies)
    # Used for thread expansion in email list - bodies fetched on-demand
    if params[:thread_summary].present? && params[:include_thread].present? && @email.conversation_id.present?
      thread_emails = SyncedEmail.where(conversation_id: @email.conversation_id)
                                 .select(:id, :from_email, :from_name, :subject, :received_at, :snippet, :has_attachments, :conversation_id)
                                 .order(received_at: :asc)

      # Batch load user states for read status
      email_ids = thread_emails.map(&:id)
      user_states_cache = EmailUserState.where(synced_email_id: email_ids, user_id: current_user.id)
                                        .index_by(&:synced_email_id)

      return render json: {
        email: email_json(@email, include_body: true),
        thread: thread_emails.map do |e|
          user_state = user_states_cache[e.id]
          {
            id: e.id,
            subject: e.subject,
            from_email: e.from_email,
            from_name: e.from_name,
            from_address: e.from_email,
            received_at: e.received_at,
            # Use snippet directly since body_text wasn't loaded (for lightweight response)
            snippet: e.snippet,
            body_preview: e.snippet,
            has_attachments: e.has_attachments,
            is_read: user_state&.is_read || false,
            conversation_id: e.conversation_id
          }
        end,
        thread_count: thread_emails.count
      }
    end

    # Full thread mode (existing behavior)
    # Get conversation thread with eager loading (1 query)
    thread_emails = if @email.conversation_id.present?
      SyncedEmail.where(conversation_id: @email.conversation_id)
                    .includes(:job)
                    .order(received_at: :asc)
                    .to_a
    else
      [ @email ]
    end

    # Batch load all user states for thread (1 query)
    email_ids = thread_emails.map(&:id)
    user_states_cache = EmailUserState.where(synced_email_id: email_ids, user_id: current_user.id)
                                      .index_by(&:synced_email_id)

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

  # GET /api/v1/synced_email/for_job/:job_id
  # Get emails for a specific job with conversation threading
  def for_job
    job = Job.find(params[:job_id])

    # Get emails assigned to this job
    emails = SyncedEmail.for_job(job.id)

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
    thread_counts_cache = SyncedEmail.where(conversation_id: conversation_ids)
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

  # GET /api/v1/synced_email/unassigned
  # Get unassigned emails for review
  def unassigned
    emails = SyncedEmail.unassigned.latest_in_thread.recent_first

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

  # POST /api/v1/synced_email/:id/assign_to_job
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

  # POST /api/v1/synced_email/:id/unassign
  def unassign
    @email.update!(job_id: nil, match_type: nil, match_confidence: nil, matched_at: nil)

    render json: {
      success: true,
      message: "Email unassigned from job",
      email: email_json(@email)
    }
  end

  # POST /api/v1/synced_email/:id/dismiss_suggestion
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

  # GET /api/v1/synced_email/sync_status
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

  # POST /api/v1/synced_email/sync
  # Trigger manual email sync from Office 365
  def sync
    # SSoT: Sync ALL connected MS365 organizations (not just one)
    connected_orgs = MicrosoftCredential.app_credentials.connected

    connected_orgs.each do |cred|
      OrgEmailSyncJob.perform_later("incremental", credential_id: cred.id)
    end

    render json: {
      success: true,
      message: "Email sync started for #{connected_orgs.count} organization(s). New emails will appear shortly."
    }
  end

  # GET /api/v1/synced_email/search
  # Search warehouse emails
  def search
    return render json: { error: "Search query required" }, status: :bad_request if params[:q].blank?

    # Performance: Eager load and batch contacts
    emails = SyncedEmail.search_text(params[:q]).includes(:job).latest_in_thread.recent_first.limit(100)
    all_contact_ids = emails.flat_map { |e| [e.primary_contact_id, *(e.contact_ids || [])] }.compact.uniq
    contacts_cache = Contact.where(id: all_contact_ids).index_by(&:id)

    render json: {
      query: params[:q],
      emails: emails.map { |e| email_json(e, contacts_cache: contacts_cache) },
      count: emails.count
    }
  end

  # GET /api/v1/synced_email/stats
  # Get warehouse statistics
  def stats
    render json: {
      total_emails: SyncedEmail.count,
      assigned_emails: SyncedEmail.assigned.count,
      unassigned_emails: SyncedEmail.unassigned.count,
      conversations: SyncedEmail.distinct.count(:conversation_id),
      oldest_email: SyncedEmail.minimum(:received_at),
      newest_email: SyncedEmail.maximum(:received_at),
      jobs_with_emails: SyncedEmail.assigned.distinct.count(:job_id),
      spam_emails: SyncedEmail.spam.count,
      with_ai_summary: SyncedEmail.with_ai_summary.count
    }
  end

  # GET /api/v1/synced_email/unread_counts
  # Get unread email counts for the sidebar badge
  def unread_counts
    begin
      # Get emails user has access to (same logic as index my_emails)
      emails = SyncedEmail.all
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

      # Ultra Email Architecture: MS365 org mailboxes - use join table for proper multi-mailbox support
      # Build the query using mailbox_appearances for accurate unread counts per mailbox
      if ms365_cred_ids.any?
        # Use subquery to find emails visible to user's mailboxes via join table
        conditions << "(id IN (SELECT synced_email_id FROM synced_email_mailboxes WHERE microsoft_credential_id IN (?) AND LOWER(mailbox_owner_email) IN (?)))"
        bind_values << ms365_cred_ids
        bind_values << ms365_mailbox_emails.map(&:downcase)
      end

      if conditions.any?
        emails = emails.where(conditions.join(" OR "), *bind_values)
      else
        # No accounts connected
        return render json: { total: 0, by_account: [] }
      end

      # Ultra Email Architecture: Get unread counts per mailbox from join table
      # The join table has per-mailbox is_read status (more accurate than email-level is_read)
      ms365_unread_by_account = {}
      if ms365_cred_ids.any?
        ms365_unread_by_account = SyncedEmailMailbox
          .where(microsoft_credential_id: ms365_cred_ids)
          .where("LOWER(mailbox_owner_email) IN (?)", ms365_mailbox_emails.map(&:downcase))
          .where(is_read: false)
          .group(:mailbox_owner_email)
          .count
      end

      # For IMAP, still use the email-level is_read (no join table for IMAP yet)
      imap_unread_by_account = {}
      if user_imap_ids.any?
        imap_unread_by_account = emails
          .where(source_type: 'imap', imap_credential_id: user_imap_ids)
          .where(is_read: false)
          .group(:mailbox_owner_email)
          .count
      end

      # Merge the counts
      unread_by_account = ms365_unread_by_account.merge(imap_unread_by_account)
      total_unread = unread_by_account.values.sum

      # Build result including all accounts (even with 0 unread)
      by_account = all_accounts.uniq.map do |email|
        { email: email, count: unread_by_account[email] || 0 }
      end.sort_by { |a| [ -a[:count], a[:email] ] }

      render json: {
        total: total_unread,
        by_account: by_account
      }
    rescue StandardError => e
      # Graceful fallback - sidebar badge should not crash the page
      Rails.logger.error "[SyncedEmail#unread_counts] Error: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
      render json: { total: 0, by_account: [] }
    end
  end

  # GET /api/v1/synced_email/spam
  # List all spam emails
  def spam
    emails = SyncedEmail.spam.recent_first

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

  # POST /api/v1/synced_email/:id/mark_as_spam
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

  # DELETE /api/v1/synced_email/:id/delete_from_outlook
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

  # POST /api/v1/synced_email/:id/move_to_folder
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

  # POST /api/v1/synced_email/:id/summarize
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

  # POST /api/v1/synced_email/:id/link_contact
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

  # POST /api/v1/synced_email/:id/unlink_contact
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

  # POST /api/v1/synced_email/:id/quick_create_contact
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

  # GET /api/v1/synced_email/:id/suggest_contacts
  # Get contact suggestions for linking based on email addresses
  def suggest_contacts
    email = SyncedEmail.find(params[:id])

    # Extract all email addresses from the email
    email_addresses = [ email.from_email ]
    email_addresses.concat(email.to_emails || [])
    email_addresses.concat(email.cc_emails || [])
    email_addresses = email_addresses.compact.uniq.map(&:downcase)

    # SSoT: Find contacts through contact_emails table (Contact doesn't have email column)
    suggestions = Contact.joins(:contact_emails)
                         .where("LOWER(contact_emails.email) IN (?)", email_addresses)
                         .distinct
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

  # GET /api/v1/synced_email/:id/attachments/:attachment_id/download
  # Download an attachment - tries local storage first (SSoT), then SharePoint, then Outlook
  # attachment_id can be either local EmailAttachment ID or outlook_attachment_id
  def download_attachment
    attachment_id = params[:attachment_id]
    filename_param = params[:filename]  # SSoT: Frontend sends filename for local file matching

    # Try to find local EmailAttachment first
    email_attachment = @email.email_attachments.find_by(id: attachment_id)
    outlook_attachment_id = email_attachment&.outlook_attachment_id || attachment_id
    filename_hint = filename_param || email_attachment&.filename || email_attachment&.attachment&.filename
    content_type_hint = email_attachment&.attachment&.content_type

    # SSoT: Try email_attachments first (primary path since Jan 2026)
    # Priority 1: Use attachment found by ID if it's stored in Wasabi
    if email_attachment&.stored?
      Rails.logger.info "[SyncedEmail] Downloading attachment from Wasabi by ID: #{email_attachment.id} (#{email_attachment.filename})"
      content = email_attachment.download
      # Force binary encoding immediately after download to prevent UTF-8 errors in .present? check
      content = content&.b
      if content.present?
        return send_data(
          content,
          filename: email_attachment.filename,
          type: email_attachment.storage_blob&.content_type || "application/octet-stream",
          disposition: "attachment"
        )
      end
    end

    # Priority 2: Search by filename if ID lookup didn't work
    if @email.email_attachments.any? && filename_hint.present?
      attachment = @email.email_attachments.find { |a| a.filename == filename_hint }
      if attachment&.stored?
        Rails.logger.info "[SyncedEmail] Downloading attachment from Wasabi by filename: #{filename_hint}"
        content = attachment.download
        # Force binary encoding immediately after download to prevent UTF-8 errors in .present? check
        content = content&.b
        if content.present?
          return send_data(
            content,
            filename: filename_hint,
            type: attachment.storage_blob&.content_type || "application/octet-stream",
            disposition: "attachment"
          )
        end
      end
    end

    # Fallback 1: Try SharePoint if attachment is synced there
    if email_attachment&.attachment&.storage_reference.present?
      sp_config = MicrosoftCredential.teeem_sharepoint_config
      if sp_config
        begin
          Rails.logger.info "[SyncedEmail] Downloading attachment from SharePoint: #{email_attachment.attachment.storage_reference}"
          teeem_client = MicrosoftAppGraphClient.new(sp_config[:credential])
          content = teeem_client.get_drive_item_content(
            drive_id: sp_config[:drive_id],
            item_id: email_attachment.attachment.storage_reference
          )
          # Force binary encoding immediately after download to prevent UTF-8 errors in .present? check
          content = content&.b

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
          Rails.logger.warn "[SyncedEmail] SharePoint download failed, falling back to Outlook: #{e.message}"
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
    Rails.logger.info "[SyncedEmail] Downloading attachment from Outlook: #{outlook_attachment_id} for email #{@email.id} (outlook_id: #{@email.outlook_id})"
    client = MicrosoftAppGraphClient.new(credential)
    attachment_data = client.download_email_attachment(mailbox, @email.outlook_id, outlook_attachment_id)
    # Force binary encoding immediately after download to prevent UTF-8 errors
    attachment_data[:content] = attachment_data[:content]&.b if attachment_data

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
      # Attachment not found or unsupported type
      Rails.logger.warn "[SyncedEmail] Attachment not available: email_id=#{@email.id}, attachment_id=#{attachment_id}, outlook_attachment_id=#{outlook_attachment_id}"
      render json: { error: "Attachment not available - it may have been deleted from email server" }, status: :not_found
    end
  rescue StandardError => e
    Rails.logger.error "[SyncedEmail] Attachment download failed: email_id=#{@email&.id}, attachment_id=#{params[:attachment_id]}, error=#{e.class}: #{e.message}"
    Rails.logger.error "[SyncedEmail] Backtrace: #{e.backtrace.first(10).join("\n")}"
    render json: { error: "Download failed: #{e.class} - #{e.message.truncate(100)}" }, status: :internal_server_error
  end

  # GET /api/v1/synced_emails/:id/attachments/:attachment_id/presigned_url
  # Returns a presigned URL for direct download (no Rails streaming)
  # SSoT: Same pattern as document_storage_controller#presigned_url
  # Why: Avoids double transfer (S3 → Rails → Browser), browser fetches directly from S3
  def attachment_presigned_url
    attachment_id = params[:attachment_id]
    filename_param = params[:filename]

    # Try to find local EmailAttachment first
    email_attachment = @email.email_attachments.find_by(id: attachment_id)

    # Priority 1: Use attachment found by ID if it has storage_blob
    if email_attachment&.storage_blob.present?
      url = email_attachment.storage_blob.presigned_url(
        expires_in: 900,  # 15 minutes
        filename: email_attachment.filename
      )

      return render json: {
        success: true,
        url: url,
        filename: email_attachment.filename,
        content_type: email_attachment.storage_blob.content_type,
        expires_in: 900
      }
    end

    # Priority 2: Search by filename if ID lookup didn't find a blob
    if @email.email_attachments.any? && filename_param.present?
      attachment = @email.email_attachments.find { |a| a.filename == filename_param && a.storage_blob.present? }
      if attachment&.storage_blob.present?
        url = attachment.storage_blob.presigned_url(
          expires_in: 900,
          filename: attachment.filename
        )

        return render json: {
          success: true,
          url: url,
          filename: attachment.filename,
          content_type: attachment.storage_blob.content_type,
          expires_in: 900
        }
      end
    end

    # No local storage - fall back to proxy download (SharePoint/Outlook)
    render json: {
      success: false,
      error: "Attachment not in local storage - use download endpoint",
      fallback_to_proxy: true
    }, status: :not_found
  rescue StandardError => e
    Rails.logger.error "[SyncedEmail] Presigned URL failed: email_id=#{@email&.id}, attachment_id=#{params[:attachment_id]}, error=#{e.class}: #{e.message}"
    render json: { success: false, error: "Failed to get presigned URL: #{e.message}" }, status: :internal_server_error
  end

  # GET /api/v1/synced_email/:id/download_eml
  # Download the entire email as .eml file (RFC 822 MIME format)
  # Used for attaching emails to response emails in Task Hub
  #
  # SSoT: Email Warehouse is THE source of truth.
  # We reconstruct EML from stored fields - NO Outlook/IMAP fetching.
  # If reconstruction fails, we SHOW the error (no silent fallbacks).
  def download_eml
    # SSoT: Reconstruct from warehouse data (stored fields)
    mime_content = reconstruct_eml_from_warehouse

    # Generate a safe filename from subject
    subject = @email.subject.presence || "(No subject)"
    safe_subject = subject.gsub(/[^\w\s\-]/, "").strip.truncate(50, omission: "")
    filename = "#{safe_subject}.eml"

    # Return as base64 encoded JSON (same format as attachment download for consistency)
    render json: {
      success: true,
      filename: filename,
      content: Base64.strict_encode64(mime_content),
      content_type: "message/rfc822"
    }
  rescue StandardError => e
    # NO silent fallbacks - show the actual error so we can fix it
    Rails.logger.error "[SyncedEmail] EML download failed: email_id=#{@email&.id}, error=#{e.class}: #{e.message}"
    Rails.logger.error "[SyncedEmail] Email state: subject=#{@email&.subject.present?}, from=#{@email&.from_email.present?}, body_html=#{@email&.body_html.present?}, body_text=#{@email&.body_text.present?}"
    Rails.logger.error "[SyncedEmail] Backtrace: #{e.backtrace.first(5).join("\n")}"
    render json: { success: false, error: "EML reconstruction failed: #{e.message}" }, status: :unprocessable_entity
  end

  # POST /api/v1/synced_email/bulk_delete_spam
  # Delete all spam emails from Outlook (and optionally from database)
  # SSoT: Uses org credentials (per-user Outlook removed)
  # Security: Requires admin (before_action), org isolation via credential grouping
  def bulk_delete_spam
    # Note: Org isolation is enforced via microsoft_credential_id grouping below
    # Each credential belongs to exactly one org, so deletions are org-scoped
    spam_emails = SyncedEmail.spam.where.not(outlook_id: nil).where.not(microsoft_credential_id: nil)

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
      SyncedEmail.spam.where("email_classification->>'deleted_from_outlook' = ?", "true").destroy_all
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

  # Fetch MIME content from Outlook via Microsoft Graph
  def fetch_outlook_eml
    credential = if @email.microsoft_credential_id.present?
                   MicrosoftCredential.find_by(id: @email.microsoft_credential_id)
                 else
                   MicrosoftCredential.app_credentials.connected.first
                 end

    return nil unless credential&.valid_credential?

    mailbox = @email.mailbox_owner_email
    return nil unless mailbox.present? && @email.outlook_id.present?

    Rails.logger.info "[SyncedEmail] Fetching EML from Outlook: email_id=#{@email.id}, outlook_id=#{@email.outlook_id}"
    client = MicrosoftAppGraphClient.new(credential)
    client.get_email_mime_content(mailbox, @email.outlook_id)
  rescue StandardError => e
    Rails.logger.warn "[SyncedEmail] Outlook EML fetch failed: #{e.message}"
    nil
  end

  # Fetch MIME content from IMAP server
  def fetch_imap_eml
    credential = ImapCredential.find_by(id: @email.imap_credential_id)
    return nil unless credential&.connected?
    return nil unless @email.uid.present?

    Rails.logger.info "[SyncedEmail] Fetching EML from IMAP: email_id=#{@email.id}, uid=#{@email.uid}"

    # Use the IMAP service to fetch raw email
    service = ImapEmailService.new(credential)
    folder = @email.folder_name.presence || "INBOX"

    service.with_connection do |imap|
      imap.examine(folder)
      # Fetch raw MIME content using UID
      fetch_data = imap.uid_fetch([@email.uid], ["BODY.PEEK[]"])
      return nil if fetch_data.blank?

      msg = fetch_data.first
      msg&.attr&.dig("BODY[]")
    end
  rescue StandardError => e
    Rails.logger.warn "[SyncedEmail] IMAP EML fetch failed: #{e.message}"
    nil
  end

  # SSoT: Reconstruct .eml from Email Warehouse (stored fields)
  # This is THE source of truth - no fallback to Outlook/IMAP
  # Errors are raised, not swallowed - we need to see what's broken
  def reconstruct_eml_from_warehouse
    Rails.logger.info "[SyncedEmail] Reconstructing EML from warehouse: email_id=#{@email.id}"

    # Validate required fields - fail explicitly if missing
    raise "Email has no from_email" if @email.from_email.blank?
    raise "Email has no body (html or text)" if @email.body_html.blank? && @email.body_text.blank?

    email_ref = @email # Capture reference for block scope

    mail = Mail.new do |m|
      m.message_id = email_ref.internet_message_id if email_ref.internet_message_id.present?
      m.subject = email_ref.subject.presence || "(No subject)"
      m.from = email_ref.from_email
      m.to = email_ref.to_emails if email_ref.to_emails.present?
      m.cc = email_ref.cc_emails if email_ref.cc_emails.present?
      m.date = email_ref.received_at || email_ref.sent_at || email_ref.created_at

      # Set body - prefer HTML, fallback to text
      if email_ref.body_html.present?
        m.html_part = Mail::Part.new do
          content_type "text/html; charset=UTF-8"
          body email_ref.body_html
        end
      end

      if email_ref.body_text.present?
        m.text_part = Mail::Part.new do
          content_type "text/plain; charset=UTF-8"
          body email_ref.body_text
        end
      end

      # Mark as reconstructed from warehouse
      m["X-Reconstructed"] = "true"
      m["X-Reconstructed-From"] = "TEEEM Email Warehouse"
    end

    mail.to_s
  end

  # GET /api/v1/synced_email/rules
  # Get email classification rules and current user's email stats
  def rules
    user_email = current_user.email&.downcase

    # Get user's email stats
    user_emails = SyncedEmail.where("synced_by_user_id = ? OR LOWER(from_email) = ? OR ? = ANY(LOWER(to_emails::text)::text[])",
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
        spam_pending_delete: SyncedEmail.spam.count,
        ephemeral_expired: expired_ephemeral
      }
    }
  end

  private

  def set_email
    @email = SyncedEmail.includes(:job).find(params[:id])
  rescue ActiveRecord::RecordNotFound
    # Check if email exists but is tenant-scoped out (NULL tenant_id from pre-fix emails)
    email = SyncedEmail.unscoped.includes(:job).find_by(id: params[:id])

    if email.nil?
      render json: { success: false, error: "Email not found" }, status: :not_found
    elsif email.tenant_id.nil? && current_tenant.present?
      # Auto-fix legacy emails with NULL tenant_id
      Rails.logger.info "[SyncedEmails] Auto-fixing NULL tenant_id on email #{email.id}"
      email.update_column(:tenant_id, current_tenant.id)
      @email = email
    else
      render json: { success: false, error: "Email not accessible" }, status: :not_found
    end
  end

  def email_json(email, include_body: false, include_thread: false, include_thread_count: false, include_suggestions: false, contacts_cache: nil, thread_counts_cache: nil, user_states_cache: nil, thread_emails: nil)
    # Get user's read state - check cache first, then database
    user_state = if user_states_cache
      user_states_cache[email.id]
    else
      EmailUserState.find_by(synced_email_id: email.id, user_id: current_user.id)
    end
    # FRC (Jan 2026): If user has a state, use it. Otherwise fall back to the email's
    # read status from O365/IMAP. Previously defaulted to false, which showed emails
    # that were read in O365 as unread in TEEEM (wrong blue dots).
    is_read = user_state ? user_state.is_read : email.is_read

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
    synced = email.email_attachments.includes(:storage_blob, :attachment)
    if synced.any?
      return synced.map do |ea|
        # Generate presigned URL for inline images (to replace cid: references)
        inline_url = if ea.storage_blob.present? && ea.content_id.present?
                       ea.storage_blob.presigned_url(expires_in: 3600)
                     end
        {
          id: ea.id,
          name: ea.filename || ea.storage_blob&.original_filename || "Unknown",
          # content_type and file_size are on storage_blob (Jan 2026 refactor)
          content_type: ea.storage_blob&.content_type,
          size: ea.storage_blob&.file_size,
          outlook_attachment_id: ea.outlook_attachment_id,
          # For inline images: content_id matches cid: references in HTML
          content_id: ea.content_id,
          inline_url: inline_url
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

      # SSoT: Use EmailAttachmentFilterService to filter out signature/embedded images
      filtered = EmailAttachmentFilterService.filter_attachments(ms_attachments)

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
      Rails.logger.warn "[SyncedEmail] Failed to fetch attachments from MS365: #{e.message}"
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

    # Get job contacts' emails (SSoT: contact_emails table, not contacts.email column)
    contact_emails = ContactEmail.joins(contact: :job_contacts)
                                  .where(job_contacts: { job_id: job.id })
                                  .pluck(:email).compact

    # Find unassigned emails involving these contacts (excluding dismissed)
    contact_emails.each do |email_addr|
      SyncedEmail.unassigned
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
      SyncedEmail.unassigned
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
      user_states_cache = EmailUserState.where(synced_email_id: all_email_ids, user_id: current_user.id).index_by(&:synced_email_id)

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
    user_states_cache = EmailUserState.where(synced_email_id: all_email_ids, user_id: current_user.id).index_by(&:synced_email_id)

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
