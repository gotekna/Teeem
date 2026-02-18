class Api::V1::External::OpenclawController < ApplicationController
  # External API: No JWT auth, no tenant context - we derive both from API key
  skip_before_action :authorize_request
  skip_before_action :set_tenant, if: -> { true }

  before_action :authenticate_openclaw_user!
  before_action :set_tenant_from_user

  # GET /api/v1/external/openclaw/me
  # Returns user info + permissions (for OpenClaw to discover capabilities)
  def me
    perms = User::DEFAULT_OPENCLAW_PERMISSIONS.merge(@openclaw_user.openclaw_permissions || {})
    render json: {
      success: true,
      data: {
        user_id: @openclaw_user.id,
        name: @openclaw_user.name,
        email: @openclaw_user.email,
        permissions: perms,
        tenant: @openclaw_user.tenant&.name
      }
    }
  end

  # POST /api/v1/external/openclaw/chat
  # Send a chat message as the authenticated user
  def chat
    unless @openclaw_user.openclaw_permitted?(:chat_messages)
      return render json: { success: false, error: "Chat permission not enabled" }, status: :forbidden
    end

    content = params[:message]
    return render json: { success: false, error: "message is required" }, status: :bad_request if content.blank?

    message = ChatMessage.new(
      content: content,
      channel: params[:channel] || "general",
      message_type: "text",
      user: @openclaw_user
    )

    # Optional: direct message to another user
    if params[:recipient_user_id].present?
      message.recipient_user_id = params[:recipient_user_id]
    end

    # Optional: associate with a job
    if params[:job_id].present?
      job = Job.find_by(id: params[:job_id])
      message.job = job if job
    end

    if message.save
      render json: {
        success: true,
        data: {
          id: message.id,
          content: message.content,
          channel: message.channel,
          created_at: message.created_at
        }
      }, status: :created
    else
      render json: { success: false, error: message.errors.full_messages.join(", ") }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/external/openclaw/notes
  # Create a note (stored as ChatMessage with openclaw_note message_type)
  def notes
    unless @openclaw_user.openclaw_permitted?(:notes)
      return render json: { success: false, error: "Notes permission not enabled" }, status: :forbidden
    end

    content = params[:content]
    return render json: { success: false, error: "content is required" }, status: :bad_request if content.blank?

    message = ChatMessage.new(
      content: content,
      channel: "notes",
      message_type: "text",
      user: @openclaw_user
    )

    if params[:job_id].present?
      job = Job.find_by(id: params[:job_id])
      message.job = job if job
    end

    if params[:contact_id].present?
      contact = Contact.find_by(id: params[:contact_id])
      message.contact = contact if contact
    end

    if message.save
      render json: {
        success: true,
        data: {
          id: message.id,
          content: message.content,
          job_id: message.job_id,
          contact_id: message.contact_id,
          created_at: message.created_at
        }
      }, status: :created
    else
      render json: { success: false, error: message.errors.full_messages.join(", ") }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/external/openclaw/job_updates
  # Update fields on a job
  def job_updates
    unless @openclaw_user.openclaw_permitted?(:job_updates)
      return render json: { success: false, error: "Job updates permission not enabled" }, status: :forbidden
    end

    job_id = params[:job_id]
    return render json: { success: false, error: "job_id is required" }, status: :bad_request if job_id.blank?

    job = Job.find_by(id: job_id)
    return render json: { success: false, error: "Job not found" }, status: :not_found unless job

    updates = params[:updates]
    return render json: { success: false, error: "updates is required" }, status: :bad_request if updates.blank?

    # Only allow safe fields to be updated
    permitted_fields = %w[notes status]
    safe_updates = updates.to_unsafe_h.slice(*permitted_fields)

    if safe_updates.empty?
      return render json: { success: false, error: "No valid fields to update. Allowed: #{permitted_fields.join(', ')}" }, status: :bad_request
    end

    if job.update(safe_updates)
      render json: {
        success: true,
        data: {
          id: job.id,
          job_code: job.respond_to?(:job_code) ? job.job_code : nil,
          updated_fields: safe_updates.keys
        }
      }
    else
      render json: { success: false, error: job.errors.full_messages.join(", ") }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/external/openclaw/contacts
  # Create or update a contact
  def contacts
    unless @openclaw_user.openclaw_permitted?(:contacts_create) || @openclaw_user.openclaw_permitted?(:contacts_update)
      return render json: { success: false, error: "Contacts permission not enabled" }, status: :forbidden
    end

    name = params[:name]
    return render json: { success: false, error: "name is required" }, status: :bad_request if name.blank?

    # Try to find existing contact by email
    existing_contact = nil
    if params[:email].present?
      existing_contact = Contact.joins(:contact_emails)
                                .where(contact_emails: { email: params[:email] })
                                .first
    end

    if existing_contact
      # Update existing contact
      updates = {}
      updates[:display_name] = name if name.present?

      if params[:phone].present?
        phone = existing_contact.contact_phones.find_by(label: "mobile") ||
                existing_contact.contact_phones.find_by(phone_type: "mobile")
        if phone
          phone.update(phone_number: params[:phone])
        else
          existing_contact.contact_phones.create!(
            phone_number: params[:phone],
            phone_type: "mobile",
            label: "mobile",
            is_primary: existing_contact.contact_phones.empty?,
            position: (existing_contact.contact_phones.maximum(:position) || 0) + 1
          )
        end
      end

      existing_contact.update!(updates) if updates.any?

      render json: {
        success: true,
        data: {
          id: existing_contact.id,
          name: existing_contact.display_name,
          action: "updated"
        }
      }
    else
      # Create new contact
      parts = name.strip.split(/\s+/)
      contact = Contact.create!(
        display_name: name,
        first_name: parts[0],
        last_name: parts.length > 1 ? parts[1..].join(" ") : nil,
        entity_type: "person"
      )

      # Add email
      if params[:email].present?
        contact.contact_emails.create!(
          email: params[:email],
          label: "work",
          is_primary: true,
          position: 1
        )
      end

      # Add phone
      if params[:phone].present?
        contact.contact_phones.create!(
          phone_number: params[:phone],
          phone_type: "mobile",
          label: "mobile",
          is_primary: true,
          position: 1
        )
      end

      # Link to company if provided
      if params[:company].present?
        company_contact = Contact.find_by(display_name: params[:company], entity_type: "company")
        if company_contact
          ContactRelationship.create(
            source_contact_id: contact.id,
            related_contact_id: company_contact.id,
            relationship_type: "employee_of",
            is_active: true,
            start_date: Date.current
          )
        end
      end

      render json: {
        success: true,
        data: {
          id: contact.id,
          name: contact.display_name,
          action: "created"
        }
      }, status: :created
    end
  rescue ActiveRecord::RecordInvalid => e
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end

  # GET /api/v1/external/openclaw/jobs
  # List jobs (with optional search, status filter, pagination)
  def jobs_list
    unless @openclaw_user.openclaw_permitted?(:jobs_read)
      return render json: { success: false, error: "Jobs read permission not enabled" }, status: :forbidden
    end

    jobs = Job.all.includes(:job_type, :job_status, :job_stage)

    # Optional filters
    if params[:status].present?
      job_status = JobStatus.find_by(name: params[:status])
      jobs = jobs.where(job_status_id: job_status.id) if job_status
    end

    if params[:search].present?
      jobs = jobs.search(params[:search])
    end

    # Pagination
    page = (params[:page] || 1).to_i
    per_page = [(params[:per_page] || 25).to_i, 100].min
    total = jobs.count
    jobs = jobs.order(created_at: :desc).offset((page - 1) * per_page).limit(per_page)

    render json: {
      success: true,
      data: {
        jobs: jobs.map { |job| job_summary(job) },
        pagination: { page: page, per_page: per_page, total: total, total_pages: (total.to_f / per_page).ceil }
      }
    }
  end

  # GET /api/v1/external/openclaw/jobs/:id
  # Get a single job's details
  def jobs_show
    unless @openclaw_user.openclaw_permitted?(:jobs_read)
      return render json: { success: false, error: "Jobs read permission not enabled" }, status: :forbidden
    end

    job = Job.includes(:job_type, :job_status, :job_stage).find_by(id: params[:id])
    return render json: { success: false, error: "Job not found" }, status: :not_found unless job

    render json: {
      success: true,
      data: job_summary(job)
    }
  end

  # GET /api/v1/external/openclaw/tasks
  # List tasks (with optional filters for job_id, status, search, pagination)
  def tasks_list
    unless @openclaw_user.openclaw_permitted?(:tasks_read)
      return render json: { success: false, error: "Tasks read permission not enabled" }, status: :forbidden
    end

    tasks = SmTask.visible_to(@openclaw_user).includes(:job, :assigned_user, :supplier)

    # Optional filters
    tasks = tasks.where(job_id: params[:job_id]) if params[:job_id].present?
    tasks = tasks.where(status: params[:status]) if params[:status].present?
    tasks = tasks.where(assigned_user_id: params[:assigned_user_id]) if params[:assigned_user_id].present?
    tasks = tasks.search(params[:search]) if params[:search].present?

    if params[:start_date].present? && params[:end_date].present?
      tasks = tasks.for_date_range(Date.parse(params[:start_date]), Date.parse(params[:end_date]))
    end

    # Pagination
    page = (params[:page] || 1).to_i
    per_page = [(params[:per_page] || 25).to_i, 100].min
    total = tasks.count
    tasks = tasks.order(start_date: :asc, sequence_order: :asc).offset((page - 1) * per_page).limit(per_page)

    render json: {
      success: true,
      data: {
        tasks: tasks.map { |task| task_summary(task) },
        pagination: { page: page, per_page: per_page, total: total, total_pages: (total.to_f / per_page).ceil }
      }
    }
  end

  # GET /api/v1/external/openclaw/tasks/:id
  # Get a single task's details
  def tasks_show
    unless @openclaw_user.openclaw_permitted?(:tasks_read)
      return render json: { success: false, error: "Tasks read permission not enabled" }, status: :forbidden
    end

    task = SmTask.includes(:job, :assigned_user, :supplier).find_by(id: params[:id])
    return render json: { success: false, error: "Task not found" }, status: :not_found unless task
    return render json: { success: false, error: "Task not visible" }, status: :forbidden unless task.visible_to?(@openclaw_user)

    render json: {
      success: true,
      data: task_detail(task)
    }
  end

  # POST /api/v1/external/openclaw/tasks
  # Create a new task
  def tasks_create
    unless @openclaw_user.openclaw_permitted?(:tasks_create)
      return render json: { success: false, error: "Tasks create permission not enabled" }, status: :forbidden
    end

    name = params[:name]
    return render json: { success: false, error: "name is required" }, status: :bad_request if name.blank?

    task = SmTask.new(
      name: name,
      description: params[:description],
      status: params[:status] || "not_started",
      start_date: params[:start_date] || Date.current,
      end_date: params[:end_date],
      duration_days: params[:duration_days] || 1,
      sequence_order: params[:sequence_order] || 0,
      created_by: @openclaw_user
    )

    if params[:job_id].present?
      job = Job.find_by(id: params[:job_id])
      task.job = job if job
    end

    if params[:assigned_user_id].present?
      user = User.find_by(id: params[:assigned_user_id])
      task.assigned_user = user if user
    end

    if task.save
      render json: {
        success: true,
        data: task_summary(task)
      }, status: :created
    else
      render json: { success: false, error: task.errors.full_messages.join(", ") }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/external/openclaw/tasks/:id
  # Update a task
  def tasks_update
    unless @openclaw_user.openclaw_permitted?(:tasks_update)
      return render json: { success: false, error: "Tasks update permission not enabled" }, status: :forbidden
    end

    task = SmTask.find_by(id: params[:id])
    return render json: { success: false, error: "Task not found" }, status: :not_found unless task

    permitted_fields = %w[name description status start_date end_date duration_days assigned_user_id]
    updates = params.to_unsafe_h.slice(*permitted_fields)

    if updates.empty?
      return render json: { success: false, error: "No valid fields to update. Allowed: #{permitted_fields.join(', ')}" }, status: :bad_request
    end

    updates["updated_by_id"] = @openclaw_user.id

    if task.update(updates)
      render json: {
        success: true,
        data: task_summary(task.reload)
      }
    else
      render json: { success: false, error: task.errors.full_messages.join(", ") }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/external/openclaw/documents
  # Search/list documents (with optional filters)
  def documents_list
    unless @openclaw_user.openclaw_permitted?(:documents_search) || @openclaw_user.openclaw_permitted?(:documents_read)
      return render json: { success: false, error: "Documents permission not enabled" }, status: :forbidden
    end

    docs = WarehouseDocument.all.includes(:storage_blob)

    # Optional filters
    docs = docs.where(source_type: params[:source_type]) if params[:source_type].present?

    if params[:job_id].present?
      docs = docs.where(linkable_type: "Job", linkable_id: params[:job_id])
    end

    if params[:contact_id].present?
      docs = docs.where(linkable_type: "Contact", linkable_id: params[:contact_id])
    end

    if params[:search].present?
      search_term = "%#{params[:search]}%"
      docs = docs.where("ui_name ILIKE ? OR original_filename ILIKE ?", search_term, search_term)
    end

    # Pagination
    page = (params[:page] || 1).to_i
    per_page = [(params[:per_page] || 25).to_i, 100].min
    total = docs.count
    docs = docs.order(created_at: :desc).offset((page - 1) * per_page).limit(per_page)

    render json: {
      success: true,
      data: {
        documents: docs.map { |doc| document_summary(doc) },
        pagination: { page: page, per_page: per_page, total: total, total_pages: (total.to_f / per_page).ceil }
      }
    }
  end

  # GET /api/v1/external/openclaw/documents/:id
  # Get document details with download URL
  def documents_show
    unless @openclaw_user.openclaw_permitted?(:documents_read)
      return render json: { success: false, error: "Documents read permission not enabled" }, status: :forbidden
    end

    doc = WarehouseDocument.includes(:storage_blob).find_by(id: params[:id])
    return render json: { success: false, error: "Document not found" }, status: :not_found unless doc

    data = document_summary(doc)

    # Include presigned download URL if blob exists
    if doc.storage_blob.present?
      data[:download_url] = doc.storage_blob.presigned_url(
        filename: doc.download_filename,
        disposition: :attachment
      )
    end

    render json: {
      success: true,
      data: data
    }
  end

  private

  # ========================================
  # JSON serialization helpers
  # ========================================

  def job_summary(job)
    {
      id: job.id,
      job_code: job.respond_to?(:job_code) ? job.job_code : nil,
      name: job.name,
      status: job.job_status&.name,
      type: job.job_type&.name,
      stage: job.job_stage&.name,
      location: job.location,
      suburb: job.suburb,
      created_at: job.created_at
    }
  end

  def task_summary(task)
    {
      id: task.id,
      name: task.name,
      status: task.status,
      start_date: task.start_date,
      end_date: task.end_date,
      duration_days: task.duration_days,
      job_id: task.job_id,
      job_code: task.job&.respond_to?(:job_code) ? task.job.job_code : nil,
      assigned_user_id: task.assigned_user_id,
      assigned_user_name: task.assigned_user&.name,
      supplier_name: task.supplier&.display_name,
      created_at: task.created_at
    }
  end

  def task_detail(task)
    task_summary(task).merge(
      description: task.description,
      trade: task.trade,
      hold: task.hold?,
      confirm: task.confirm?,
      progress_percentage: task.progress_percentage,
      required_by: task.required_by,
      completed_at: task.completed_at,
      updated_at: task.updated_at
    )
  end

  def document_summary(doc)
    {
      id: doc.id,
      name: doc.ui_name,
      original_filename: doc.original_filename,
      source_type: doc.source_type,
      folder_path: doc.folder_path,
      content_type: doc.storage_blob&.content_type,
      file_size: doc.storage_blob&.byte_size,
      linkable_type: doc.linkable_type,
      linkable_id: doc.linkable_id,
      created_at: doc.created_at
    }
  end

  # Authenticate via X-API-Key header, looking up the user by digest
  def authenticate_openclaw_user!
    api_key = request.headers["X-API-Key"]

    if api_key.blank?
      return render json: {
        success: false,
        error: "API key required. Include X-API-Key header."
      }, status: :unauthorized
    end

    user = User.find_by_openclaw_key(api_key)

    if user.nil?
      return render json: {
        success: false,
        error: "Invalid API key"
      }, status: :unauthorized
    end

    @openclaw_user = user
  end

  # Set tenant context from the authenticated user
  def set_tenant_from_user
    return unless @openclaw_user&.tenant_id

    set_current_tenant(Tenant.find(@openclaw_user.tenant_id))
  end
end
