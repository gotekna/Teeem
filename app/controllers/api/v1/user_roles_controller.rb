class Api::V1::UserRolesController < ApplicationController
  # GET /api/v1/user_roles
  def index
    roles = User::ROLES.map do |role|
      {
        value: role,
        label: role.titleize
      }
    end
    render json: { roles: roles }
  end

  # POST /api/v1/user_roles
  def create
    role_name = params[:name]&.downcase&.strip

    if role_name.blank?
      render json: { error: "Role name is required" }, status: :unprocessable_entity
      return
    end

    if User::ROLES.include?(role_name)
      render json: { error: "Role already exists" }, status: :unprocessable_entity
      return
    end

    # Add role to the ROLES constant (this requires modifying the User model file)
    # For now, we'll store it in a database table
    # TODO: Implement dynamic role storage

    render json: { error: "Dynamic role creation not yet implemented. Please add roles directly to the User model." }, status: :not_implemented
  end

  # DELETE /api/v1/user_roles/:id
  def destroy
    role_name = params[:id]

    # Prevent deletion of core roles
    core_roles = %w[user admin]
    if core_roles.include?(role_name)
      render json: { error: "Cannot delete core system roles" }, status: :forbidden
      return
    end

    # TODO: Implement dynamic role deletion
    render json: { error: "Dynamic role deletion not yet implemented. Please remove roles directly from the User model." }, status: :not_implemented
  end
end
