class Api::V1::EmailWarehouseController < ApplicationController
  before_action :set_email, only: [ :show, :assign_to_job, :unassign ]

  # GET /api/v1/email_warehouse
  # List emails from warehouse with filtering
  def index
    emails = EmailWarehouse.all

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
      jobs_with_emails: EmailWarehouse.assigned.distinct.count(:job_id)
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
      from_name: email.from_name,
      display_from: email.display_from,
      to_emails: email.to_emails,
      cc_emails: email.cc_emails,
      received_at: email.received_at,
      has_attachments: email.has_attachments,
      attachment_count: email.attachment_count,
      preview_body: email.preview_body(length: 200),
      job_id: email.job_id,
      match_type: email.match_type,
      match_confidence: email.match_confidence,
      is_latest_in_thread: email.is_latest_in_thread,
      conversation_id: email.conversation_id
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
end
