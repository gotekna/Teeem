module Api
  module V1
    class SetupController < ApplicationController
      before_action :authorize_request
      before_action :check_admin_access

      # POST /api/v1/setup/pull_from_local
      def pull_from_local
        # This endpoint triggers the rake task to deploy setup data from CSV files
        # It deletes all existing setup data and imports fresh from local CSV exports

        require 'rake'
        Rails.application.load_tasks

        begin
          # Run the deploy task
          Rake::Task['setup:deploy_setup_data'].invoke

          render json: {
            success: true,
            message: 'Setup data successfully pulled from local and deployed',
            counts: {
              users: User.count,
              documentation_categories: DocumentationCategory.count,
              supervisor_checklist_templates: SupervisorChecklistTemplate.count,
              schedule_templates: ScheduleTemplate.count,
              schedule_template_rows: ScheduleTemplateRow.count
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
          sync_data_type('users')
          render json: {
            success: true,
            message: 'Users successfully synced',
            count: User.count
          }
        rescue StandardError => e
          handle_sync_error('users', e)
        end
      end

      # POST /api/v1/setup/sync_documentation_categories
      def sync_documentation_categories
        begin
          sync_data_type('documentation_categories')
          render json: {
            success: true,
            message: 'Documentation categories successfully synced',
            count: DocumentationCategory.count
          }
        rescue StandardError => e
          handle_sync_error('documentation categories', e)
        end
      end

      # POST /api/v1/setup/sync_supervisor_checklists
      def sync_supervisor_checklists
        begin
          sync_data_type('supervisor_checklists')
          render json: {
            success: true,
            message: 'Supervisor checklist templates successfully synced',
            count: SupervisorChecklistTemplate.count
          }
        rescue StandardError => e
          handle_sync_error('supervisor checklists', e)
        end
      end

      # POST /api/v1/setup/sync_schedule_templates
      def sync_schedule_templates
        begin
          sync_data_type('schedule_templates')
          render json: {
            success: true,
            message: 'Schedule templates successfully synced',
            counts: {
              templates: ScheduleTemplate.count,
              rows: ScheduleTemplateRow.count
            }
          }
        rescue StandardError => e
          handle_sync_error('schedule templates', e)
        end
      end

      # POST /api/v1/setup/sync_folder_templates
      def sync_folder_templates
        begin
          sync_data_type('folder_templates')
          render json: {
            success: true,
            message: 'Folder templates successfully synced',
            counts: {
              templates: FolderTemplate.count,
              items: FolderTemplateItem.count
            }
          }
        rescue StandardError => e
          handle_sync_error('folder templates', e)
        end
      end

      private

      def check_admin_access
        # Only admins or users who can create templates should be able to pull setup data
        unless @current_user&.can_create_templates?
          render json: { error: 'Unauthorized - Admin access required' }, status: :forbidden
        end
      end

      def sync_data_type(type)
        require 'csv'

        case type
        when 'users'
          sync_users_data
        when 'documentation_categories'
          sync_documentation_categories_data
        when 'supervisor_checklists'
          sync_supervisor_checklists_data
        when 'schedule_templates'
          sync_schedule_templates_data
        when 'folder_templates'
          sync_folder_templates_data
        end
      end

      def sync_users_data
        users_file = Rails.root.join('db', 'import_data', 'users.csv')
        raise "Users file not found" unless File.exist?(users_file)

        user_count = 0
        updated_count = 0

        CSV.foreach(users_file, headers: true, header_converters: :symbol) do |row|
          user = User.find_or_initialize_by(email: row[:email])

          if user.new_record?
            user.name = row[:name]
            user.password = row[:password] || 'changeme123'
            user.role = row[:role] || 'user'
            user.save!
            user_count += 1
          else
            user.update!(
              name: row[:name],
              role: row[:role] || 'user'
            )
            updated_count += 1
          end
        end

        Rails.logger.info("Created #{user_count} new users, updated #{updated_count} existing users")
      end

      def sync_documentation_categories_data
        doc_categories_file = Rails.root.join('db', 'import_data', 'documentation_categories.csv')
        raise "Documentation categories file not found" unless File.exist?(doc_categories_file)

        DocumentationCategory.delete_all

        CSV.foreach(doc_categories_file, headers: true, header_converters: :symbol) do |row|
          DocumentationCategory.create!(
            name: row[:name],
            icon: row[:icon],
            color: row[:color],
            description: row[:description],
            sequence_order: row[:sequence_order].to_i,
            is_active: row[:is_active] == 'true'
          )
        end
      end

      def sync_supervisor_checklists_data
        checklist_templates_file = Rails.root.join('db', 'import_data', 'supervisor_checklist_templates.csv')
        raise "Supervisor checklist templates file not found" unless File.exist?(checklist_templates_file)

        SupervisorChecklistTemplate.delete_all

        CSV.foreach(checklist_templates_file, headers: true, header_converters: :symbol) do |row|
          SupervisorChecklistTemplate.create!(
            name: row[:name],
            description: row[:description],
            category: row[:category],
            response_type: row[:response_type] || 'checkbox',
            sequence_order: row[:sequence_order].to_i,
            is_active: row[:is_active] == 'true'
          )
        end
      end

      def sync_schedule_templates_data
        schedule_templates_file = Rails.root.join('db', 'import_data', 'schedule_templates.csv')
        schedule_rows_file = Rails.root.join('db', 'import_data', 'schedule_template_rows.csv')

        raise "Schedule templates file not found" unless File.exist?(schedule_templates_file)
        raise "Schedule template rows file not found" unless File.exist?(schedule_rows_file)

        # Delete existing data
        ScheduleTemplateRow.delete_all
        ScheduleTemplate.delete_all

        # Import templates
        template_map = {}
        creator = User.first || User.create!(
          email: 'system@teeem.com',
          name: 'System',
          password: SecureRandom.hex(20)
        )

        CSV.foreach(schedule_templates_file, headers: true, header_converters: :symbol) do |row|
          template = ScheduleTemplate.create!(
            name: row[:name],
            description: row[:description],
            is_default: row[:is_default] == 'true',
            created_by: creator
          )
          template_map[row[:id].to_i] = template.id
        end

        # Import rows
        CSV.foreach(schedule_rows_file, headers: true, header_converters: :symbol) do |row|
          template_id = template_map[row[:schedule_template_id].to_i]
          next unless template_id

          predecessor_ids = row[:predecessor_ids].present? ? JSON.parse(row[:predecessor_ids]) : []
          price_book_item_ids = row[:price_book_item_ids].present? ? JSON.parse(row[:price_book_item_ids]) : []
          documentation_category_ids = row[:documentation_category_ids].present? ? JSON.parse(row[:documentation_category_ids]) : []
          supervisor_checklist_template_ids = row[:supervisor_checklist_template_ids].present? ? JSON.parse(row[:supervisor_checklist_template_ids]) : []
          tags = row[:tags].present? ? JSON.parse(row[:tags]) : []
          subtask_names = row[:subtask_names].present? ? JSON.parse(row[:subtask_names]) : []
          linked_task_ids = row[:linked_task_ids].present? ? JSON.parse(row[:linked_task_ids]) : []

          attributes = {
            schedule_template_id: template_id,
            name: row[:name],
            supplier_id: row[:supplier_id].present? ? row[:supplier_id].to_i : nil,
            assigned_user_id: row[:assigned_user_id].present? ? row[:assigned_user_id].to_i : nil,
            predecessor_ids: predecessor_ids,
            po_required: row[:po_required] == 'true',
            create_po_on_job_start: row[:create_po_on_job_start] == 'true',
            critical_po: row[:critical_po] == 'true',
            price_book_item_ids: price_book_item_ids,
            documentation_category_ids: documentation_category_ids,
            tags: tags,
            require_photo: row[:require_photo] == 'true',
            require_certificate: row[:require_certificate] == 'true',
            cert_lag_days: row[:cert_lag_days].present? ? row[:cert_lag_days].to_i : nil,
            require_supervisor_check: row[:require_supervisor_check] == 'true',
            auto_complete_predecessors: row[:auto_complete_predecessors] == 'true',
            has_subtasks: row[:has_subtasks] == 'true',
            subtask_count: row[:subtask_count].present? ? row[:subtask_count].to_i : nil,
            subtask_names: subtask_names,
            sequence_order: row[:sequence_order].to_i,
            linked_task_ids: linked_task_ids,
            linked_template_id: row[:linked_template_id].present? ? row[:linked_template_id].to_i : nil
          }

          if ScheduleTemplateRow.column_names.include?('supervisor_checklist_template_ids')
            attributes[:supervisor_checklist_template_ids] = supervisor_checklist_template_ids
          end

          ScheduleTemplateRow.create!(attributes)
        end
      end

      def sync_folder_templates_data
        folder_templates_file = Rails.root.join('db', 'import_data', 'folder_templates.csv')
        folder_template_items_file = Rails.root.join('db', 'import_data', 'folder_template_items.csv')

        raise "Folder templates file not found" unless File.exist?(folder_templates_file)
        raise "Folder template items file not found" unless File.exist?(folder_template_items_file)

        # Delete existing data
        FolderTemplateItem.delete_all
        FolderTemplate.delete_all

        # Import templates
        template_map = {}

        CSV.foreach(folder_templates_file, headers: true, header_converters: :symbol) do |row|
          template = FolderTemplate.create!(
            name: row[:name],
            template_type: row[:template_type],
            is_system_default: row[:is_system_default] == 'true',
            is_active: row[:is_active] == 'true'
          )
          template_map[row[:id].to_i] = template.id
        end

        # Import items
        item_map = {}
        CSV.foreach(folder_template_items_file, headers: true, header_converters: :symbol) do |row|
          template_id = template_map[row[:folder_template_id].to_i]
          next unless template_id

          item = FolderTemplateItem.create!(
            folder_template_id: template_id,
            name: row[:name],
            level: row[:level].to_i,
            order: row[:order].to_i,
            parent_id: nil,  # Will be set in second pass
            description: row[:description]
          )
          item_map[row[:id].to_i] = item.id
        end

        # Second pass to set parent_ids
        CSV.foreach(folder_template_items_file, headers: true, header_converters: :symbol) do |row|
          if row[:parent_id].present?
            item_id = item_map[row[:id].to_i]
            parent_id = item_map[row[:parent_id].to_i]
            if item_id && parent_id
              FolderTemplateItem.find(item_id).update!(parent_id: parent_id)
            end
          end
        end
      end

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
