module Api
  module V1
    class SetupController < ApplicationController
      before_action :authorize_request
      before_action :check_admin_access

      # POST /api/v1/setup/pull_from_local
      def pull_from_local
        # This endpoint triggers the rake task to deploy setup data from CSV files
        # It deletes all existing setup data and imports fresh from local CSV exports

        require "rake"
        Rails.application.load_tasks

        begin
          # Run the deploy task
          Rake::Task["setup:deploy_setup_data"].invoke

          render json: {
            success: true,
            message: "Setup data successfully pulled from local and deployed",
            counts: {
              users: User.count,
              documentation_categories: DocumentationCategory.count,
              supervisor_checklist_templates: SupervisorChecklistTemplate.count,
              sm_schedule_master_templates: SmScheduleMasterTemplate.count,
              sm_schedule_master: SmScheduleMaster.count
            }
          }
        rescue StandardError => e
          Rails.logger.error("Failed to pull setup data from local: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))

          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/setup/sync_users
      def sync_users
        begin
          sync_data_type("users")
          render json: {
            success: true,
            message: "Users successfully synced",
            count: User.count
          }
        rescue StandardError => e
          handle_sync_error("users", e)
        end
      end

      # POST /api/v1/setup/sync_documentation_categories
      def sync_documentation_categories
        begin
          sync_data_type("documentation_categories")
          render json: {
            success: true,
            message: "Documentation categories successfully synced",
            count: DocumentationCategory.count
          }
        rescue StandardError => e
          handle_sync_error("documentation categories", e)
        end
      end

      # POST /api/v1/setup/sync_supervisor_checklists
      def sync_supervisor_checklists
        begin
          sync_data_type("supervisor_checklists")
          render json: {
            success: true,
            message: "Supervisor checklist templates successfully synced",
            count: SupervisorChecklistTemplate.count
          }
        rescue StandardError => e
          handle_sync_error("supervisor checklists", e)
        end
      end

      # POST /api/v1/setup/sync_folder_templates
      # DEPRECATED: FolderTemplate has been removed - EntityTab is now the SSoT for folder structure
      def sync_folder_templates
        render json: {
          success: false,
          message: "DEPRECATED: FolderTemplate has been removed. Folder structure is now defined in EntityTab hierarchy (Admin > System > Entity Tabs)."
        }, status: :gone
      end

      private

      def check_admin_access
        # Only admins or users who can create templates should be able to pull setup data
        unless @current_user&.can_create_templates?
          render json: { error: "Unauthorized - Admin access required" }, status: :forbidden
        end
      end

      def sync_data_type(type)
        require "csv"

        case type
        when "users"
          sync_users_data
        when "documentation_categories"
          sync_documentation_categories_data
        when "supervisor_checklists"
          sync_supervisor_checklists_data
        # NOTE: folder_templates removed - SSoT: EntityTab is now the source of truth
        end
      end

      def sync_users_data
        users_file = Rails.root.join("db", "import_data", "users.csv")
        raise "Users file not found" unless File.exist?(users_file)

        user_count = 0
        updated_count = 0

        CSV.foreach(users_file, headers: true, header_converters: :symbol) do |row|
          user = User.find_or_initialize_by(email: row[:email])

          if user.new_record?
            user.name = row[:name]
            user.password = row[:password] || "changeme123"
            user.save!
            # SSoT: Assign role via user_roles join table
            role_name = row[:role] || "user"
            role = Role.find_by(name: role_name)
            user.roles << role if role && !user.roles.include?(role)
            user_count += 1
          else
            user.update!(name: row[:name])
            # SSoT: Assign role via user_roles join table
            role_name = row[:role] || "user"
            role = Role.find_by(name: role_name)
            user.roles << role if role && !user.roles.include?(role)
            updated_count += 1
          end
        end

        Rails.logger.info("Created #{user_count} new users, updated #{updated_count} existing users")
      end

      def sync_documentation_categories_data
        doc_categories_file = Rails.root.join("db", "import_data", "documentation_categories.csv")
        raise "Documentation categories file not found" unless File.exist?(doc_categories_file)

        DocumentationCategory.delete_all

        CSV.foreach(doc_categories_file, headers: true, header_converters: :symbol) do |row|
          DocumentationCategory.create!(
            name: row[:name],
            icon: row[:icon],
            color: row[:color],
            description: row[:description],
            sequence_order: row[:sequence_order].to_i,
            is_active: row[:is_active] == "true"
          )
        end
      end

      def sync_supervisor_checklists_data
        checklist_templates_file = Rails.root.join("db", "import_data", "supervisor_checklist_templates.csv")
        raise "Supervisor checklist templates file not found" unless File.exist?(checklist_templates_file)

        SupervisorChecklistTemplate.delete_all

        CSV.foreach(checklist_templates_file, headers: true, header_converters: :symbol) do |row|
          SupervisorChecklistTemplate.create!(
            name: row[:name],
            description: row[:description],
            category: row[:category],
            response_type: row[:response_type] || "checkbox",
            sequence_order: row[:sequence_order].to_i,
            is_active: row[:is_active] == "true"
          )
        end
      end

      # NOTE: sync_folder_templates_data removed - SSoT: EntityTab is now the source of truth for folder structure

      def handle_sync_error(type, error)
        Rails.logger.error("Failed to sync #{type}: #{error.message}")
        Rails.logger.error(error.backtrace.join("\n"))

        render json: {
          success: false,
          error: error.message
        }, status: :unprocessable_entity
      end
    end
  end
end
