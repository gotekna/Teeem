module Api
  module V1
    class SchemaController < ApplicationController
      # GET /api/v1/schema
      def index
        # Get all user-defined tables with their columns and relationships
        user_tables = Table.includes(:columns).all

        # Build relationships map for user tables
        user_relationships = []
        Column.where(column_type: 'lookup').includes(:table, :lookup_table).each do |col|
          next unless col.lookup_table

          user_relationships << {
            id: "rel_#{col.id}",
            from_table_id: "user_#{col.table_id}",
            from_table_name: col.table.name,
            from_table_slug: col.table.slug,
            from_column_name: col.name,
            to_table_id: "user_#{col.lookup_table_id}",
            to_table_name: col.lookup_table.name,
            to_table_slug: col.lookup_table.slug,
            relationship_type: col.is_multiple ? 'many_to_many' : 'many_to_one',
            required: col.required
          }
        end

        # Format user tables data
        user_tables_data = user_tables.map do |table|
          {
            id: "user_#{table.id}",
            name: table.name,
            slug: table.slug,
            database_table_name: table.database_table_name,
            description: table.description,
            is_live: table.is_live,
            is_system: false,
            icon: table.icon,
            record_count: get_record_count(table),
            columns: table.columns.order(:position).map do |col|
              {
                id: col.id,
                name: col.name,
                column_name: col.column_name,
                column_type: col.column_type,
                required: col.required,
                is_unique: col.is_unique,
                is_title: col.is_title,
                lookup_table_id: col.lookup_table_id,
                lookup_table_name: col.lookup_table&.name,
                is_multiple: col.is_multiple
              }
            end
          }
        end

        # Get system tables and their foreign keys
        excluded_tables = [
          'ar_internal_metadata',
          'schema_migrations',
          'solid_queue_blocked_executions',
          'solid_queue_claimed_executions',
          'solid_queue_failed_executions',
          'solid_queue_jobs',
          'solid_queue_pauses',
          'solid_queue_processes',
          'solid_queue_ready_executions',
          'solid_queue_recurring_executions',
          'solid_queue_recurring_tasks',
          'solid_queue_scheduled_executions',
          'solid_queue_semaphores',
          'tables',
          'columns',
          'versions'
        ]

        all_db_tables = ActiveRecord::Base.connection.tables
        system_tables = all_db_tables.reject { |t| t.start_with?('user_') || excluded_tables.include?(t) }

        system_tables_data = system_tables.map do |table_name|
          columns = get_system_table_columns(table_name)
          record_count = get_system_table_record_count(table_name)

          {
            id: "system_#{table_name}",
            name: table_name.titleize,
            slug: table_name.parameterize,
            database_table_name: table_name,
            description: nil,
            is_live: true,
            is_system: true,
            icon: get_system_table_icon(table_name),
            record_count: record_count,
            columns: columns
          }
        end

        # Get system table foreign key relationships
        system_relationships = get_system_table_relationships(system_tables)
        all_relationships = user_relationships + system_relationships

        all_tables = user_tables_data + system_tables_data

        render json: {
          success: true,
          tables: all_tables,
          relationships: all_relationships,
          stats: {
            total_tables: all_tables.count,
            user_tables: user_tables_data.count,
            system_tables: system_tables_data.count,
            live_tables: user_tables.where(is_live: true).count,
            total_relationships: all_relationships.count,
            total_columns: Column.count + system_tables_data.sum { |t| t[:columns].count }
          }
        }
      end

      # GET /api/v1/schema/tables
      def tables
        # Get all user-defined tables from the tables table
        user_tables = Table.includes(:columns).all.map do |table|
          {
            id: table.id,
            name: table.name,
            slug: table.slug,
            database_table_name: table.database_table_name,
            plural_name: table.plural_name,
            icon: table.icon,
            is_live: table.is_live,
            columns_count: table.columns.count,
            record_count: begin
              table.dynamic_model.count
            rescue
              0
            end,
            type: table.database_table_name.include?('_import_') ? 'import' : 'user',
            created_at: table.created_at,
            updated_at: table.updated_at
          }
        end

        # Get system tables (exclude Rails internal and SolidQueue tables)
        excluded_tables = [
          'ar_internal_metadata',
          'schema_migrations',
          'solid_queue_blocked_executions',
          'solid_queue_claimed_executions',
          'solid_queue_failed_executions',
          'solid_queue_jobs',
          'solid_queue_pauses',
          'solid_queue_processes',
          'solid_queue_ready_executions',
          'solid_queue_recurring_executions',
          'solid_queue_recurring_tasks',
          'solid_queue_scheduled_executions',
          'solid_queue_semaphores',
          'tables',
          'columns',
          'versions'
        ]

        all_db_tables = ActiveRecord::Base.connection.tables
        system_tables = all_db_tables.reject { |t| t.start_with?('user_') || excluded_tables.include?(t) }

        system_table_data = system_tables.map do |table_name|
          # Get column count
          columns_count = begin
            ActiveRecord::Base.connection.columns(table_name).count
          rescue
            0
          end

          # Get record count
          record_count = begin
            ActiveRecord::Base.connection.select_value("SELECT COUNT(*) FROM #{table_name}")
          rescue
            0
          end

          {
            id: "system_#{table_name}",
            name: table_name.titleize,
            slug: table_name.parameterize,
            database_table_name: table_name,
            plural_name: table_name.titleize,
            icon: nil,
            is_live: true,
            columns_count: columns_count,
            record_count: record_count,
            type: 'system',
            created_at: nil,
            updated_at: nil
          }
        end

        all_tables = user_tables + system_table_data

        render json: {
          success: true,
          tables: all_tables
        }
      end

      # GET /api/v1/schema/in_memory_tables
      # Returns registry of system tables (formerly "in-memory" tables)
      # These are now properly registered in the tables table with numeric IDs
      def in_memory_tables
        # Get all system tables from the database
        system_tables = Table.where(table_type: 'system').order(:name)

        tables = system_tables.map do |table|
          {
            table_id: table.id,
            legacy_id: table.slug, # Keep slug for backwards compatibility
            name: table.name,
            slug: table.slug,
            icon: table.icon,
            file: table.file_location,
            model: table.model_class,
            description: table.description,
            has_saved_views: table.has_saved_views,
            api_endpoint: table.api_endpoint,
            is_live: table.is_live,
            created_at: table.created_at,
            updated_at: table.updated_at
          }
        end

        render json: {
          success: true,
          tables: tables,
          count: tables.length,
          note: 'System tables now have proper numeric IDs in the tables registry. The legacy_id (slug) is preserved for backwards compatibility with existing saved views.'
        }
      end

      # GET /api/v1/schema/system_table_columns/:table_name
      def system_table_columns
        table_name = params[:table_name]

        # Security: Validate that the table exists and is not in excluded list
        excluded_tables = [
          'ar_internal_metadata',
          'schema_migrations',
          'solid_queue_blocked_executions',
          'solid_queue_claimed_executions',
          'solid_queue_failed_executions',
          'solid_queue_jobs',
          'solid_queue_pauses',
          'solid_queue_processes',
          'solid_queue_ready_executions',
          'solid_queue_recurring_executions',
          'solid_queue_recurring_tasks',
          'solid_queue_scheduled_executions',
          'solid_queue_semaphores',
          'tables',
          'columns',
          'versions'
        ]

        unless ActiveRecord::Base.connection.table_exists?(table_name)
          render json: { error: 'Table not found' }, status: :not_found
          return
        end

        if table_name.start_with?('user_') || excluded_tables.include?(table_name)
          render json: { error: 'Access denied' }, status: :forbidden
          return
        end

        # Get column information
        columns = ActiveRecord::Base.connection.columns(table_name).map do |col|
          {
            name: col.name,
            type: col.sql_type,
            nullable: col.null,
            default: col.default
          }
        end

        render json: {
          success: true,
          columns: columns
        }
      rescue => e
        Rails.logger.error "Failed to fetch columns for #{table_name}: #{e.message}"
        render json: { error: 'Failed to fetch table columns' }, status: :internal_server_error
      end

      private

      def get_record_count(table)
        table.dynamic_model.count
      rescue
        0
      end

      def get_system_table_record_count(table_name)
        ActiveRecord::Base.connection.select_value("SELECT COUNT(*) FROM #{ActiveRecord::Base.connection.quote_table_name(table_name)}")
      rescue
        0
      end

      def get_system_table_columns(table_name)
        ActiveRecord::Base.connection.columns(table_name).map do |col|
          {
            id: "#{table_name}_#{col.name}",
            name: col.name.titleize,
            column_name: col.name,
            column_type: map_sql_type_to_display(col.sql_type),
            required: !col.null,
            is_unique: false,
            is_title: col.name == 'name' || col.name == 'title',
            is_multiple: false
          }
        end
      rescue => e
        Rails.logger.error "Failed to get columns for #{table_name}: #{e.message}"
        []
      end

      def get_system_table_relationships(system_tables)
        relationships = []

        system_tables.each do |table_name|
          foreign_keys = ActiveRecord::Base.connection.foreign_keys(table_name)

          foreign_keys.each do |fk|
            # Only include relationships where both tables are in our system tables list
            next unless system_tables.include?(fk.to_table)

            relationships << {
              id: "fk_#{table_name}_#{fk.column}",
              from_table_id: "system_#{table_name}",
              from_table_name: table_name.titleize,
              from_table_slug: table_name.parameterize,
              from_column_name: fk.column.titleize,
              to_table_id: "system_#{fk.to_table}",
              to_table_name: fk.to_table.titleize,
              to_table_slug: fk.to_table.parameterize,
              relationship_type: 'many_to_one',
              required: true # Foreign keys are typically required
            }
          end
        end

        relationships
      rescue => e
        Rails.logger.error "Failed to get system table relationships: #{e.message}"
        []
      end

      def get_system_table_icon(table_name)
        icons = {
          'constructions' => '🏗️',
          'designs' => '📐',
          'estimates' => '📊',
          'purchase_orders' => '📦',
          'suppliers' => '🏭',
          'contacts' => '👤',
          'pricebook_items' => '💰',
          'price_histories' => '📈',
          'projects' => '📋',
          'project_tasks' => '✓',
          'schedule_tasks' => '📅',
          'users' => '👥',
          'import_sessions' => '📥',
          'grok_plans' => '🤖',
          'xero_credentials' => '🔐',
          'one_drive_credentials' => '☁️'
        }

        icons[table_name]
      end

      def map_sql_type_to_display(sql_type)
        case sql_type
        when /^character varying/, /^varchar/, /^text/
          'text'
        when /^integer/, /^bigint/, /^smallint/
          'number'
        when /^numeric/, /^decimal/, /^real/, /^double/
          'number'
        when /^boolean/
          'boolean'
        when /^date$/
          'date'
        when /^timestamp/, /^datetime/
          'datetime'
        when /^json/
          'json'
        else
          'text'
        end
      end
    end
  end
end
