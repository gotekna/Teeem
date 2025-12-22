module Api
  module V1
    class SchemaController < ApplicationController
      # GET /api/v1/schema
      def index
        # Get all user-defined foundations with their columns and relationships
        user_foundations = Foundation.includes(:columns).all

        # Build relationships map for user foundations
        user_relationships = []
        Column.where(column_type: "lookup").includes(:foundation, :lookup_foundation).each do |col|
          next unless col.lookup_foundation

          user_relationships << {
            id: "rel_#{col.id}",
            from_table_id: "user_#{col.foundation_id}",
            from_table_name: col.foundation.name,
            from_table_slug: col.foundation.slug,
            from_column_name: col.name,
            to_table_id: "user_#{col.lookup_foundation_id}",
            to_table_name: col.lookup_foundation.name,
            to_table_slug: col.lookup_foundation.slug,
            relationship_type: col.is_multiple ? "many_to_many" : "many_to_one",
            required: col.required
          }
        end

        # Format user foundations data
        user_foundations_data = user_foundations.map do |foundation|
          {
            id: "user_#{foundation.id}",
            name: foundation.name,
            slug: foundation.slug,
            database_table_name: foundation.database_table_name,
            description: foundation.description,
            is_live: foundation.is_live,
            is_system: false,
            icon: foundation.icon,
            record_count: get_record_count(foundation),
            columns: foundation.columns.order(:position).map do |col|
              {
                id: col.id,
                name: col.name,
                column_name: col.column_name,
                column_type: col.column_type,
                required: col.required,
                is_unique: col.is_unique,
                is_title: col.is_title,
                lookup_foundation_id: col.lookup_foundation_id,
                lookup_foundation_name: col.lookup_foundation&.name,
                is_multiple: col.is_multiple
              }
            end
          }
        end

        # Get system tables and their foreign keys
        excluded_tables = [
          "ar_internal_metadata",
          "schema_migrations",
          "solid_queue_blocked_executions",
          "solid_queue_claimed_executions",
          "solid_queue_failed_executions",
          "solid_queue_jobs",
          "solid_queue_pauses",
          "solid_queue_processes",
          "solid_queue_ready_executions",
          "solid_queue_recurring_executions",
          "solid_queue_recurring_tasks",
          "solid_queue_scheduled_executions",
          "solid_queue_semaphores",
          "foundations",
          "columns",
          "versions"
        ]

        all_db_tables = ActiveRecord::Base.connection.tables
        system_tables = all_db_tables.reject { |t| t.start_with?("user_") || excluded_tables.include?(t) }

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

        all_tables = user_foundations_data + system_tables_data

        render json: {
          success: true,
          tables: all_tables,
          relationships: all_relationships,
          stats: {
            total_tables: all_tables.count,
            user_tables: user_foundations_data.count,
            system_tables: system_tables_data.count,
            live_tables: user_foundations.where(is_live: true).count,
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

        # Core TEEEM system tables (columns/foundations metadata)
        teeem_core_tables = %w[foundations columns]

        # Get all user-defined foundations from the foundations table
        user_foundations = Foundation.includes(:columns).all.map do |foundation|
          db_name = foundation.database_table_name.to_s

          # Get column count - prefer columns table, fall back to actual DB columns
          col_count = foundation.columns.count
          has_column_metadata = col_count > 0

          if col_count == 0 && db_name.present?
            # Fall back to actual database column count for foundations without column metadata
            col_count = begin
              ActiveRecord::Base.connection.columns(db_name).count
            rescue
              0
            end
          end

          # Determine foundation type and usage status
          type = if foundation.table_type == "system"
                   "system"
          elsif db_name.include?("_import_")
                   "import"
          else
                   "user"
          end

          # Determine usage_status for better categorization
          usage_status = if foundation.table_type == "system" && has_column_metadata
                           "TEEEMTableView"
          elsif foundation.table_type == "system"
                           "Rails System"
          elsif rails_internal_tables.include?(db_name)
                           "Needs Deleting"  # Rails internal wrongly added to foundations
          elsif teeem_core_tables.include?(db_name)
                           "Needs Deleting"  # Core tables shouldn't be in foundations table
          elsif !has_column_metadata && type == "user"
                           # User foundation without column metadata - likely orphaned
                           "Needs Deleting"
          elsif type == "import"
                           "Import"
          elsif has_column_metadata
                           "User Table"
          else
                           "Unknown"
          end

          {
            id: foundation.id,
            name: foundation.name,
            slug: foundation.slug,
            database_table_name: db_name,
            plural_name: foundation.plural_name,
            icon: foundation.icon,
            feature: foundation.feature,
            is_live: foundation.is_live,
            has_ui: foundation.has_ui,
            columns_count: col_count,
            has_column_metadata: has_column_metadata,
            record_count: begin
              foundation.dynamic_model.count
            rescue
              0
            end,
            type: type,
            usage_status: usage_status,
            # Gold Standard Compliance fields
            compliance_score: foundation.compliance_score,
            compliance_checked_at: foundation.compliance_checked_at,
            non_compliant_count: foundation.non_compliant_columns&.size || 0,
            created_at: foundation.created_at,
            updated_at: foundation.updated_at
          }
        end

        # Foundations already registered in the foundations table - don't duplicate them
        registered_table_names = Foundation.pluck(:database_table_name).compact

        # Skip database introspection entirely - all foundations should be registered in the foundations table
        # The old system of adding "system_" prefixed tables from DB introspection created confusing duplicates
        all_tables = user_foundations

        render json: {
          success: true,
          tables: all_tables
        }
      end

      # GET /api/v1/schema/in_memory_tables
      # Returns registry of system foundations (formerly "in-memory" tables)
      # These are now properly registered in the foundations table with numeric IDs
      def in_memory_tables
        # Get all system foundations from the database
        system_foundations = Foundation.where(table_type: "system").order(:name)

        foundations = system_foundations.map do |foundation|
          # Get column count and record count from the actual database table
          actual_table_name = get_actual_table_name(foundation.model_class)
          columns_count = get_system_columns_count(actual_table_name)
          record_count = get_system_record_count(actual_table_name)

          {
            table_id: foundation.id,
            legacy_id: foundation.slug, # Keep slug for backwards compatibility
            name: foundation.name,
            slug: foundation.slug,
            icon: foundation.icon,
            file: foundation.file_location,
            model: foundation.model_class,
            description: foundation.description,
            has_saved_views: foundation.has_saved_views,
            api_endpoint: foundation.api_endpoint,
            is_live: foundation.is_live,
            columns_count: columns_count,
            record_count: record_count,
            database_table_name: actual_table_name,
            created_at: foundation.created_at,
            updated_at: foundation.updated_at
          }
        end

        render json: {
          success: true,
          tables: foundations,
          count: foundations.length,
          note: "System foundations now have proper numeric IDs in the foundations registry. The legacy_id (slug) is preserved for backwards compatibility with existing saved views."
        }
      end

      # GET /api/v1/schema/system_table_columns/:table_name
      def system_table_columns
        table_name = params[:table_name]

        # Security: Validate that the table exists and is not in excluded list
        excluded_tables = [
          "ar_internal_metadata",
          "schema_migrations",
          "solid_queue_blocked_executions",
          "solid_queue_claimed_executions",
          "solid_queue_failed_executions",
          "solid_queue_jobs",
          "solid_queue_pauses",
          "solid_queue_processes",
          "solid_queue_ready_executions",
          "solid_queue_recurring_executions",
          "solid_queue_recurring_tasks",
          "solid_queue_scheduled_executions",
          "solid_queue_semaphores",
          "foundations",
          "columns",
          "versions"
        ]

        unless ActiveRecord::Base.connection.table_exists?(table_name)
          render json: { error: "Table not found" }, status: :not_found
          return
        end

        if table_name.start_with?("user_") || excluded_tables.include?(table_name)
          render json: { error: "Access denied" }, status: :forbidden
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
        render json: { error: "Failed to fetch table columns" }, status: :internal_server_error
      end

      # POST /api/v1/schema/sync_system_tables
      # Audits all system tables and returns sync status
      def sync_system_tables
        # Prevent caching of sync results
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        # Disable ActiveRecord query cache for this request
        ActiveRecord::Base.uncached do
          system_foundations = Foundation.where(table_type: "system").order(:name)

          results = system_foundations.map do |foundation|
            audit_system_foundation(foundation)
          end

          # Calculate summary
          total = results.length
          synced = results.count { |r| r[:status] == "synced" }
          warnings = results.count { |r| r[:status] == "warning" }
          errors = results.count { |r| r[:status] == "error" }

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

      # POST /api/v1/schema/sync_has_ui_from_production
      # Fetches has_ui values from production and syncs to local database
      def sync_has_ui_from_production
        require "net/http"
        require "json"

        production_url = "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/schema/tables"

        begin
          uri = URI(production_url)
          response = Net::HTTP.get(uri)
          production_data = JSON.parse(response)

          unless production_data["tables"]
            render json: { success: false, error: "No tables data from production" }, status: :unprocessable_entity
            return
          end

          # Build a map of table_id -> has_ui from production
          production_has_ui = {}
          production_data["tables"].each do |t|
            production_has_ui[t["id"]] = t["has_ui"] if t["has_ui"].present?
          end

          updated = []
          skipped = []

          Foundation.find_each do |foundation|
            if production_has_ui.key?(foundation.id)
              old_value = foundation.has_ui
              new_value = production_has_ui[foundation.id]

              if old_value != new_value
                foundation.update!(has_ui: new_value)
                updated << { id: foundation.id, name: foundation.name, old: old_value, new: new_value }
              else
                skipped << { id: foundation.id, name: foundation.name, reason: "already_synced" }
              end
            else
              skipped << { id: foundation.id, name: foundation.name, reason: "not_in_production" }
            end
          end

          render json: {
            success: true,
            message: "Synced has_ui from production",
            updated_count: updated.length,
            skipped_count: skipped.length,
            updated: updated,
            skipped: skipped
          }
        rescue => e
          Rails.logger.error "Failed to sync has_ui from production: #{e.message}"
          render json: { success: false, error: e.message }, status: :internal_server_error
        end
      end

      # GET /api/v1/schema/columns
      # Returns all columns across all user foundations for Developer Tools view
      def all_columns
        columns = Column.includes(:foundation, :lookup_foundation).order(:foundation_id, :position)

        columns_data = columns.map do |col|
          {
            id: col.id,
            foundation_id: col.foundation_id,
            foundation_name: col.foundation&.name,
            foundation_slug: col.foundation&.slug,
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
            lookup_foundation_id: col.lookup_foundation_id,
            lookup_foundation_name: col.lookup_foundation&.name,
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
        render json: { error: "Failed to fetch columns" }, status: :internal_server_error
      end

      private

      def get_record_count(foundation)
        foundation.dynamic_model.count
      rescue
        0
      end

      def get_system_table_record_count(table_name)
        quoted_table = ActiveRecord::Base.connection.quote_table_name(table_name)

        # For tables with soft delete (deleted column), exclude deleted records
        if ActiveRecord::Base.connection.column_exists?(table_name, :deleted)
          ActiveRecord::Base.connection.select_value(
            "SELECT COUNT(*) FROM #{quoted_table} WHERE deleted IS NULL OR deleted = false"
          )
        else
          ActiveRecord::Base.connection.select_value("SELECT COUNT(*) FROM #{quoted_table}")
        end
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
            is_title: col.name == "name" || col.name == "title",
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
              relationship_type: "many_to_one",
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
          "constructions" => "🏗️",
          "designs" => "📐",
          "estimates" => "📊",
          "purchase_orders" => "📦",
          "suppliers" => "🏭",
          "contacts" => "👤",
          "pricebook_items" => "💰",
          "price_histories" => "📈",
          "projects" => "📋",
          "tasks" => "✓",  # SSoT: SmTask (tasks table)
          "users" => "👥",
          "import_sessions" => "📥",
          "grok_plans" => "🤖",
          "xero_credentials" => "🔐",
          "one_drive_credentials" => "☁️"
        }

        icons[table_name]
      end

      def map_sql_type_to_display(sql_type)
        case sql_type
        when /^character varying/, /^varchar/, /^text/
          "text"
        when /^integer/, /^bigint/, /^smallint/
          "number"
        when /^numeric/, /^decimal/, /^real/, /^double/
          "number"
        when /^boolean/
          "boolean"
        when /^date$/
          "date"
        when /^timestamp/, /^datetime/
          "datetime"
        when /^json/
          "json"
        else
          "text"
        end
      end

      # Map model class name to actual database table name
      def get_actual_table_name(model_class)
        return nil unless model_class.present?

        # Map of model class names to their database table names
        table_mapping = {
          "FinancialTransaction" => "financial_transactions",
          "GoldStandardItem" => "gold_standard_items",
          "TrinityEntry" => "trinity_entries",
          "Trinity" => "trinity",
          "Construction" => "constructions",
          "PricebookItem" => "pricebook",
          "WhsSwms" => "whs_swms",
          "WhsActionItem" => "whs_action_items",
          "WhsInduction" => "whs_inductions",
          "WhsInspection" => "whs_inspections",
          "WhsIncident" => "whs_incidents",
          "User" => "users",
          "InspiringQuote" => "inspiring_quotes",
          "Contact" => "contacts",
          "Estimate" => "estimates",
          "PurchaseOrder" => "purchase_orders",
          "SmTask" => "sm_tasks",
          "SmResource" => "sm_resources",
          "SmTimeEntry" => "sm_time_entries",
          "PriceHistory" => "price_histories",
          "Job" => "jobs"
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

      # Audit a single system foundation for sync status
      def audit_system_foundation(foundation)
        issues = []
        warnings = []

        # Get actual database table name
        actual_table_name = get_actual_table_name(foundation.model_class)

        # Check 1: Database table exists
        db_exists = actual_table_name.present? && ActiveRecord::Base.connection.table_exists?(actual_table_name)
        unless db_exists
          issues << "Database table '#{actual_table_name || 'unknown'}' does not exist"
        end

        # Check 2: Model class is valid
        model_valid = false
        if foundation.model_class.present?
          begin
            foundation.model_class.constantize
            model_valid = true
          rescue NameError
            issues << "Model class '#{foundation.model_class}' not found"
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
          registered_columns_count = Column.where(foundation_id: foundation.id).count

          # Get record count (exclude soft-deleted records if applicable)
          quoted_table = ActiveRecord::Base.connection.quote_table_name(actual_table_name)
          if ActiveRecord::Base.connection.column_exists?(actual_table_name, :deleted)
            record_count = ActiveRecord::Base.connection.select_value(
              "SELECT COUNT(*) FROM #{quoted_table} WHERE deleted IS NULL OR deleted = false"
            ).to_i
          else
            record_count = ActiveRecord::Base.connection.select_value(
              "SELECT COUNT(*) FROM #{quoted_table}"
            ).to_i
          end

          # Check 3: Column count match (warning if different)
          if registered_columns_count > 0 && registered_columns_count != db_columns_count
            warnings << "Column count mismatch: #{registered_columns_count} registered vs #{db_columns_count} in database"
          elsif registered_columns_count == 0
            warnings << "No columns registered in columns table"
          end
        end

        # Determine overall status
        status = if issues.any?
                   "error"
        elsif warnings.any?
                   "warning"
        else
                   "synced"
        end

        {
          foundation_id: foundation.id,
          name: foundation.name,
          slug: foundation.slug,
          icon: foundation.icon,
          model_class: foundation.model_class,
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
