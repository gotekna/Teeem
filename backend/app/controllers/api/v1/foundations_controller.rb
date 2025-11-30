module Api
  module V1
    class FoundationsController < ApplicationController
      before_action :set_foundation, only: [:show, :update, :destroy, :health]

      # GET /api/v1/foundations
      def index
        foundations = Foundation.includes(:columns).all

        # Preload all referencing columns to prevent N+1 queries
        foundation_ids = foundations.pluck(:id)
        referencing_map = Column.where(lookup_foundation_id: foundation_ids)
                                .includes(:foundation)
                                .group_by(&:lookup_foundation_id)

        # Map foundations to JSON, skipping any that fail to serialize
        foundations_json = foundations.map do |f|
          begin
            foundation_json(f, include_record_count: true, referencing_map: referencing_map)
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
      def health
        # Find health checks for this foundation
        # Try by foundation_id first, then by table_name
        checks = TableHealthCheck.for_table_or_foundation(@foundation.id)

        # If no checks found by ID, try by table name (for system tables)
        if checks.empty? && @foundation.database_table_name.present?
          checks = TableHealthCheck.for_table_or_foundation(@foundation.database_table_name)
        end

        # Execute each check and collect results
        results = checks.map(&:execute)

        # Calculate overall health score
        total_issues = results.sum { |r| r[:count] }
        critical_issues = results.select { |r| r[:severity] == 'critical' }.sum { |r| r[:count] }
        warning_issues = results.select { |r| r[:severity] == 'warning' }.sum { |r| r[:count] }

        # Health score: 100% if no issues, reduced based on severity
        # Critical issues: -10 points each (capped at -50)
        # Warning issues: -2 points each (capped at -30)
        health_score = 100
        health_score -= [critical_issues * 10, 50].min
        health_score -= [warning_issues * 2, 30].min
        health_score = [health_score, 0].max

        render json: {
          success: true,
          foundation_id: @foundation.id,
          table_name: @foundation.name,
          overall_health: health_score,
          total_issues: total_issues,
          has_issues: total_issues > 0,
          checks: results.sort_by { |r| TableHealthCheck::SEVERITY_ORDER[r[:severity]] || 99 }
        }
      end

      # DELETE /api/v1/foundations/:id
      def destroy
        # Safety checks before deletion
        if @foundation.is_live
          return render json: {
            success: false,
            errors: ['Cannot delete a live foundation. Set it to draft first.']
          }, status: :unprocessable_entity
        end

        # Check if foundation has records
        begin
          record_count = @foundation.dynamic_model.count
          if record_count > 0
            return render json: {
              success: false,
              errors: ["Cannot delete a foundation that contains #{record_count} record(s). Delete all records first."]
            }, status: :unprocessable_entity
          end
        rescue => e
          Rails.logger.error "Error checking record count: #{e.message}"
        end

        # Check if other foundations have lookup columns referencing this foundation
        referencing_columns = Column.where(lookup_foundation_id: @foundation.id).includes(:foundation)
        if referencing_columns.any?
          foundation_names = referencing_columns.map { |col| col.foundation.name }.uniq.join(', ')
          return render json: {
            success: false,
            errors: ["Cannot delete this foundation because it is referenced by lookup columns in: #{foundation_names}. Remove those lookup columns first."]
          }, status: :unprocessable_entity
        end

        # Wrap deletion in a transaction to ensure atomicity
        begin
          ActiveRecord::Base.transaction do
            # Drop the database table first
            builder = TableBuilder.new(@foundation)
            drop_result = builder.drop_database_table

            unless drop_result[:success]
              raise ActiveRecord::Rollback, drop_result[:errors].join(', ')
            end

            # Delete the foundation record (this will also cascade delete columns via dependent: :destroy)
            @foundation.destroy!
          end

          render json: { success: true }
        rescue ActiveRecord::Rollback => e
          render json: {
            success: false,
            errors: [e.message]
          }, status: :unprocessable_entity
        rescue => e
          Rails.logger.error "Error deleting foundation: #{e.message}"
          render json: {
            success: false,
            errors: ["Failed to delete foundation: #{e.message}"]
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
        render json: { error: 'Foundation not found' }, status: :not_found
      end

      # Get columns for system foundations from the model schema
      def system_foundation_columns
        return [] unless @foundation.table_type == 'system' && @foundation.model_class.present?

        begin
          model = @foundation.model_class.constantize
          position = 0
          model.columns.map do |col|
            position += 1
            {
              id: "system_#{col.name}",
              name: col.name.titleize,
              column_name: col.name,
              column_type: map_sql_type_to_column_type(col.type),
              required: !col.null,
              is_title: col.name == 'title' || col.name == 'name',
              is_unique: false,
              position: position
            }
          end
        rescue NameError => e
          Rails.logger.error "Failed to get columns for system foundation #{@foundation.slug}: #{e.message}"
          []
        end
      end

      def map_sql_type_to_column_type(sql_type)
        case sql_type
        when :string, :text
          'text'
        when :integer, :bigint
          'number'
        when :decimal, :float
          'currency'
        when :boolean
          'boolean'
        when :date
          'date'
        when :datetime, :timestamp
          'datetime'
        when :json, :jsonb
          'json'
        else
          'text'
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
        visible_columns['id'] = true

        # Build column order array (includes UI-only columns for frontend display)
        column_order = ['select', 'id', 'actions'] + all_columns

        # Create the Setup view
        current_user.foundation_views.create!(
          foundation_id: foundation.id,
          name: 'Setup',
          view_type: 'custom',
          filters: {
            interGroupLogic: 'OR',
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
          # Use defined columns if they exist, otherwise auto-detect for system foundations
          if foundation.columns.any?
            # Use explicitly defined columns from the columns table
            json[:columns] = foundation.columns.order(:position).map do |col|
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
                searchable: col.searchable,
                is_title: col.is_title,
                is_unique: col.is_unique,
                required: col.required,
                min_value: col.min_value,
                max_value: col.max_value,
                validation_message: col.validation_message,
                position: col.position,
                lookup_foundation_id: col.lookup_foundation_id,
                lookup_display_column: col.lookup_display_column,
                is_multiple: col.is_multiple,
                header_align: col.header_align,
                data_align: col.data_align
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
          elsif foundation.table_type == 'system'
            # Fallback: auto-detect columns from model schema for system foundations without defined columns
            json[:columns] = system_foundation_columns
          else
            # No columns defined for non-system foundation
            json[:columns] = []
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
          if foundation.table_type == 'system'
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
