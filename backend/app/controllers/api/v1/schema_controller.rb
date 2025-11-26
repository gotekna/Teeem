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
        # Rails internal tables that should never be shown as "user" tables
        rails_internal_tables = %w[
          ar_internal_metadata schema_migrations versions
          active_storage_attachments active_storage_blobs active_storage_variant_records
          solid_queue_blocked_executions solid_queue_claimed_executions solid_queue_failed_executions
          solid_queue_jobs solid_queue_pauses solid_queue_processes solid_queue_ready_executions
          solid_queue_recurring_executions solid_queue_recurring_tasks solid_queue_scheduled_executions
          solid_queue_semaphores
        ]

        # Core Trapid system tables (columns/tables metadata)
        trapid_core_tables = %w[tables columns]

        # Get all user-defined tables from the tables table
        user_tables = Table.includes(:columns).all.map do |table|
          db_name = table.database_table_name.to_s

          # Get column count - prefer columns table, fall back to actual DB columns
          col_count = table.columns.count
          has_column_metadata = col_count > 0

          if col_count == 0 && db_name.present?
            # Fall back to actual database column count for tables without column metadata
            col_count = begin
              ActiveRecord::Base.connection.columns(db_name).count
            rescue
              0
            end
          end

          # Determine table type and usage status
          type = if table.table_type == 'system'
                   'system'
                 elsif db_name.include?('_import_')
                   'import'
                 else
                   'user'
                 end

          # Determine usage_status for better categorization
          usage_status = if table.table_type == 'system' && has_column_metadata
                           'TrapidTableView'
                         elsif table.table_type == 'system'
                           'Rails System'
                         elsif rails_internal_tables.include?(db_name)
                           'Needs Deleting'  # Rails internal wrongly added to tables
                         elsif trapid_core_tables.include?(db_name)
                           'Needs Deleting'  # Core tables shouldn't be in tables table
                         elsif !has_column_metadata && type == 'user'
                           # User table without column metadata - likely orphaned
                           'Needs Deleting'
                         elsif type == 'import'
                           'Import'
                         elsif has_column_metadata
                           'User Table'
                         else
                           'Unknown'
                         end

          {
            id: table.id,
            name: table.name,
            slug: table.slug,
            database_table_name: db_name,
            plural_name: table.plural_name,
            icon: table.icon,
            is_live: table.is_live,
            columns_count: col_count,
            has_column_metadata: has_column_metadata,
            record_count: begin
              table.dynamic_model.count
            rescue
              0
            end,
            type: type,
            usage_status: usage_status,
            created_at: table.created_at,
            updated_at: table.updated_at
          }
        end

        # Tables already registered in the tables table - don't duplicate them
        registered_table_names = Table.pluck(:database_table_name).compact

        # Skip database introspection entirely - all tables should be registered in the tables table
        # The old system of adding "system_" prefixed tables from DB introspection created confusing duplicates
        all_tables = user_tables

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
          # Get column count and record count from the actual database table
          actual_table_name = get_actual_table_name(table.model_class)
          columns_count = get_system_columns_count(actual_table_name)
          record_count = get_system_record_count(actual_table_name)

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
            columns_count: columns_count,
            record_count: record_count,
            database_table_name: actual_table_name,
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

      # POST /api/v1/schema/sync_system_tables
      # Audits all system tables and returns sync status
      def sync_system_tables
        # Prevent caching of sync results
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'

        # Disable ActiveRecord query cache for this request
        ActiveRecord::Base.uncached do
          system_tables = Table.where(table_type: 'system').order(:name)

          results = system_tables.map do |table|
            audit_system_table(table)
          end

          # Calculate summary
          total = results.length
          synced = results.count { |r| r[:status] == 'synced' }
          warnings = results.count { |r| r[:status] == 'warning' }
          errors = results.count { |r| r[:status] == 'error' }

          render json: {
            success: true,
            summary: {
              total: total,
              synced: synced,
              warnings: warnings,
              errors: errors
            },
            results: results,
            timestamp: Time.current.iso8601
          }
        end
      end

      # GET /api/v1/schema/columns
      # Returns all columns across all user tables for Developer Tools view
      def all_columns
        columns = Column.includes(:table, :lookup_table).order(:table_id, :position)

        columns_data = columns.map do |col|
          {
            id: col.id,
            table_id: col.table_id,
            table_name: col.table&.name,
            table_slug: col.table&.slug,
            name: col.name,
            column_name: col.column_name,
            column_type: col.column_type,
            max_length: col.max_length,
            min_length: col.min_length,
            default_value: col.default_value,
            description: col.description,
            searchable: col.searchable,
            is_title: col.is_title,
            is_unique: col.is_unique,
            required: col.required,
            min_value: col.min_value,
            max_value: col.max_value,
            validation_message: col.validation_message,
            position: col.position,
            lookup_table_id: col.lookup_table_id,
            lookup_table_name: col.lookup_table&.name,
            lookup_display_column: col.lookup_display_column,
            is_multiple: col.is_multiple,
            has_cross_table_refs: col.has_cross_table_refs,
            header_align: col.header_align,
            data_align: col.data_align,
            created_at: col.created_at,
            updated_at: col.updated_at
          }
        end

        render json: {
          success: true,
          columns: columns_data,
          count: columns_data.length
        }
      rescue => e
        Rails.logger.error "Failed to fetch all columns: #{e.message}"
        render json: { error: 'Failed to fetch columns' }, status: :internal_server_error
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

      # Map model class name to actual database table name
      def get_actual_table_name(model_class)
        return nil unless model_class.present?

        # Map of model class names to their database table names
        table_mapping = {
          'FinancialTransaction' => 'financial_transactions',
          'GoldStandardItem' => 'gold_standard_items',
          'TrinityEntry' => 'trinity_entries',
          'Trinity' => 'trinity',
          'Construction' => 'constructions',
          'PricebookItem' => 'pricebook',
          'WhsSwms' => 'whs_swms',
          'WhsActionItem' => 'whs_action_items',
          'WhsInduction' => 'whs_inductions',
          'WhsInspection' => 'whs_inspections',
          'WhsIncident' => 'whs_incidents',
          'ContactRole' => 'contact_roles',
          'User' => 'users',
          'InspiringQuote' => 'inspiring_quotes',
          'Contact' => 'contacts',
          'Estimate' => 'estimates',
          'PurchaseOrder' => 'purchase_orders',
          'SmTask' => 'sm_tasks',
          'SmResource' => 'sm_resources',
          'SmTimeEntry' => 'sm_time_entries',
          'PriceHistory' => 'price_histories',
          'Job' => 'jobs',
          'Supplier' => 'suppliers'
        }

        table_mapping[model_class] || model_class.underscore.pluralize
      end

      # Get column count for a system table
      def get_system_columns_count(table_name)
        return 0 unless table_name.present? && ActiveRecord::Base.connection.table_exists?(table_name)

        ActiveRecord::Base.connection.columns(table_name).count
      rescue => e
        Rails.logger.error "Failed to get column count for #{table_name}: #{e.message}"
        0
      end

      # Get record count for a system table
      def get_system_record_count(table_name)
        return 0 unless table_name.present? && ActiveRecord::Base.connection.table_exists?(table_name)

        ActiveRecord::Base.connection.select_value("SELECT COUNT(*) FROM #{ActiveRecord::Base.connection.quote_table_name(table_name)}")
      rescue => e
        Rails.logger.error "Failed to get record count for #{table_name}: #{e.message}"
        0
      end

      # Audit a single system table for sync status
      def audit_system_table(table)
        issues = []
        warnings = []

        # Get actual database table name
        actual_table_name = get_actual_table_name(table.model_class)

        # Check 1: Database table exists
        db_exists = actual_table_name.present? && ActiveRecord::Base.connection.table_exists?(actual_table_name)
        unless db_exists
          issues << "Database table '#{actual_table_name || 'unknown'}' does not exist"
        end

        # Check 2: Model class is valid
        model_valid = false
        if table.model_class.present?
          begin
            table.model_class.constantize
            model_valid = true
          rescue NameError
            issues << "Model class '#{table.model_class}' not found"
          end
        else
          warnings << "No model_class defined"
        end

        # Get counts if DB exists
        db_columns_count = 0
        registered_columns_count = 0
        record_count = 0

        if db_exists
          # Get actual DB column count
          db_columns_count = ActiveRecord::Base.connection.columns(actual_table_name).count

          # Get registered columns count (from columns table)
          # Query directly to bypass all caching layers
          registered_columns_count = Column.where(table_id: table.id).count

          # Get record count
          record_count = ActiveRecord::Base.connection.select_value(
            "SELECT COUNT(*) FROM #{ActiveRecord::Base.connection.quote_table_name(actual_table_name)}"
          ).to_i

          # Check 3: Column count match (warning if different)
          if registered_columns_count > 0 && registered_columns_count != db_columns_count
            warnings << "Column count mismatch: #{registered_columns_count} registered vs #{db_columns_count} in database"
          elsif registered_columns_count == 0
            warnings << "No columns registered in columns table"
          end
        end

        # Determine overall status
        status = if issues.any?
                   'error'
                 elsif warnings.any?
                   'warning'
                 else
                   'synced'
                 end

        {
          table_id: table.id,
          name: table.name,
          slug: table.slug,
          icon: table.icon,
          model_class: table.model_class,
          database_table_name: actual_table_name,
          status: status,
          db_exists: db_exists,
          model_valid: model_valid,
          db_columns_count: db_columns_count,
          registered_columns_count: registered_columns_count,
          record_count: record_count,
          issues: issues,
          warnings: warnings
        }
      end
    end
  end
end
