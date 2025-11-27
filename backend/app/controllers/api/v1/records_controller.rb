module Api
  module V1
    class RecordsController < ApplicationController
      before_action :set_foundation

      # GET /api/v1/foundations/:foundation_id/records
      def index
        # Sanitize and validate pagination parameters to prevent DoS
        page = [(params[:page] || 1).to_i, 1].max
        per_page = [(params[:per_page] || 50).to_i, 1].max

        # Support minimal fields for fast initial loading
        fields_mode = params[:fields] # 'minimal' or nil (full)

        # For minimal mode, allow loading all records at once (it's lightweight)
        if fields_mode == 'minimal'
          per_page = [per_page, 20000].min  # Allow up to 20K items in minimal mode
        else
          per_page = [per_page, 10000].min  # Cap at 10000 to prevent DoS
        end

        search = params[:search]
        sort_by = params[:sort_by]
        sort_direction = params[:sort_direction]&.downcase == 'desc' ? 'desc' : 'asc'

        model = @foundation.dynamic_model
        query = model.all

        # Apply search filter
        if search.present?
          searchable_columns = if @foundation.table_type == 'system'
            # For system foundations, search text columns from the model
            model.columns.select { |c| [:string, :text].include?(c.type) }.map(&:name)
          else
            @foundation.columns.where(searchable: true).pluck(:column_name)
          end
          if searchable_columns.any?
            search_conditions = searchable_columns.map { |col| "#{col} ILIKE :search" }.join(' OR ')
            query = query.where(search_conditions, search: "%#{search}%")
          end
        end

        # Apply sorting with SQL injection prevention
        if sort_by.present?
          # For system foundations, validate against model columns
          valid_columns = if @foundation.table_type == 'system'
            model.column_names
          else
            @foundation.columns.pluck(:column_name)
          end

          if valid_columns.include?(sort_by)
            # Use Arel to safely build the order clause
            query = query.order(Arel.sql("#{ActiveRecord::Base.connection.quote_column_name(sort_by)} #{sort_direction}"))
          else
            query = query.order(created_at: :desc)
          end
        else
          query = query.order(created_at: :desc)
        end

        # Get count before applying select (to avoid COUNT() column issues)
        total_count = query.count

        # For minimal mode, select only essential columns for faster queries
        # IMPORTANT: Apply select AFTER count to avoid PostgreSQL COUNT() errors
        if fields_mode == 'minimal'
          essential_columns = determine_essential_columns(@foundation, params[:view_id])
          query = query.select(*essential_columns) if essential_columns.any?
        end

        # Paginate
        records = query.offset((page - 1) * per_page).limit(per_page)

        # Build lookup cache to prevent N+1 queries (only for user foundations with lookup columns)
        lookup_cache = @foundation.table_type == 'system' ? {} : build_lookup_cache(records)

        render json: {
          success: true,
          records: records.map { |r| record_to_json(r, lookup_cache) },
          pagination: {
            page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          },
          fields_mode: fields_mode || 'full', # Indicate which mode was used
          progressive_loading: fields_mode == 'minimal' # Flag for frontend
        }
      rescue => e
        render json: { error: e.message }, status: :internal_server_error
      end

      # GET /api/v1/foundations/:foundation_id/records/:id
      def show
        model = @foundation.dynamic_model
        record = model.find(params[:id])

        render json: {
          success: true,
          record: record_to_json(record)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Record not found' }, status: :not_found
      end

      # POST /api/v1/foundations/:foundation_id/records
      def create
        model = @foundation.dynamic_model
        attributes = record_params

        # Apply default values for required fields on specific foundations
        attributes = apply_default_values(model, attributes)

        record = model.new(attributes)

        if record.save
          render json: {
            success: true,
            record: record_to_json(record)
          }, status: :created
        else
          render json: {
            success: false,
            errors: record.errors.full_messages
          }, status: :unprocessable_entity
        end
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # PATCH/PUT /api/v1/foundations/:foundation_id/records/:id
      def update
        model = @foundation.dynamic_model
        record = model.find(params[:id])
        attributes = record_params

        if record.update(attributes)
          render json: {
            success: true,
            record: record_to_json(record)
          }
        else
          render json: {
            success: false,
            errors: record.errors.full_messages
          }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Record not found' }, status: :not_found
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # DELETE /api/v1/foundations/:foundation_id/records/:id
      def destroy
        model = @foundation.dynamic_model
        record = model.find(params[:id])

        record.destroy!
        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Record not found' }, status: :not_found
      rescue ActiveRecord::InvalidForeignKey => e
        render json: { error: "Cannot delete: record has dependent data. #{e.message}" }, status: :unprocessable_entity
      rescue => e
        Rails.logger.error "Error deleting record: #{e.class} - #{e.message}"
        render json: { error: e.message }, status: :internal_server_error
      end

      private

      def set_foundation
        # Support both ID and slug
        @foundation = if params[:foundation_id].to_i.to_s == params[:foundation_id]
          Foundation.includes(:columns).find(params[:foundation_id])
        else
          Foundation.includes(:columns).find_by!(slug: params[:foundation_id])
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Foundation not found' }, status: :not_found
      end

      # PHASE 2 & 3: Determine essential columns for minimal loading
      # Supports view-based selection (Phase 3) and smart defaults (Phase 2)
      def determine_essential_columns(foundation, view_id = nil)
        essential = []

        # PHASE 3: Use saved view's visible columns if provided
        if view_id.present?
          view = FoundationView.find_by(id: view_id, foundation_id: foundation.id)
          if view && view.visible_columns.present?
            Rails.logger.info "[Progressive Loading] Using view #{view.name} visible columns: #{view.visible_columns.inspect}"

            # Get actual column names from the database table
            model = foundation.dynamic_model
            valid_column_names = model.column_names

            # Filter out:
            # 1. UI-only pseudo-columns (select, actions)
            # 2. Columns that don't exist in the database (e.g., renamed columns)
            db_columns = view.visible_columns.reject do |col|
              ['select', 'actions'].include?(col) || !valid_column_names.include?(col)
            end

            Rails.logger.info "[Progressive Loading] Validated columns: #{db_columns.inspect}" if db_columns.size != view.visible_columns.size
            return [:id, :created_at, :updated_at] + db_columns.map(&:to_sym)
          end
        end

        # PHASE 2: Smart defaults based on column metadata
        if foundation.table_type == 'system'
          # For system foundations, use model introspection
          model = foundation.dynamic_model
          # Get first 5 non-system columns
          essential = model.column_names
            .reject { |col| ['created_at', 'updated_at', 'id'].include?(col) }
            .first(5)
            .map(&:to_sym)
        else
          # For user foundations, use column metadata
          essential = foundation.columns
            .where("is_title = ? OR position <= ?", true, 4)
            .order(:position)
            .limit(5)
            .pluck(:column_name)
            .map(&:to_sym)
        end

        # Always include id and timestamps (required for record operations)
        [:id, :created_at, :updated_at] + essential
      end

      def record_params
        # Get all column names for this foundation
        column_names = @foundation.columns.pluck(:column_name)
        params.require(:record).permit(*column_names)
      end

      # Apply default values for required fields that are blank
      def apply_default_values(model, attributes)
        attrs = attributes.to_h.with_indifferent_access

        # Handle Job model specifically
        if model == Job
          attrs[:title] = 'New Job' if attrs[:title].blank?
          attrs[:status] = 'Active' if attrs[:status].blank?
          attrs[:site_supervisor_name] = 'TBA' if attrs[:site_supervisor_name].blank?
        end

        attrs
      end

      def record_to_json(record, lookup_cache = nil)
        json = {
          id: record.id,
          created_at: record.created_at,
          updated_at: record.updated_at
        }

        # For system foundations, return all model attributes directly
        if @foundation.table_type == 'system'
          record.attributes.each do |key, value|
            next if ['id', 'created_at', 'updated_at'].include?(key)
            json[key] = value
          end
          return json
        end

        # First pass: collect all base column values
        record_data = {}
        @foundation.columns.includes(:lookup_foundation).each do |column|
          begin
            # Check if the column actually exists on the model
            if record.respond_to?(column.column_name)
              record_data[column.column_name] = record.send(column.column_name)
            else
              Rails.logger.warn "Column #{column.column_name} not found on foundation #{@foundation.name}"
              record_data[column.column_name] = nil
            end
          rescue => e
            Rails.logger.error "Error reading column #{column.column_name}: #{e.message}"
            record_data[column.column_name] = nil
          end
        end

        # Second pass: build JSON with computed formula values
        formula_evaluator = FormulaEvaluator.new(@foundation)

        @foundation.columns.includes(:lookup_foundation).each do |column|
          value = record_data[column.column_name]

          # Handle computed/formula columns - compute the value
          if column.column_type == 'computed'
            formula_expression = column.settings&.dig('formula')
            if formula_expression.present?
              # Pass the record instance for cross-table references
              json[column.column_name] = formula_evaluator.evaluate(formula_expression, record_data, record)
            else
              json[column.column_name] = nil
            end
          # Handle lookup columns - return both ID and display value
          elsif column.column_type == 'lookup' && value.present?
            begin
              # Use cached lookup data if available, otherwise query
              related_record = if lookup_cache && lookup_cache[column.id]
                lookup_cache[column.id][value]
              else
                column.lookup_foundation.dynamic_model.find_by(id: value)
              end

              json[column.column_name] = {
                id: value,
                display: related_record ? related_record.send(column.lookup_display_column).to_s : "[Deleted]"
              }
            rescue => e
              Rails.logger.error "Error loading lookup value for #{column.column_name}: #{e.message}"
              json[column.column_name] = { id: value, display: "[Error]" }
            end
          else
            json[column.column_name] = value
          end
        end

        json
      end

      def build_lookup_cache(records)
        # Preload all lookup data to prevent N+1 queries
        lookup_columns = @foundation.columns.where(column_type: 'lookup').includes(:lookup_foundation)
        lookup_cache = {}

        lookup_columns.each do |column|
          next unless column.lookup_foundation

          # Collect all unique IDs for this lookup column across all records
          lookup_ids = records.map { |r| r.send(column.column_name) rescue nil }.compact.uniq
          next if lookup_ids.empty?

          # Batch load all related records
          begin
            related_records = column.lookup_foundation.dynamic_model.where(id: lookup_ids)
            lookup_cache[column.id] = related_records.index_by(&:id)
          rescue => e
            Rails.logger.error "Error preloading lookup data for #{column.column_name}: #{e.message}"
            lookup_cache[column.id] = {}
          end
        end

        lookup_cache
      end
    end
  end
end
