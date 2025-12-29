class Api::V1::UserRolesController < ApplicationController
  # GET /api/v1/user_roles
  # SSoT: Returns roles from the roles table (not a constant)
  def index
    roles = Role.order(:name).map do |role|
      {
        id: role.id,
        value: role.name,
        label: role.display_name
      }
    end
    render json: { success: true, roles: roles }
  end

  # POST /api/v1/user_roles
  def create
    role_name = params[:name]&.downcase&.strip

    if role_name.blank?
      render json: { success: false, error: "Role name is required" }, status: :unprocessable_entity
      return
    end

    if Role.exists?(name: role_name)
      render json: { success: false, error: "Role already exists" }, status: :unprocessable_entity
      return
    end

    role = Role.create!(
      name: role_name,
      display_name: role_name.titleize
    )

    render json: { success: true, role: { id: role.id, value: role.name, label: role.display_name } }
  end

  # DELETE /api/v1/user_roles/:id
  def destroy
    role = Role.find_by(id: params[:id]) || Role.find_by(name: params[:id])

    unless role
      render json: { success: false, error: "Role not found" }, status: :not_found
      return
    end

    # Prevent deletion of core roles
    core_roles = %w[user admin]
    if core_roles.include?(role.name)
      render json: { success: false, error: "Cannot delete core system roles" }, status: :forbidden
      return
    end

    # Check if any users have this role
    if role.users.any?
      render json: { success: false, error: "Cannot delete role that is assigned to users" }, status: :unprocessable_entity
      return
    end

    role.destroy!
    render json: { success: true }
  end
end
