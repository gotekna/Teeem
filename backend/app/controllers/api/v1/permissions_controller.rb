module Api
  module V1
    class PermissionsController < ApplicationController
      before_action :require_admin, except: [ :index, :sections, :user_permissions ]
      before_action -> { require_permission("settings", :view_all) }, only: [ :index, :sections, :user_permissions ]

      # GET /api/v1/permissions
      # Returns section-based permission data from PermissionSection table (DB-driven)
      def index
        sections_data = PermissionSection.ordered.map do |ps|
          {
            key: ps.key,
            section: ps.section,
            subFeature: ps.sub_feature,
            displayName: ps.display_name,
            description: ps.description,
            position: ps.position,
            isSectionHeader: ps.is_section_header,
            availableLevels: ps.available_levels
          }
        end

        render json: {
          success: true,
          sections: sections_data
        }
      end

      # GET /api/v1/permissions/roles
      def roles
        # FRC (Feb 2026): Batch load task counts to avoid N+1 (was 1 COUNT per role)
        # SmTask has no role column - join through assigned_user → roles
        task_counts_by_role = SmTask
          .joins(assigned_user: :roles)
          .group("roles.name")
          .count

        roles_data = Role.includes(:users).order(:position, :name).map do |role|
          {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            # SSoT: Use user_roles join table (role.users) not legacy role column
            users_count: role.users.size,  # .size uses eager-loaded collection (not .count which hits DB)
            # Schedule Master task count for this role
            tasks_count: task_counts_by_role[role.name] || 0,
            permissions: get_role_permissions(role.name),
            # Role settings (Jan 2026)
            settings: role.settings || {},
            default_task_view: role.default_task_view,
            default_theme: role.default_theme,
            sidebar_collapsed: role.sidebar_collapsed?
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
        users = role.users.order(:name)

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
        render_error("Role not found", status: :not_found)
      end

      # PATCH /api/v1/permissions/roles/:id
      def update_role
        role = Role.find(params[:id])
        role_params = params[:role] || params

        # Update basic fields
        role.display_name = role_params[:display_name] if role_params[:display_name].present?
        role.description = role_params[:description] if role_params.key?(:description)

        # Update settings if provided (Jan 2026)
        if role_params[:settings].present?
          role.update_settings(role_params[:settings])
        end

        # Individual setting fields (alternative to nested settings object)
        if role_params[:default_task_view].present?
          role.default_task_view = role_params[:default_task_view]
        end
        if role_params[:default_theme].present?
          role.default_theme = role_params[:default_theme]
        end
        if role_params.key?(:sidebar_collapsed)
          role.sidebar_collapsed = role_params[:sidebar_collapsed]
        end

        if role.save
          render json: {
            success: true,
            role: {
              id: role.id,
              name: role.name,
              display_name: role.display_name,
              description: role.description,
              settings: role.settings,
              default_task_view: role.default_task_view,
              default_theme: role.default_theme,
              sidebar_collapsed: role.sidebar_collapsed?
            }
          }
        else
          render_validation_errors(role)
        end
      end

      # DELETE /api/v1/permissions/roles/:id
      def destroy_role
        role = Role.find(params[:id])

        # Prevent deleting roles that have users
        # SSoT: Use user_roles join table (role.users) not legacy role column
        users_count = role.users.count
        if users_count > 0
          return render_error("Cannot delete role '#{role.display_name}' - #{users_count} user(s) are assigned to it", status: :unprocessable_entity)
        end

        # Prevent deleting system roles
        if %w[user admin].include?(role.name)
          return render_error("Cannot delete system role '#{role.display_name}'", status: :unprocessable_entity)
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
          return render_error("Role name is required", status: :unprocessable_entity)
        end

        # Check if role already exists
        if Role.exists?(name: name)
          return render_error("Role '#{name}' already exists", status: :unprocessable_entity)
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
          render_validation_errors(role)
        end
      end

      # GET /api/v1/permissions/user/:id
      def user_permissions
        user = User.includes(:roles).find(params[:id])
        role_ids_arr = user.roles.pluck(:id)

        # Per-role breakdown: { role_name => { key => level } }
        role_section_perms = {}
        user.roles.each do |role|
          role_section_perms[role.display_name || role.name] =
            role.role_section_permissions.pluck(:permission_key, :level).to_h
        end

        render json: {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role_names: user.role_names
          },
          section_permissions: user.section_permissions_hash,
          role_section_permissions: role_section_perms,
          permissions: user.permissions,
          role_permissions: user.role_names.flat_map { |r| get_role_permissions(r) }.uniq
        }
      end

      # POST /api/v1/permissions/grant
      def grant
        render json: {
          success: false,
          message: "Individual permission overrides are not yet implemented. Permissions are currently role-based only."
        }, status: :not_implemented
      end

      # =========================================================================
      # Section-Level Permission Endpoints (Mar 2026)
      # SSoT: DB-driven permission management via PermissionSection + RoleSectionPermission
      # =========================================================================

      # GET /api/v1/permissions/sections
      # Returns all configurable permission sections grouped by section
      def sections
        sections_data = PermissionSection.ordered.map do |ps|
          {
            key: ps.key,
            section: ps.section,
            subFeature: ps.sub_feature,
            displayName: ps.display_name,
            description: ps.description,
            position: ps.position,
            isSectionHeader: ps.is_section_header,
            availableLevels: ps.available_levels
          }
        end

        render json: { success: true, sections: sections_data }
      end

      # GET /api/v1/permissions/roles/:id/section_permissions
      # Returns permission levels for a specific role
      def role_section_permissions
        role = Role.find(params[:id])
        perms = role.role_section_permissions.pluck(:permission_key, :level).to_h

        render json: {
          success: true,
          role: {
            id: role.id,
            name: role.name,
            displayName: role.display_name,
            description: role.description,
            godViewAccess: role.god_view_access,
            canApprovePayments: role.can_approve_payments,
            canViewConfidentialFields: role.can_view_confidential_fields
          },
          permissions: perms
        }
      rescue ActiveRecord::RecordNotFound
        render_error("Role not found", status: :not_found)
      end

      # PUT /api/v1/permissions/roles/:id/section_permissions
      # Save all permission levels for a role
      def update_section_permissions
        role = Role.find(params[:id])

        # Prevent editing system admin role's core permissions
        # (admin role always has full access via bypass)

        ActiveRecord::Base.transaction do
          # Update special permission flags on role
          if params.key?(:godViewAccess)
            role.god_view_access = params[:godViewAccess]
          end
          if params.key?(:canApprovePayments)
            role.can_approve_payments = params[:canApprovePayments]
          end
          if params.key?(:canViewConfidentialFields)
            role.can_view_confidential_fields = params[:canViewConfidentialFields]
          end
          role.save! if role.changed?

          # Update section permissions
          permissions = params[:permissions]
          if permissions.present?
            permissions.each do |key, level|
              level_int = level.to_i

              rsp = RoleSectionPermission.find_or_initialize_by(role: role, permission_key: key.to_s)
              rsp.level = level_int
              rsp.save!
            end
          end
        end

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render_error("Role not found", status: :not_found)
      rescue ActiveRecord::RecordInvalid => e
        render_error(e.message, status: :unprocessable_entity)
      end

      # POST /api/v1/permissions/roles/:id/copy_from
      # Copy permissions from a source role
      def copy_from
        target_role = Role.find(params[:id])
        source_role = Role.find(params[:sourceRoleId])

        ActiveRecord::Base.transaction do
          # Delete existing permissions for target
          target_role.role_section_permissions.delete_all

          # Copy all permissions from source
          source_role.role_section_permissions.each do |rsp|
            RoleSectionPermission.create!(
              role: target_role,
              permission_key: rsp.permission_key,
              level: rsp.level
            )
          end

          # Copy special flags
          target_role.update!(
            god_view_access: source_role.god_view_access,
            can_approve_payments: source_role.can_approve_payments,
            can_view_confidential_fields: source_role.can_view_confidential_fields
          )
        end

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render_error("Role not found", status: :not_found)
      rescue ActiveRecord::RecordInvalid => e
        render_error(e.message, status: :unprocessable_entity)
      end

      private

      def get_role_permissions(role_name)
        base = [ "view_dashboard", "view_jobs", "view_contacts" ]
        base + User.new.permissions_for_role(role_name)
      end
    end
  end
end
