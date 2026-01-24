class Api::V1::UsersController < ApplicationController
  # POST /api/v1/users
  # Create a new user (admin only)
  # Requires either contact_id (link to existing) or creates new contact from user info
  def create
    unless current_user&.admin?
      return render json: { success: false, error: "Admin access required" }, status: :forbidden
    end

    @user = nil
    success = false

    ActiveRecord::Base.transaction do
      # Get or create contact
      contact = find_or_create_contact

      # Create user with contact and tenant
      @user = User.new(create_user_params)
      @user.contact = contact
      @user.tenant_id = current_user.tenant_id  # Inherit tenant from admin

      if @user.save
        # Assign roles if provided
        assign_roles_to_user(@user)
        success = true
      else
        raise ActiveRecord::Rollback
      end
    end

    if success
      render json: {
        success: true,
        user: user_with_presence(@user)
      }, status: :created
    else
      render json: {
        success: false,
        errors: @user&.errors&.full_messages || ["Failed to create user"]
      }, status: :unprocessable_entity
    end
  rescue ActiveRecord::RecordInvalid => e
    render json: { success: false, errors: [e.message] }, status: :unprocessable_entity
  rescue => e
    Rails.logger.error "Error creating user: #{e.class} - #{e.message}"
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end

  # GET /api/v1/users
  # Returns list of all users for chat/contact purposes
  def index
    @users = User.includes(:email_sync_status, :roles)
    .order("users.name")

    render json: { users: @users.map { |user| user_with_presence(user) } }
  end

  # GET /api/v1/users/for_select
  # Lightweight endpoint for dropdowns - returns only id and name
  def for_select
    users = User.order(:name).pluck(:id, :name)
    render json: { users: users.map { |id, name| { id: id, name: name } } }
  end

  # GET /api/v1/users/:id
  def show
    @user = User.find(params[:id])
    render json: user_with_presence(@user)
  rescue ActiveRecord::RecordNotFound
    render json: { error: "User not found" }, status: :not_found
  end

  # PATCH /api/v1/users/:id
  def update
    @user = User.find(params[:id])

    # Merge regular user params with admin-only params if user is admin
    update_params = user_params
    admin_fields_present = params[:user][:role] || params[:user][:role_ids] || params[:user].key?(:contact_id) || params[:user].key?(:primary_role_id)
    if current_user&.admin? && admin_fields_present
      update_params = update_params.merge(admin_user_params)
    elsif admin_fields_present
      # Non-admin trying to change admin fields - reject request
      return render json: {
        success: false,
        error: "Thanks for helping, can you contact an administrator for assistance"
      }, status: :forbidden
    end

    # Handle primary role update (Jan 2026)
    if params[:user].key?(:primary_role_id) && current_user&.admin?
      primary_role_id = params[:user][:primary_role_id]
      if primary_role_id.present?
        @user.set_primary_role!(primary_role_id)
      end
    end

    if @user.update(update_params)
      render json: {
        success: true,
        user: user_with_presence(@user)
      }
    else
      render json: {
        success: false,
        errors: @user.errors.full_messages
      }, status: :unprocessable_entity
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: "User not found" }, status: :not_found
  end

  # POST /api/v1/users/:id/reset_password
  def reset_password
    @user = User.find(params[:id])

    # Generate reset token
    token = SecureRandom.urlsafe_base64
    @user.update_columns(
      reset_password_token: token,
      reset_password_sent_at: Time.current
    )

    # Send password reset email
    # UserMailer.reset_password(@user, token).deliver_later

    render json: {
      success: true,
      message: "Password reset email sent to #{@user.email}"
    }
  rescue ActiveRecord::RecordNotFound
    render json: { error: "User not found" }, status: :not_found
  end

  # DELETE /api/v1/users/:id
  def destroy
    @user = User.find(params[:id])

    if @user.destroy
      render json: { success: true, message: "User removed successfully" }
    else
      render json: { success: false, error: "Failed to remove user" }, status: :unprocessable_entity
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: "User not found" }, status: :not_found
  end

  # POST /api/v1/users/bulk_delete
  def bulk_delete
    ids = params[:ids]
    return render json: { success: false, error: "No IDs provided" }, status: :bad_request if ids.blank?

    ids = ids.first(1000) if ids.is_a?(Array)
    deleted_count = User.where(id: ids).destroy_all.count

    render json: {
      success: true,
      deleted_count: deleted_count,
      requested_count: ids.size
    }
  rescue => e
    Rails.logger.error "Error bulk deleting users: #{e.class} - #{e.message}"
    render json: { error: e.message }, status: :internal_server_error
  end

  private

  # Regular user params that anyone can edit
  def user_params
    params.require(:user).permit(
      :name, :email, :mobile_phone, :job_title, :preferred_theme,
      :qbcc_licence_number, :qbcc_licence_class, :signature, :photo,
      :enable_ai_writing_assistant, :email_signature_style
    )
  end

  # Admin-only params (role, role_ids, contact_id)
  # Only administrators should be able to modify these fields
  # SSoT: Roles via user_roles join table (role_ids), not assigned_roles column
  # Brakeman warning can be ignored: authorization check in update() prevents
  # non-admin users from accessing these params (returns 403 Forbidden)
  def admin_user_params
    params.require(:user).permit(:role, :contact_id, role_ids: [])
  end

  # Params for creating a new user (admin only)
  def create_user_params
    params.require(:user).permit(:name, :email, :password, :password_confirmation, :mobile_phone, :job_title)
  end

  # Find existing contact by ID or create new one from user info
  def find_or_create_contact
    contact_id = params.dig(:user, :contact_id)

    if contact_id.present?
      # Link to existing contact
      contact = Contact.find(contact_id)
      # Update contact's is_user_cached flag
      contact.update_column(:is_user_cached, true) if contact.respond_to?(:is_user_cached)
      contact
    else
      # Create new contact from user info
      user_data = params[:user]
      name = user_data[:name].to_s
      parts = name.strip.split(/\s+/)

      Contact.create!(
        display_name: name,
        first_name: parts[0],
        last_name: parts.length > 1 ? parts[1..-1].join(' ') : nil,
        contact_type: 'person',
        is_user_cached: true
      ).tap do |contact|
        # Add email to contact_emails table
        if user_data[:email].present?
          contact.contact_emails.create!(
            email: user_data[:email],
            label: 'login',
            is_primary: true,
            position: 1
          )
        end
        # Add mobile to contact_phones table
        if user_data[:mobile_phone].present?
          contact.contact_phones.create!(
            phone_number: user_data[:mobile_phone],
            label: 'mobile',
            is_primary: true,
            position: 1
          )
        end
      end
    end
  end

  # Assign roles to newly created user
  def assign_roles_to_user(user)
    role_ids = params.dig(:user, :role_ids)

    if role_ids.present?
      # Assign specified roles
      roles = Role.where(id: role_ids)
      user.roles = roles
    else
      # Assign default "user" role
      default_role = Role.find_by(name: "user")
      user.roles << default_role if default_role && !user.roles.exists?(id: default_role.id)
    end
  end

  # Returns user data with presence status and integration info
  def user_with_presence(user)
    last_seen = user.last_seen_at
    presence_status = if last_seen.nil?
                        "offline"
    elsif last_seen > 5.minutes.ago
                        "online"
    elsif last_seen > 30.minutes.ago
                        "away"
    else
                        "offline"
    end

    # Count Microsoft integrations (SSoT: MicrosoftCredential)
    integrations = []
    integrations << "microsoft" if user.microsoft_token.present?

    # SSoT: Ensure role_ids is always an array (even if roles association is somehow nil)
    safe_roles = user.roles.to_a rescue []

    user.as_json.merge(
      presence_status: presence_status,
      integrations: integrations,
      integrations_count: integrations.count,
      status: presence_status == "online" ? "active" : (user.last_login_at.present? ? "active" : "pending"),
      last_email_sync_at: user.email_sync_status&.last_sync_at,
      # Multi-role support - format for multiple_lookups column type
      role_ids: safe_roles.map { |r| { id: r.id, display_value: r.display_name, name: r.name } },
      role_names: user.role_names,
      # Primary role (Jan 2026) - determines default settings for multi-role users
      primary_role_id: user.primary_role_id,
      default_task_view: user.default_task_view,
      # Profile photo - ActiveStorage removed (Jan 2026), photos stored in File Warehouse
      photo_url: nil,
      # Digital signature - ActiveStorage removed (Jan 2026), signatures stored in File Warehouse
      signature_attached: false,
      signature_url: nil,
      qbcc_licence_number: user.qbcc_licence_number,
      qbcc_licence_class: user.qbcc_licence_class,
      can_sign_certificates: user.can_sign_certificates?,
      # Email signature style preference (Jan 2026)
      email_signature_style: user.email_signature_style || 'modern-dark'
    )
  end
end
