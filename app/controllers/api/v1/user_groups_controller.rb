class Api::V1::UserGroupsController < ApplicationController
  # GET /api/v1/user_groups
  def index
    render json: { groups: UserGroup.as_dropdown_options }
  end

  # POST /api/v1/user_groups
  def create
    @user_group = UserGroup.new(user_group_params)

    if @user_group.save
      render json: { success: true, group: { value: @user_group.name, label: @user_group.label } }, status: :created
    else
      render json: { success: false, error: @user_group.errors.full_messages.join(', ') }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/user_groups/:id
  # Accepts either ID or name
  def destroy
    @user_group = UserGroup.find_by(name: params[:id]) || UserGroup.find_by(id: params[:id])

    if @user_group.nil?
      render json: { error: 'Group not found' }, status: :not_found
      return
    end

    if @user_group.destroy
      render json: { success: true, message: 'Group deleted successfully' }
    else
      render json: { success: false, error: 'Failed to delete group' }, status: :unprocessable_entity
    end
  end

  private

  def user_group_params
    params.permit(:name, :label)
  end
end
