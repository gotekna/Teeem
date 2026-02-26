class Api::V1::UserGroupsController < ApplicationController
  # GET /api/v1/groups or /api/v1/user_groups
  def index
    # FRC (Feb 2026): Batch load user counts to avoid N+1 (was 1 COUNT per group)
    group_counts = User.group(:user_group_id).count
    groups = UserGroup.order(:name).map do |group|
      {
        id: group.id,
        name: group.name,
        description: group.label,
        members_count: group_counts[group.id] || 0
      }
    end
    render json: groups
  end

  # POST /api/v1/groups or /api/v1/user_groups
  def create
    @user_group = UserGroup.new(user_group_params)

    if @user_group.save
      render json: {
        success: true,
        group: {
          id: @user_group.id,
          name: @user_group.name,
          description: @user_group.label,
          members_count: 0
        }
      }, status: :created
    else
      render_validation_errors(@user_group)
    end
  end

  # PATCH /api/v1/groups/:id
  def update
    @user_group = UserGroup.find_by(id: params[:id]) || UserGroup.find_by(name: params[:id])

    if @user_group.nil?
      return render json: { error: "Group not found" }, status: :not_found
    end

    if @user_group.update(user_group_params)
      render json: { success: true, group: { id: @user_group.id, name: @user_group.name, description: @user_group.label } }
    else
      render_validation_errors(@user_group)
    end
  end

  # DELETE /api/v1/groups/:id or /api/v1/user_groups/:id
  # Accepts either ID or name
  def destroy
    @user_group = UserGroup.find_by(id: params[:id]) || UserGroup.find_by(name: params[:id])

    if @user_group.nil?
      return render json: { error: "Group not found" }, status: :not_found
    end

    # Check if any users are in this group
    users_count = User.where(user_group_id: @user_group.id).count
    if users_count > 0
      return render_error("Cannot delete group '#{@user_group.label}' - #{users_count} user(s) are assigned to it", status: :unprocessable_entity)
    end

    if @user_group.destroy
      render json: { success: true, message: "Group deleted successfully" }
    else
      render_error("Failed to delete group", status: :unprocessable_entity)
    end
  end

  private

  def user_group_params
    params.permit(:name, :label, :description, group: [ :name, :description ])
      .tap do |p|
        # Handle nested group params
        if p[:group].present?
          p[:name] ||= p[:group][:name]
          p[:label] ||= p[:group][:description] || p[:group][:name]
        end
        # Map description to label
        p[:label] ||= p[:description] if p[:description].present?
      end
      .slice(:name, :label)
  end
end
