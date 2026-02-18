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

  private

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
