module Api
  module V1
    class FoundationsController < ApplicationController
      skip_before_action :authorize_request, only: [ :table_ids ]
      before_action :set_foundation, only: [ :show, :update, :destroy, :health, :fix_health, :schema, :groups ]

      # GET /api/v1/foundations
      # Performance: Use include_counts=true to include record counts (adds 141 COUNT queries)
      # Default: skip counts for fast loading
      def index
        foundations = Foundation.includes(:columns).all

        # Preload all referencing columns to prevent N+1 queries
        foundation_ids = foundations.pluck(:id)
        referencing_map = Column.where(lookup_foundation_id: foundation_ids)
                                .includes(:foundation)
                                .group_by(&:lookup_foundation_id)

        # Only include record counts if explicitly requested (saves ~141 COUNT queries)
        include_counts = params[:include_counts] == "true"

        # Map foundations to JSON, skipping any that fail to serialize
        foundations_json = foundations.map do |f|
          begin
            foundation_json(f, include_record_count: include_counts, referencing_map: referencing_map)
          rescue => e
            Rails.logger.error "Failed to serialize foundation #{f.id} (#{f.name}): #{e.message}"
            Rails.logger.error e.backtrace.join("\n")
            nil
          end
        end.compact

        render json: {
          success: true,
          foundations: foundations_json
        }
      end

      # GET /api/v1/foundations/:id
      def show
        render json: {
          success: true,
          foundation: foundation_json(@foundation, include_columns: true)
        }
      end

      # POST /api/v1/foundations
      def create
        foundation = Foundation.new(foundation_params)

        if foundation.save
          # Create the physical database table immediately
          # Even if it has no columns, it will have id and timestamps
          builder = TableBuilder.new(foundation)
          result = builder.create_database_table

          if result[:success]
            # Auto-create "Setup" view for the new foundation
            create_default_setup_view(foundation) if current_user

            render json: {
              success: true,
              foundation: foundation_json(foundation)
            }, status: :created
          else
            # If database table creation fails, rollback the foundation record
            foundation.destroy
            render json: {
              success: false,
              errors: result[:errors]
            }, status: :unprocessable_entity
          end
        else
          render json: {
            success: false,
            errors: foundation.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/foundations/:id
      def update
        if @foundation.update(foundation_params)
          render json: {
            success: true,
            foundation: foundation_json(@foundation)
          }
        else
          render json: {
            success: false,
            errors: @foundation.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/foundations/:id/health
      # Returns all health checks for this table with their current status
      # Supports caching with optional ?refresh=true parameter to force fresh calculation
      def health
        # Check if user wants to force refresh
        force_refresh = params[:refresh] == "true"

        # Try to get cached results first (unless forcing refresh)
        unless force_refresh
          cached = HealthCheckCache.for_foundation(@foundation.id).first
          if cached&.fresh?
            Rails.logger.info "[Health] Serving cached results for foundation #{@foundation.id} (age: #{cached.age_in_hours}h)"
            return render json: cached.results.merge(
              foundation_id: @foundation.id,
              table_name: @foundation.name,
              cached: true,
              cached_at: cached.last_run_at.iso8601
            )
          end
        end

        # Run fresh health check
        Rails.logger.info "[Health] Running fresh health check for foundation #{@foundation.id} (forced: #{force_refresh})"

        # Use new HealthChecks::Registry service
        result = HealthChecks::Registry.run_all(
          foundation_id: @foundation.id,
          table_name: @foundation.database_table_name
        )

        # If no checks from service, fall back to database-configured checks
        if result[:checks].empty?
          checks = TableHealthCheck.for_table_or_foundation(@foundation.id)
          if checks.empty? && @foundation.database_table_name.present?
            checks = TableHealthCheck.for_table_or_foundation(@foundation.database_table_name)
          end

          if checks.any?
            # Use legacy execution through TableHealthCheck model
            results = checks.map(&:execute)
            result = {
              success: true,
              foundation_id: @foundation.id,
              table_name: @foundation.name,
              overall_health: HealthChecks::BaseCheck.calculate_health_score(results),
              total_issues: results.sum { |r| r[:count] || 0 },
              has_issues: results.any? { |r| (r[:count] || 0) > 0 },
              checks: HealthChecks::BaseCheck.sort_by_severity(results),
              checked_at: Time.current.iso8601
            }
          end
        end

        # Cache the fresh results
        HealthCheckCache.cache_foundation_health(@foundation.id, result) if result.present?

        render json: result.merge(
          foundation_id: @foundation.id,
          table_name: @foundation.name,
          cached: false
        )
      end

      # POST /api/v1/foundations/:id/fix_health
      # Apply auto-fix for health check issues
      # Params: fix_type - the type of fix to apply (e.g., "clean_headers")
      def fix_health
        fix_type = params[:fix_type]

        result = case fix_type
        when "clean_headers"
          if @foundation.slug == "sm-schedule-master"
            HealthChecks::SmScheduleMastersCheck.fix_dirty_headers!
          else
            { error: "clean_headers fix not supported for this foundation" }
          end
        else
          { error: "Unknown fix_type: #{fix_type}" }
        end

        if result[:error]
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        else
          # Clear cache after fix
          HealthCheckCache.where(foundation_id: @foundation.id).destroy_all

          render json: {
            success: true,
            fixed: result[:fixed] || 0,
            message: "Fixed #{result[:fixed] || 0} records"
          }
        end
      end

      # GET /api/v1/foundations/:id/schema
      # Returns the column schema for a foundation
      def schema
        columns = if @foundation.columns.any?
          @foundation.columns.order(:position).map do |col|
            schema_entry = {
              id: col.id,
              name: col.name,
              column_name: col.column_name,
              column_type: col.column_type,
              column_group: col.column_group,
              max_length: col.max_length,
              min_length: col.min_length,
              default_value: col.default_value,
              description: col.description,
              searchable: col.searchable,
              is_title: col.is_title,
              required: col.required,
              position: col.position,
              visible: col.visible,
              editable: col.editable,
              lookup_foundation_id: col.lookup_foundation_id,
              lookup_foundation_slug: col.lookup_foundation_slug,  # SSoT: Always include slug
              lookup_display_column: col.lookup_display_column,
              lookup_multiple: col.lookup_multiple,
              formula: col.formula,
              formula_output_type: col.formula_output_type,
              choices: col.choices,
              validation_regex: col.effective_validation_regex
            }

            # Add format config for Australian identifier types (ABN, ACN, BSB, etc.)
            if (fmt_config = col.format_config)
              schema_entry[:format_config] = fmt_config
            end

            schema_entry
          end
        else
          # Auto-detect columns for system foundations
          system_foundation_columns
        end

        render json: {
          success: true,
          foundation_id: @foundation.id,
          table_name: @foundation.name,
          columns: columns
        }
      end

      # GET /api/v1/foundations/:id/groups
      # Returns group counts by column value for server-side grouping
      # Params:
      #   group_by: column name to group by (required)
      #   filters: optional cascade filters (JSON string)
      # Returns accurate counts directly from SQL GROUP BY (not limited by pagination)
      def groups
        group_by_column = params[:group_by]

        # Validate group_by parameter
        if group_by_column.blank?
          return render json: {
            success: false,
            error: "group_by parameter is required"
          }, status: :bad_request
        end

        # Validate that column exists
        valid_columns = @foundation.columns.pluck(:column_name)
        unless valid_columns.include?(group_by_column)
          return render json: {
            success: false,
            error: "Invalid column: #{group_by_column}"
          }, status: :bad_request
        end

        begin
          model = @foundation.dynamic_model
          conn = ActiveRecord::Base.connection

          # Build base query
          query = model.all

          # Apply standard filters (soft delete, is_active, etc.)
          if model.column_names.include?("deleted_at")
            query = query.where(deleted_at: nil)
          end
          # SSoT: Match records_controller.rb - only filter is_active for contacts table
          # Allow both true and nil (nil = legacy records before is_active was added)
          if model.table_name == "contacts" && model.column_names.include?("is_active")
            query = query.where(is_active: [true, nil])
          end

          # Apply cascade filters if provided
          if params[:filters].present?
            begin
              filters = JSON.parse(params[:filters])
              if filters.is_a?(Array) && filters.any?
                filters.each do |filter|
                  column = filter["column"]
                  value = filter["value"]
                  operator = filter["operator"] || "="

                  # Skip if no column specified
                  next unless column.present?

                  # Security: Validate column name exists
                  next unless valid_columns.include?(column) || column == "id"

                  # For operators that don't need a value, skip value check
                  value_required = !%w[is_null is_not_null is_empty is_not_empty].include?(operator)
                  next if value_required && !value.present?

                  # Convert boolean string values ("Yes"/"No") to actual booleans
                  # This handles the case where frontend dropdowns send "Yes"/"No" for boolean columns
                  col_def = @foundation.columns.find_by(column_name: column)
                  if col_def&.column_type == "boolean" && value.is_a?(String)
                    value = case value.downcase
                            when "yes", "true", "1" then true
                            when "no", "false", "0" then false
                            else value
                            end
                  end

                  case operator
                  when "=", "equals"
                    query = query.where(column => value)
                  when "!=", "not_equals"
                    query = query.where.not(column => value)
                  when "contains"
                    query = query.where("#{conn.quote_column_name(column)} ILIKE ?", "%#{value}%")
                  when "starts_with"
                    query = query.where("#{conn.quote_column_name(column)} ILIKE ?", "#{value}%")
                  when "is_null"
                    query = query.where(column => nil)
                  when "is_not_null"
                    query = query.where.not(column => nil)
                  when "is_empty"
                    query = query.where("#{conn.quote_column_name(column)} IS NULL OR #{conn.quote_column_name(column)} = ''")
                  when "is_not_empty"
                    query = query.where("#{conn.quote_column_name(column)} IS NOT NULL AND #{conn.quote_column_name(column)} != ''")
                  when "array_contains"
                    # Handle array columns (e.g., sm_template_ids which is integer[])
                    # PostgreSQL: value = ANY(column)
                    # This works for integer[] columns where we check if a single value is in the array
                    query = query.where("? = ANY(#{conn.quote_column_name(column)})", value.to_i)
                  when "array_not_contains"
                    # Inverse: NOT (value = ANY(column)) or column IS NULL
                    query = query.where("NOT (? = ANY(#{conn.quote_column_name(column)})) OR #{conn.quote_column_name(column)} IS NULL", value.to_i)
                  end
                end
              end
            rescue JSON::ParserError
              # Ignore invalid JSON
            end
          end

          # Get group counts via SQL aggregation
          # Handle NULL values by coalescing to a display-friendly string
          quoted_column = conn.quote_column_name(group_by_column)

          groups_result = query
            .group(group_by_column)
            .select(Arel.sql("#{quoted_column} as group_key, COUNT(*) as count"))
            .order(Arel.sql("COUNT(*) DESC"))

          # Check if group_by column is a lookup - need to resolve display values
          group_column = @foundation.columns.find_by(column_name: group_by_column)
          is_lookup = group_column&.column_type == "lookup" && group_column&.lookup_foundation.present?

          # Pre-fetch lookup values if this is a lookup column (avoid N+1)
          lookup_cache = {}
          if is_lookup
            lookup_ids = groups_result.map(&:group_key).compact.map(&:to_i).uniq
            if lookup_ids.any?
              lookup_model = group_column.lookup_foundation.dynamic_model
              display_col = group_column.lookup_display_column || "name"

              # Check if display_col is an actual database column or a computed attribute
              # Computed columns (like full_name) need to be resolved via the model, not SQL
              if lookup_model.column_names.include?(display_col)
                # Real database column - use efficient pluck
                lookup_cache = lookup_model.where(id: lookup_ids).pluck(:id, display_col.to_sym).to_h
              else
                # Computed column (e.g., full_name) - load records and call the method
                # Fall back to 'name' column if the computed method doesn't exist
                lookup_model.where(id: lookup_ids).each do |record|
                  lookup_cache[record.id] = if record.respond_to?(display_col)
                    record.send(display_col)
                  elsif record.respond_to?(:name)
                    record.name
                  else
                    record.id.to_s
                  end
                end
              end
            end
          end

          # Transform results (resolve lookup display values)
          groups = groups_result.map do |row|
            display_value = if row.group_key.nil?
              "(Empty)"
            elsif is_lookup && lookup_cache[row.group_key.to_i]
              lookup_cache[row.group_key.to_i]
            else
              row.group_key.to_s
            end

            {
              key: row.group_key,
              count: row.count,
              display_value: display_value
            }
          end

          # Get total records in query (for verification)
          total_records = groups.sum { |g| g[:count] }

          render json: {
            success: true,
            groups: groups,
            total_groups: groups.length,
            total_records: total_records,
            group_by_column: group_by_column,
            foundation_id: @foundation.id
          }
        rescue => e
          Rails.logger.error "Error in groups action: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          render json: {
            success: false,
            error: "Failed to get group counts: #{e.message}"
          }, status: :internal_server_error
        end
      end

      # GET /api/v1/foundations/table_ids
      # Returns a mapping of slug -> id for key tables
      # Used by frontend to avoid hardcoding table IDs
      def table_ids
        # Key tables that the frontend needs to know about
        # Map frontend key -> database slug (MUST match actual Foundation.slug in database!)
        key_mapping = {
          "gold-standard" => "gold_standard_table",
          "jobs" => "jobs",
          "tasks" => "sm-tasks",
          "pricebook" => "pricebook-items",
          "contacts" => "contacts",
          "features-tracking" => "feature_trackers"
          # NOTE: Companies uses CorporateCompany Rails model, not Foundation
        }

        db_slugs = key_mapping.values
        foundations = Foundation.where(slug: db_slugs).pluck(:slug, :id, :name)

        # Build mappings using frontend keys
        slug_to_id = {}
        by_id = {}

        foundations.each do |db_slug, id, name|
          # Find the frontend key for this db_slug
          frontend_key = key_mapping.key(db_slug)
          slug_to_id[frontend_key] = id
          by_id[id] = { slug: frontend_key, name: name }
        end

        render json: {
          success: true,
          table_ids: slug_to_id,
          tables_by_id: by_id,
          # Convenience: uppercase key format matching frontend constants
          # These MUST match what useTableIds.ts expects
          TABLE_IDS: {
            GOLD_STANDARD: slug_to_id["gold-standard"],
            JOBS: slug_to_id["jobs"],
            TASKS: slug_to_id["tasks"],
            PRICEBOOK: slug_to_id["pricebook"],
            CONTACTS: slug_to_id["contacts"],
            FEATURES_TRACKING: slug_to_id["features-tracking"]
          }.compact
        }
      end

      # DELETE /api/v1/foundations/:id
      def destroy
        # Safety checks before deletion
        if @foundation.is_live
          return render json: {
            success: false,
            errors: [ "Cannot delete a live foundation. Set it to draft first." ]
          }, status: :unprocessable_entity
        end

        # Check if foundation has records
        begin
          record_count = @foundation.dynamic_model.count
          if record_count > 0
            return render json: {
              success: false,
              errors: [ "Cannot delete a foundation that contains #{record_count} record(s). Delete all records first." ]
            }, status: :unprocessable_entity
          end
        rescue => e
          Rails.logger.error "Error checking record count: #{e.message}"
        end

        # Check if other foundations have lookup columns referencing this foundation
        referencing_columns = Column.where(lookup_foundation_id: @foundation.id).includes(:foundation)
        if referencing_columns.any?
          foundation_names = referencing_columns.map { |col| col.foundation.name }.uniq.join(", ")
          return render json: {
            success: false,
            errors: [ "Cannot delete this foundation because it is referenced by lookup columns in: #{foundation_names}. Remove those lookup columns first." ]
          }, status: :unprocessable_entity
        end

        # Wrap deletion in a transaction to ensure atomicity
        begin
          ActiveRecord::Base.transaction do
            # Drop the database table first
            builder = TableBuilder.new(@foundation)
            drop_result = builder.drop_database_table

            unless drop_result[:success]
              raise ActiveRecord::Rollback, drop_result[:errors].join(", ")
            end

            # Delete the foundation record (this will also cascade delete columns via dependent: :destroy)
            @foundation.destroy!
          end

          render json: { success: true }
        rescue ActiveRecord::Rollback => e
          render json: {
            success: false,
            errors: [ e.message ]
          }, status: :unprocessable_entity
        rescue => e
          Rails.logger.error "Error deleting foundation: #{e.message}"
          render json: {
            success: false,
            errors: [ "Failed to delete foundation: #{e.message}" ]
          }, status: :internal_server_error
        end
      end

      private

      def set_foundation
        # Support both ID and slug
        @foundation = if params[:id].to_i.to_s == params[:id]
          Foundation.includes(:columns).find(params[:id])
        else
          Foundation.includes(:columns).find_by!(slug: params[:id])
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Foundation not found" }, status: :not_found
      end

      # Get columns for system foundations from the model schema
      def system_foundation_columns
        return [] unless @foundation.table_type == "system" && @foundation.model_class.present?

        begin
          model = @foundation.model_class.constantize
          position = 0
          model.columns.map do |col|
            position += 1
            {
              id: "system_#{col.name}",
              name: col.name.titleize,
              column_name: col.name,
              column_type: map_sql_type_to_column_type(col.type, col.name),
              required: !col.null,
              is_title: col.name == "title" || col.name == "name",
              is_unique: false,
              position: position
            }
          end
        rescue NameError => e
          Rails.logger.error "Failed to get columns for system foundation #{@foundation.slug}: #{e.message}"
          []
        end
      end

      def map_sql_type_to_column_type(sql_type, column_name = nil)
        # Special handling for Australian column types based on column name (Gold Standard compliance)
        if column_name
          case column_name.to_s
          when /^(tax_number|abn)$/i
            return "abn"
          when /^(company_number|acn)$/i
            return "acn"
          when /^(bank_bsb|bsb)$/i
            return "bsb"
          when /^(bank_account_number|bank_account)$/i
            return "bank_account"
          when /^postcode$/i
            return "postcode"
          when /^tfn$/i
            return "tfn"
          end
        end

        # Default SQL type mapping (using Gold Standard column types)
        case sql_type
        when :string, :text
          "single_line_text"
        when :integer, :bigint
          "whole_number"
        when :decimal, :float
          "number"
        when :boolean
          "boolean"
        when :date
          "date"
        when :datetime, :timestamp
          "date_and_time"
        when :json, :jsonb
          "structured_data"
        else
          "single_line_text"
        end
      end

      def foundation_params
        params.require(:foundation).permit(
          :name,
          :singular_name,
          :plural_name,
          :icon,
          :title_column,
          :searchable,
          :description,
          :is_live,
          :feature,
          :has_ui
        )
      end

      # Auto-create the "Setup" view for new foundations
      # This view serves as the default template with all columns visible
      def create_default_setup_view(foundation)
        # Get all columns for the foundation
        all_columns = foundation.columns.pluck(:column_name)

        # Build visible columns hash (all columns visible by default)
        visible_columns = {}
        all_columns.each { |col| visible_columns[col] = true }
        # Note: 'select' and 'actions' are UI-only pseudo-columns, not database columns
        # Only add 'id' to visible columns as it's a real database column
        visible_columns["id"] = true

        # Build column order array (includes UI-only columns for frontend display)
        column_order = [ "select", "id", "actions" ] + all_columns

        # Create the Setup view
        current_user.foundation_views.create!(
          foundation_id: foundation.id,
          name: "Setup",
          view_type: "custom",
          filters: {
            interGroupLogic: "OR",
            cascadeFilters: [],
            filterGroups: []
          },
          columns: {
            visible: visible_columns,
            order: column_order
          },
          sort_order: [],
          group_by_column: nil,
          is_default: true,
          display_order: 0
        )

        Rails.logger.info "Created default 'Setup' view for foundation #{foundation.id} (#{foundation.name})"
      rescue => e
        Rails.logger.error "Failed to create Setup view for foundation #{foundation.id}: #{e.message}"
        # Don't fail foundation creation if view creation fails
      end

      def foundation_json(foundation, include_columns: false, include_record_count: false, referencing_map: nil)
        # Temporarily set @foundation for system_foundation_columns helper
        original_foundation = @foundation
        @foundation = foundation

        json = {
          id: foundation.id,
          name: foundation.name,
          slug: foundation.slug,
          singular_name: foundation.singular_name,
          plural_name: foundation.plural_name,
          database_table_name: foundation.database_table_name,
          icon: foundation.icon,
          title_column: foundation.title_column,
          searchable: foundation.searchable,
          description: foundation.description,
          is_live: foundation.is_live,
          table_type: foundation.table_type,
          feature: foundation.feature,
          api_endpoint: foundation.api_endpoint,
          created_at: foundation.created_at,
          updated_at: foundation.updated_at
        }

        if include_columns
          # System columns that exist on every table (Rails auto-columns)
          # These are returned so frontend can show them in column selector
          system_columns = [
            {
              id: "system_id",
              name: "ID",
              column_name: "id",
              column_type: "auto_number",
              column_group: "System",
              system: true,
              editable: false,
              position: -3
            },
            {
              id: "system_created_at",
              name: "Created At",
              column_name: "created_at",
              column_type: "created_time",
              column_group: "System",
              system: true,
              editable: false,
              position: -2
            },
            {
              id: "system_updated_at",
              name: "Updated At",
              column_name: "updated_at",
              column_type: "modified_time",
              column_group: "System",
              system: true,
              editable: false,
              position: -1
            }
          ]

          # Use defined columns if they exist, otherwise auto-detect for system foundations
          if foundation.columns.any?
            # Use explicitly defined columns from the columns table
            user_columns = foundation.columns.order(:position).map do |col|
              column_data = {
                id: col.id,
                name: col.name,
                column_name: col.column_name,
                column_type: col.column_type,
                column_group: col.column_group,
                max_length: col.max_length,
                min_length: col.min_length,
                default_value: col.default_value,
                description: col.description,
                searchable: col.searchable != false, # SSoT: Never return NULL, default to true
                is_title: col.is_title,
                is_unique: col.is_unique,
                required: col.required,
                min_value: col.min_value,
                max_value: col.max_value,
                validation_message: col.validation_message,
                position: col.position,
                lookup_foundation_id: col.lookup_foundation_id,
                lookup_foundation_slug: col.lookup_foundation_slug,  # SSoT: Always include slug
                lookup_display_column: col.lookup_display_column,
                is_multiple: col.is_multiple,
                header_align: col.header_align,
                data_align: col.data_align,
                available_choices: col.available_choices
              }

              # Add relationship information
              if col.lookup_foundation_id.present?
                column_data[:lookup_foundation_name] = col.lookup_foundation&.name
              end

              # Find columns that reference this foundation using preloaded data or query
              referencing_columns = if referencing_map
                referencing_map[foundation.id] || []
              else
                Column.where(lookup_foundation_id: foundation.id).includes(:foundation)
              end

              if referencing_columns.any?
                column_data[:referenced_by] = referencing_columns.map do |ref_col|
                  {
                    foundation_id: ref_col.foundation_id,
                    foundation_name: ref_col.foundation.name,
                    column_name: ref_col.name
                  }
                end
              end

              column_data
            end

            # Filter out system columns from user_columns (they're already in system_columns with proper metadata)
            system_column_names = %w[id created_at updated_at]
            user_columns_filtered = user_columns.reject { |col| system_column_names.include?(col[:column_name]) }

            # Combine system columns + filtered user columns
            json[:columns] = system_columns + user_columns_filtered
          elsif foundation.table_type == "system"
            # Fallback: auto-detect columns from model schema for system foundations without defined columns
            json[:columns] = system_columns + system_foundation_columns
          else
            # No user columns defined - just return system columns
            json[:columns] = system_columns
          end
        end

        if include_columns || include_record_count
          # Get record count
          begin
            json[:record_count] = foundation.dynamic_model.count
          rescue
            json[:record_count] = 0
          end
        end

        # Always include columns info for list view
        unless include_columns
          if foundation.table_type == "system"
            json[:columns] = system_foundation_columns.map do |col|
              {
                id: col[:id],
                name: col[:name],
                column_type: col[:column_type]
              }
            end
          else
            json[:columns] = foundation.columns.order(:position).map do |col|
              {
                id: col.id,
                name: col.name,
                column_type: col.column_type
              }
            end
          end
        end

        # Restore original @foundation
        @foundation = original_foundation

        json
      end
    end
  end
end
