module Api
  module V1
    class PermissionsController < ApplicationController
      before_action :require_admin

      # GET /api/v1/permissions
      def index
        # Return all available permissions grouped by category
        permissions_data = {
          "System Administration" => [
            { id: 1, name: "manage_permissions", description: "Manage user permissions and roles" },
            { id: 2, name: "manage_users", description: "Create, edit, and delete users" },
            { id: 3, name: "manage_system", description: "Access system administration settings" }
          ],
          "Projects & Scheduling" => [
            { id: 4, name: "create_templates", description: "Create and manage schedule templates" },
            { id: 5, name: "edit_schedule", description: "Edit project schedules" },
            { id: 6, name: "edit_projects", description: "Edit project details" },
            { id: 7, name: "view_gantt", description: "View Gantt charts" }
          ],
          "Tasks & Workflows" => [
            { id: 8, name: "view_supervisor_tasks", description: "View supervisor tasks" },
            { id: 9, name: "view_builder_tasks", description: "View builder tasks" },
            { id: 10, name: "manage_workflows", description: "Manage workflow configurations" }
          ],
          "Company Settings" => [
            { id: 11, name: "manage_company_settings", description: "Manage company settings and preferences" },
            { id: 12, name: "manage_integrations", description: "Manage third-party integrations" }
          ],
          "Basic Access" => [
            { id: 13, name: "view_dashboard", description: "View the main dashboard" },
            { id: 14, name: "view_jobs", description: "View jobs and projects" },
            { id: 15, name: "view_contacts", description: "View contacts" }
          ]
        }

        categories = {
          "System Administration" => "System Administration",
          "Projects & Scheduling" => "Projects & Scheduling",
          "Tasks & Workflows" => "Tasks & Workflows",
          "Company Settings" => "Company Settings",
          "Basic Access" => "Basic Access"
        }

        render json: {
          success: true,
          permissions: permissions_data,
          categories: categories
        }
      end

      # GET /api/v1/permissions/roles
      def roles
        roles_data = Role.includes(:users).order(:position, :name).map do |role|
          {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            # SSoT: Use user_roles join table (role.users) not legacy role column
            users_count: role.users.count,
            # Schedule Master task count for this role
            tasks_count: SmTask.for_role(role.name).count,
            permissions: get_role_permissions(role.name)
          }
        end

        render json: {
          success: true,
          roles: roles_data
        }
      end

      # GET /api/v1/permissions/roles/:id/users
      # Returns users assigned to a specific role via user_roles join table
      def role_users
        role = Role.find(params[:id])
        users = role.users.order(:name).select(:id, :name, :email)

        render json: {
          success: true,
          role: {
            id: role.id,
            name: role.name,
            display_name: role.display_name
          },
          users: users.map { |u| { id: u.id, name: u.name, email: u.email } }
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Role not found" }, status: :not_found
      end

      # PATCH /api/v1/permissions/roles/:id
      def update_role
        role = Role.find(params[:id])
        role_params = params[:role] || params

        if role.update(
          display_name: role_params[:display_name],
          description: role_params[:description]
        )
          render json: {
            success: true,
            role: {
              id: role.id,
              name: role.name,
              display_name: role.display_name,
              description: role.description
            }
          }
        else
          render json: { success: false, errors: role.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/permissions/roles/:id
      def destroy_role
        role = Role.find(params[:id])

        # Prevent deleting roles that have users
        # SSoT: Use user_roles join table (role.users) not legacy role column
        users_count = role.users.count
        if users_count > 0
          return render json: {
            success: false,
            error: "Cannot delete role '#{role.display_name}' - #{users_count} user(s) are assigned to it"
          }, status: :unprocessable_entity
        end

        # Prevent deleting system roles
        if %w[user admin].include?(role.name)
          return render json: {
            success: false,
            error: "Cannot delete system role '#{role.display_name}'"
          }, status: :unprocessable_entity
        end

        role.destroy
        render json: { success: true }
      end

      # POST /api/v1/permissions/roles
      def create_role
        role_params = params[:role] || params
        name = role_params[:name]&.strip&.downcase&.gsub(/\s+/, '_')
        display_name = role_params[:display_name]&.strip || role_params[:name]&.strip&.titleize

        if name.blank?
          return render json: { success: false, error: "Role name is required" }, status: :unprocessable_entity
        end

        # Check if role already exists
        if Role.exists?(name: name)
          return render json: { success: false, error: "Role '#{name}' already exists" }, status: :unprocessable_entity
        end

        # Get next position
        max_position = Role.maximum(:position) || 0

        role = Role.new(
          name: name,
          display_name: display_name,
          position: max_position + 1,
          active: true
        )

        if role.save
          render json: {
            success: true,
            role: {
              id: role.id,
              name: role.name,
              display_name: role.display_name,
              value: role.name,
              label: role.display_name
            }
          }, status: :created
        else
          render json: {
            success: false,
            errors: role.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/permissions/user/:id
      def user_permissions
        user = User.find(params[:id])

        render json: {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          },
          permissions: user.permissions,
          role_permissions: get_role_permissions(user.role)
        }
      end

      # POST /api/v1/permissions/grant
      def grant
        # This is a placeholder for future implementation
        # For now, permissions are role-based only
        render json: {
          success: false,
          message: "Individual permission overrides are not yet implemented. Permissions are currently role-based only."
        }, status: :not_implemented
      end

      private

      # Note: require_admin is inherited from ApplicationController

      def get_role_permissions(role)
        # Create a temporary user instance to get permissions for a role
        temp_user = User.new(role: role)
        temp_user.permissions
      end
    end
  end
end
