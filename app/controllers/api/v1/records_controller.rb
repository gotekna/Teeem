module Api
  module V1
    class RecordsController < ApplicationController
      before_action :set_table

      # GET /api/v1/tables/:table_id/records
      def index
        # Sanitize and validate pagination parameters to prevent DoS
        page = [(params[:page] || 1).to_i, 1].max
        per_page = [(params[:per_page] || 50).to_i, 1].max
        per_page = [per_page, 10000].min  # Cap at 10000 to prevent DoS

        search = params[:search]
        sort_by = params[:sort_by]
        sort_direction = params[:sort_direction]&.downcase == 'desc' ? 'desc' : 'asc'

        model = @table.dynamic_model
        query = model.all

        # Apply search filter
        if search.present?
          searchable_columns = if @table.table_type == 'system'
            # For system tables, search text columns from the model
            model.columns.select { |c| [:string, :text].include?(c.type) }.map(&:name)
          else
            @table.columns.where(searchable: true).pluck(:column_name)
          end
          if searchable_columns.any?
            search_conditions = searchable_columns.map { |col| "#{col} ILIKE :search" }.join(' OR ')
            query = query.where(search_conditions, search: "%#{search}%")
          end
        end

        # Apply sorting with SQL injection prevention
        if sort_by.present?
          # For system tables, validate against model columns
          valid_columns = if @table.table_type == 'system'
            model.column_names
          else
            @table.columns.pluck(:column_name)
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

        # Paginate
        total_count = query.count
        records = query.offset((page - 1) * per_page).limit(per_page)

        # Build lookup cache to prevent N+1 queries (only for user tables with lookup columns)
        lookup_cache = @table.table_type == 'system' ? {} : build_lookup_cache(records)

        render json: {
          success: true,
          records: records.map { |r| record_to_json(r, lookup_cache) },
          pagination: {
            page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      rescue => e
        render json: { error: e.message }, status: :internal_server_error
      end

      # GET /api/v1/tables/:table_id/records/:id
      def show
        model = @table.dynamic_model
        record = model.find(params[:id])

        render json: {
          success: true,
          record: record_to_json(record)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Record not found' }, status: :not_found
      end

      # POST /api/v1/tables/:table_id/records
      def create
        model = @table.dynamic_model
        attributes = record_params

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

      # PATCH/PUT /api/v1/tables/:table_id/records/:id
      def update
        model = @table.dynamic_model
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

      # DELETE /api/v1/tables/:table_id/records/:id
      def destroy
        model = @table.dynamic_model
        record = model.find(params[:id])

        record.destroy
        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Record not found' }, status: :not_found
      end

      private

      def set_table
        # Support both ID and slug
        @table = if params[:table_id].to_i.to_s == params[:table_id]
          Table.includes(:columns).find(params[:table_id])
        else
          Table.includes(:columns).find_by!(slug: params[:table_id])
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: 'Table not found' }, status: :not_found
      end

      def record_params
        # Get all column names for this table
        column_names = @table.columns.pluck(:column_name)
        params.require(:record).permit(*column_names)
      end

      def record_to_json(record, lookup_cache = nil)
        json = {
          id: record.id,
          created_at: record.created_at,
          updated_at: record.updated_at
        }

        # For system tables, return all model attributes directly
        if @table.table_type == 'system'
          record.attributes.each do |key, value|
            next if ['id', 'created_at', 'updated_at'].include?(key)
            json[key] = value
          end
          return json
        end

        # First pass: collect all base column values
        record_data = {}
        @table.columns.includes(:lookup_table).each do |column|
          begin
            # Check if the column actually exists on the model
            if record.respond_to?(column.column_name)
              record_data[column.column_name] = record.send(column.column_name)
            else
              Rails.logger.warn "Column #{column.column_name} not found on table #{@table.name}"
              record_data[column.column_name] = nil
            end
          rescue => e
            Rails.logger.error "Error reading column #{column.column_name}: #{e.message}"
            record_data[column.column_name] = nil
          end
        end

        # Second pass: build JSON with computed formula values
        formula_evaluator = FormulaEvaluator.new(@table)

        @table.columns.includes(:lookup_table).each do |column|
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
                column.lookup_table.dynamic_model.find_by(id: value)
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
        lookup_columns = @table.columns.where(column_type: 'lookup').includes(:lookup_table)
        lookup_cache = {}

        lookup_columns.each do |column|
          next unless column.lookup_table

          # Collect all unique IDs for this lookup column across all records
          lookup_ids = records.map { |r| r.send(column.column_name) rescue nil }.compact.uniq
          next if lookup_ids.empty?

          # Batch load all related records
          begin
            related_records = column.lookup_table.dynamic_model.where(id: lookup_ids)
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
