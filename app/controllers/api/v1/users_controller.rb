class Api::V1::UsersController < ApplicationController
  # GET /api/v1/users
  # Returns list of all users for chat/contact purposes
  def index
    @users = User.select(:id, :name, :email, :mobile_phone, :role, :assigned_role, :last_login_at).order(:name)
    render json: @users.as_json(only: [:id, :name, :email, :mobile_phone, :role, :assigned_role, :last_login_at])
  end

  # GET /api/v1/users/:id
  def show
    @user = User.find(params[:id])
    render json: @user.as_json(only: [:id, :name, :email, :mobile_phone, :role, :assigned_role, :last_login_at])
  rescue ActiveRecord::RecordNotFound
    render json: { error: 'User not found' }, status: :not_found
  end

  # PATCH /api/v1/users/:id
  def update
    @user = User.find(params[:id])

    if @user.update(user_params)
      render json: {
        success: true,
        user: @user.as_json(only: [:id, :name, :email, :mobile_phone, :role, :assigned_role, :last_login_at])
      }
    else
      render json: {
        success: false,
        errors: @user.errors.full_messages
      }, status: :unprocessable_entity
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: 'User not found' }, status: :not_found
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
    render json: { error: 'User not found' }, status: :not_found
  end

  # DELETE /api/v1/users/:id
  def destroy
    @user = User.find(params[:id])

    if @user.destroy
      render json: { success: true, message: 'User removed successfully' }
    else
      render json: { success: false, error: 'Failed to remove user' }, status: :unprocessable_entity
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: 'User not found' }, status: :not_found
  end

  # POST /api/v1/users/bulk_delete
  def bulk_delete
    ids = params[:ids]
    return render json: { success: false, error: 'No IDs provided' }, status: :bad_request if ids.blank?

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

  def user_params
    params.require(:user).permit(:name, :email, :mobile_phone, :role, :assigned_role)
  end
end
