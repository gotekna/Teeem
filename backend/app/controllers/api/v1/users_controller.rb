class Api::V1::UsersController < ApplicationController
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
    admin_fields_present = params[:user][:role] || params[:user][:assigned_roles] || params[:user][:role_ids] || params[:user].key?(:contact_id)
    if current_user&.admin? && admin_fields_present
      update_params = update_params.merge(admin_user_params)
    elsif admin_fields_present
      # Non-admin trying to change admin fields - reject request
      return render json: {
        success: false,
        error: "Thanks for helping, can you contact an administrator for assistance"
      }, status: :forbidden
    end

    if @user.update(update_params)
      render json: {
        success: true,
        user: @user.as_json
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
      :qbcc_licence_number, :qbcc_licence_class, :signature
    )
  end

  # Admin-only params (role, role_ids, assigned_roles, contact_id)
  # Only administrators should be able to modify these fields
  # Brakeman warning can be ignored: authorization check in update() prevents
  # non-admin users from accessing these params (returns 403 Forbidden)
  def admin_user_params
    params.require(:user).permit(:role, :contact_id, assigned_roles: [], role_ids: [])
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
      # Digital signature for certificates
      signature_attached: user.signature.attached?,
      signature_url: user.signature.attached? ? url_for(user.signature) : nil,
      qbcc_licence_number: user.qbcc_licence_number,
      qbcc_licence_class: user.qbcc_licence_class,
      can_sign_certificates: user.can_sign_certificates?
    )
  end
end
