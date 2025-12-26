class Api::V1::EmailWarehouseController < ApplicationController
  before_action :set_email, only: [ :show, :assign_to_job, :unassign, :mark_as_spam, :delete_from_outlook, :move_to_folder ]

  # GET /api/v1/email_warehouse
  # List emails from warehouse with filtering
  def index
    emails = EmailWarehouse.all

    # Filter to only current user's emails (my_emails mode)
    # Skip this filter if microsoft_credential_id is provided (we'll filter by that instead)
    if params[:my_emails] == "true" && params[:microsoft_credential_id].blank?
      user_imap_ids = current_user.imap_credentials.pluck(:id)
      user_outlook_email = current_user.outlook_credential&.email

      # Get MS365 org credentials the user has mailbox access to
      ms365_cred_ids = []
      ms365_mailbox_emails = []
      OrganizationMicrosoftAppCredential.connected.each do |org_cred|
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

      # Personal Outlook
      if user_outlook_email.present?
        conditions << "(source_type = 'outlook' AND (from_email = ? OR ? = ANY(to_emails)))"
        bind_values << user_outlook_email
        bind_values << user_outlook_email
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

    # Filter by source type (outlook, imap)
    if params[:source_type].present?
      emails = emails.where(source_type: params[:source_type])
    end

    # Filter by IMAP credential
    if params[:imap_credential_id].present?
      emails = emails.where(imap_credential_id: params[:imap_credential_id])
    end

    # Filter by Microsoft 365 credential (org-level app credentials)
    # Also validates user has access to this credential's mailboxes
    if params[:microsoft_credential_id].present?
      org_cred = OrganizationMicrosoftAppCredential.find_by(id: params[:microsoft_credential_id])
      if org_cred
        # Get the mailboxes this user is authorized to access
        user_mailboxes = org_cred.sync_config&.dig("user_mailbox_access", current_user.id.to_s) || []
        if user_mailboxes.any?
          emails = emails.where(microsoft_credential_id: params[:microsoft_credential_id])
                         .where(mailbox_owner_email: user_mailboxes)
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

    emails = emails.recent_first.offset((page - 1) * per_page).limit(per_page)

    render json: {
      emails: emails.map { |e| email_json(e) },
      pagination: {
        page: page,
        per_page: per_page,
        total: total,
        total_pages: (total.to_f / per_page).ceil
      }
    }
  end

  # GET /api/v1/email_warehouse/:id
  def show
    render json: email_json(@email, include_body: true, include_thread: true)
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

    emails = emails.recent_first

    # Also get suggested matches (unassigned emails that might match)
    suggested = []
    if params[:include_suggestions] == "true"
      suggested = find_suggested_emails_for_job(job)
    end

    render json: {
      job_id: job.id,
      emails: emails.map { |e| email_json(e, include_thread_count: true) },
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

    emails = emails.offset((page - 1) * per_page).limit(per_page)

    render json: {
      emails: emails.map { |e| email_json(e, include_suggestions: true) },
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

  # POST /api/v1/email_warehouse/sync
  # Trigger manual sync for current user
  def sync
    unless current_user.outlook_credential&.valid_credential?
      return render json: { error: "Outlook not connected" }, status: :unprocessable_entity
    end

    sync_type = params[:full] == "true" ? "full" : "incremental"

    # Queue the sync job
    EmailWarehouseSyncJob.perform_later(current_user.id, sync_type)

    render json: {
      success: true,
      message: "#{sync_type.capitalize} sync queued. This may take a few minutes.",
      sync_type: sync_type
    }
  end

  # GET /api/v1/email_warehouse/sync_status
  # Get sync status for current user
  def sync_status
    status = EmailSyncStatus.find_by(user: current_user)

    if status.nil?
      return render json: {
        status: "not_started",
        message: "No sync has been performed yet",
        outlook_connected: current_user.outlook_credential.present?
      }
    end

    render json: {
      status: status.status,
      last_sync_at: status.last_sync_at,
      total_emails_synced: status.total_emails_synced,
      emails_synced_this_run: status.emails_synced_this_run,
      sync_started_at: status.sync_started_at,
      last_error: status.last_error,
      outlook_connected: current_user.outlook_credential.present?
    }
  end

  # POST /api/v1/email_warehouse/sync_for_job
  # Sync emails specifically for a job
  def sync_for_job
    job = Job.find(params[:job_id])

    unless current_user.outlook_credential&.valid_credential?
      return render json: { error: "Outlook not connected" }, status: :unprocessable_entity
    end

    service = EmailWarehouseSyncService.new(current_user)
    synced_count = service.sync_for_job(job)

    render json: {
      success: true,
      message: "Synced #{synced_count} emails for #{job.title}",
      synced_count: synced_count,
      job_id: job.id
    }
  rescue EmailWarehouseSyncService::SyncError => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # GET /api/v1/email_warehouse/search
  # Search warehouse emails
  def search
    return render json: { error: "Search query required" }, status: :bad_request if params[:q].blank?

    emails = EmailWarehouse.search_text(params[:q]).latest_in_thread.recent_first.limit(100)

    render json: {
      query: params[:q],
      emails: emails.map { |e| email_json(e) },
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

  # GET /api/v1/email_warehouse/spam
  # List all spam emails
  def spam
    emails = EmailWarehouse.spam.recent_first

    # Pagination
    page = (params[:page] || 1).to_i
    per_page = [ (params[:per_page] || 50).to_i, 200 ].min
    total = emails.count

    emails = emails.offset((page - 1) * per_page).limit(per_page)

    render json: {
      emails: emails.map { |e| email_json(e) },
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

    if delete_from_outlook && current_user.outlook_credential&.valid_credential?
      outlook_service = OutlookService.new(current_user)
      @email.mark_as_spam!(delete_from_outlook: true, outlook_service: outlook_service)
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
  def delete_from_outlook
    unless current_user.outlook_credential&.valid_credential?
      return render json: { error: "Outlook not connected" }, status: :unprocessable_entity
    end

    unless @email.outlook_id.present?
      return render json: { error: "Email has no Outlook ID" }, status: :unprocessable_entity
    end

    outlook_service = OutlookService.new(current_user)

    if outlook_service.delete_email(@email.outlook_id)
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
  def move_to_folder
    folder_id = params[:folder_id]
    folder_name = params[:folder_name]

    unless folder_id.present? || folder_name.present?
      return render json: { error: "folder_id or folder_name required" }, status: :unprocessable_entity
    end

    # Determine which service to use based on source type
    if @email.source_type == "outlook" && @email.outlook_id.present?
      unless current_user.outlook_credential&.valid_credential?
        return render json: { error: "Outlook not connected" }, status: :unprocessable_entity
      end

      outlook_service = OutlookService.new(current_user)
      result = outlook_service.move_email(@email.outlook_id, folder_id)

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
    elsif @email.microsoft_credential_id.present? && @email.outlook_id.present?
      # MS365 app credential
      org_cred = OrganizationMicrosoftAppCredential.find_by(id: @email.microsoft_credential_id)
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
  def bulk_delete_spam
    unless current_user.outlook_credential&.valid_credential?
      return render json: { error: "Outlook not connected" }, status: :unprocessable_entity
    end

    outlook_service = OutlookService.new(current_user)
    spam_emails = EmailWarehouse.spam.where.not(outlook_id: nil)

    deleted_count = 0
    failed_count = 0
    errors = []

    spam_emails.find_each do |email|
      if outlook_service.delete_email(email.outlook_id)
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
    @email = EmailWarehouse.find(params[:id])
  end

  def email_json(email, include_body: false, include_thread: false, include_thread_count: false, include_suggestions: false)
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
      attachment_count: email.attachment_count,
      snippet: email.preview_body(length: 200),
      body_preview: email.preview_body(length: 200),
      job_id: email.job_id,
      job_number: email.job&.job_number,
      match_type: email.match_type,
      match_confidence: email.match_confidence,
      is_latest_in_thread: email.is_latest_in_thread,
      is_read: true,
      conversation_id: email.conversation_id,
      source_type: email.source_type || "outlook",
      imap_credential_id: email.imap_credential_id
    }

    if include_body
      json[:body_text] = email.body_text
      json[:body_html] = email.body_html
    end

    if include_thread_count
      json[:thread_count] = email.thread_count
    end

    if include_thread && email.conversation_id.present?
      json[:thread] = email.conversation_thread.map { |e| email_json(e) }
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

  def suggestion_json(suggestion)
    {
      email: email_json(suggestion[:email]),
      confidence: suggestion[:confidence],
      reason: suggestion[:reason]
    }
  end

  def find_suggested_emails_for_job(job)
    suggestions = []

    # Get job contacts' emails
    contact_emails = job.contacts.pluck(:email).compact

    # Find unassigned emails involving these contacts
    contact_emails.each do |email_addr|
      EmailWarehouse.unassigned.involving_email(email_addr).latest_in_thread.limit(10).each do |email|
        suggestions << {
          email: email,
          confidence: 0.9,
          reason: "Contact email match: #{email_addr}"
        }
      end
    end

    # Find emails mentioning job address
    if job.title.present?
      EmailWarehouse.unassigned.search_text(job.title).latest_in_thread.limit(10).each do |email|
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

      return render json: {
        success: true,
        data: {
          category: params[:category],
          emails: emails.map { |e| email_json(e) },
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

    render json: {
      success: true,
      data: {
        categories: {
          vip: {
            count: overview[:vip][:count],
            unread_count: unread[:vip],
            emails: overview[:vip][:emails].map { |e| email_json(e) }
          },
          team: {
            count: overview[:team][:count],
            unread_count: unread[:team],
            emails: overview[:team][:emails].map { |e| email_json(e) }
          },
          newsletters: {
            count: overview[:newsletters][:count],
            unread_count: unread[:newsletters],
            emails: overview[:newsletters][:emails].map { |e| email_json(e) }
          },
          other: {
            count: overview[:other][:count],
            unread_count: unread[:other],
            emails: overview[:other][:emails].map { |e| email_json(e) }
          }
        },
        team_domains: CorporateCompanySetting.team_email_domains
      }
    }
  end
end
