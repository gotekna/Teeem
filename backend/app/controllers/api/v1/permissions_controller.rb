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
        roles_data = User::ROLES.map do |role|
          {
            name: role,
            display_name: role.titleize,
            permissions: get_role_permissions(role)
          }
        end

        render json: {
          success: true,
          roles: roles_data
        }
      end

      # POST /api/v1/permissions/roles
      def create_role
        name = params[:name]&.strip&.downcase&.gsub(/\s+/, '_')
        display_name = params[:display_name]&.strip || params[:name]&.strip&.titleize

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
