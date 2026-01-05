module Api
  module V1
    class ColumnsController < ApplicationController
      before_action :set_foundation
      before_action :set_column, only: [ :update, :destroy ]

      # POST /api/v1/foundations/:foundation_id/columns
      def create
        column = @foundation.columns.build(column_params)
        column.position = @foundation.columns.maximum(:position).to_i + 1

        # Auto-detect Australian column types if not explicitly set
        if column.column_name.present? && column.column_type.blank?
          column.column_type = auto_detect_australian_column_type(column.column_name)
        end

        if column.save
          # Use add_column for existing foundations (preserves data)
          # Use create_database_table only for new foundations
          builder = TableBuilder.new(@foundation)

          # Check if table exists in database
          table_exists = ActiveRecord::Base.connection.table_exists?(@foundation.database_table_name)

          result = if table_exists
            # Add just the new column to existing table
            builder.add_column(column)
          else
            # Create the entire table (for new foundations only)
            builder.create_database_table
          end

          if result[:success]
            # Reset the connection's schema cache for this foundation
            ActiveRecord::Base.connection.schema_cache.clear_data_source_cache!(@foundation.database_table_name)

            # Add new column to all existing views for this foundation
            add_column_to_existing_views(column)

            render json: {
              success: true,
              column: column_json(column)
            }, status: :created
          else
            # Log the error for debugging
            Rails.logger.error "TableBuilder failed: #{result[:errors].inspect}"
            column.destroy
            render json: {
              success: false,
              errors: result[:errors]
            }, status: :unprocessable_entity
          end
        else
          render json: {
            success: false,
            errors: column.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/foundations/:foundation_id/columns/:id
      def update
        Rails.logger.info "🔴 COLUMN UPDATE - Before: header_align=#{@column.header_align}, data_align=#{@column.data_align}"
        Rails.logger.info "📥 COLUMN UPDATE - Params received: #{column_params.inspect}"

        # Auto-detect Australian column types if column_name changed and type not explicitly set
        params_hash = column_params.to_h
        if params_hash[:column_name].present? && params_hash[:column_type].blank?
          params_hash[:column_type] = auto_detect_australian_column_type(params_hash[:column_name])
        end

        # Track if structural changes are being made (require table rebuild)
        structural_change = params_hash[:column_name].present? && params_hash[:column_name] != @column.column_name ||
                           params_hash[:column_type].present? && params_hash[:column_type] != @column.column_type

        update_result = @column.update(params_hash)
        Rails.logger.info "📊 COLUMN UPDATE - Update result: #{update_result}"
        Rails.logger.info "🔵 COLUMN UPDATE - After: header_align=#{@column.header_align}, data_align=#{@column.data_align}"
        Rails.logger.info "❌ COLUMN UPDATE - Errors: #{@column.errors.full_messages.inspect}" unless update_result

        if update_result
          # Only rebuild database table if structural changes were made
          # Display name changes don't require a rebuild
          if structural_change
            foundation_reloaded = Foundation.includes(:columns).find(@foundation.id)
            builder = TableBuilder.new(foundation_reloaded)
            result = builder.create_database_table

            if result[:success]
              # Reload the dynamic model to pick up changes
              foundation_reloaded.reload_dynamic_model
              # Reset the connection's schema cache for this foundation
              ActiveRecord::Base.connection.schema_cache.clear_data_source_cache!(foundation_reloaded.database_table_name)
            else
              render json: {
                success: false,
                errors: result[:errors]
              }, status: :unprocessable_entity
              return
            end
          end

          render json: {
            success: true,
            column: column_json(@column.reload)
          }
        else
          render json: {
            success: false,
            errors: @column.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/foundations/:foundation_id/columns/:id
      def destroy
        # Check for references before deleting - block if any exist
        references = check_column_references(@column)

        if references.any?
          return render json: {
            success: false,
            blocked: true,
            references: references,
            message: "Cannot delete this column because it is referenced by other columns. Remove these references first."
          }, status: :conflict
        end

        # Store column info before destroying
        deleted_column_name = @column.column_name
        column_to_remove = @column

        # Remove the column from the database table first (preserves FK constraints)
        builder = TableBuilder.new(@foundation)
        table_exists = ActiveRecord::Base.connection.table_exists?(@foundation.database_table_name)

        if table_exists
          # Skip removing reserved columns from DB (they're Rails auto-generated)
          unless TableBuilder::RESERVED_COLUMNS.include?(deleted_column_name)
            result = builder.remove_column(column_to_remove)
            unless result[:success]
              return render json: {
                success: false,
                errors: result[:errors]
              }, status: :unprocessable_entity
            end
          end
        end

        # Now destroy the column record
        @column.destroy

        # Remove column from all existing views for this foundation
        remove_column_from_views(deleted_column_name)

        # Reset the connection's schema cache
        ActiveRecord::Base.connection.schema_cache.clear_data_source_cache!(@foundation.database_table_name)

        render json: { success: true }
      end

      # GET /api/v1/foundations/:foundation_id/columns/:id/lookup_options
      def lookup_options
        column = @foundation.columns.find(params[:id])

        unless column.column_type.in?([ "lookup", "multiple_lookups" ])
          return render json: { error: "Not a lookup column" }, status: :bad_request
        end

        unless column.lookup_foundation
          return render json: { error: "Lookup foundation not configured" }, status: :unprocessable_entity
        end

        target_foundation = column.lookup_foundation
        records = target_foundation.dynamic_model.limit(1000).order(:id)

        options = records.map do |record|
          option = {
            id: record.id,
            display: record.send(column.lookup_display_column).to_s
          }
          # Include display_order if the lookup table has that column (for workflow sorting)
          # Check for common ordering column names: display_order, position, sort_order, order
          if record.respond_to?(:display_order)
            option[:display_order] = record.display_order
          elsif record.respond_to?(:position)
            option[:display_order] = record.position
          elsif record.respond_to?(:sort_order)
            option[:display_order] = record.sort_order
          elsif record.respond_to?(:order)
            option[:display_order] = record.order
          end
          option
        rescue => e
          Rails.logger.error "Error reading lookup value: #{e.message}"
          { id: record.id, display: "[Error]" }
        end

        render json: {
          success: true,
          options: options
        }
      rescue => e
        render json: { error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/foundations/:foundation_id/columns/test_formula
      def test_formula
        formula_expression = params[:formula]

        if formula_expression.blank?
          return render json: { error: "Formula is required" }, status: :bad_request
        end

        # Get a sample record to test with (first record or a specific one if provided)
        record_id = params[:record_id]
        model = @foundation.dynamic_model

        if record_id.present?
          record = model.find_by(id: record_id)
        else
          record = model.first
        end

        unless record
          return render json: {
            success: false,
            error: "No records available to test the formula. Please add at least one record first."
          }
        end

        # Build record data hash
        record_data = {}
        @foundation.columns.each do |column|
          record_data[column.column_name] = record.send(column.column_name) if record.respond_to?(column.column_name)
        end

        # Evaluate the formula
        evaluator = FormulaEvaluator.new(@foundation)
        result = evaluator.evaluate(formula_expression, record_data, record)

        # Check if formula uses cross-table references
        uses_cross_table = FormulaEvaluator.uses_cross_table_references?(formula_expression)

        render json: {
          success: true,
          result: result,
          uses_cross_table_refs: uses_cross_table,
          tested_with_record_id: record.id,
          sample_data: record_data.slice(*record_data.keys.first(5)) # Show first 5 fields as sample
        }
      rescue => e
        Rails.logger.error "Formula test error: #{e.message}"
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # GET /api/v1/foundations/:foundation_id/columns/:id/lookup_search?q=search_term
      def lookup_search
        column = @foundation.columns.find(params[:id])

        unless column.column_type.in?([ "lookup", "multiple_lookups" ])
          return render json: { error: "Not a lookup column" }, status: :bad_request
        end

        unless column.lookup_foundation
          return render json: { error: "Lookup foundation not configured" }, status: :unprocessable_entity
        end

        search_term = params[:q].to_s.strip
        target_foundation = column.lookup_foundation
        model = target_foundation.dynamic_model

        # If no search term, return top 20 recent records
        if search_term.blank?
          records = model.limit(20).order(created_at: :desc)
        else
          # Get all searchable columns from the target foundation
          searchable_columns = target_foundation.columns
            .where(searchable: true)
            .pluck(:column_name)

          # If no searchable columns defined, search all text/string columns
          if searchable_columns.empty?
            searchable_columns = target_foundation.columns
              .where(column_type: [ "single_line_text", "email", "phone", "url", "multiple_lines_text" ])
              .pluck(:column_name)
          end

          # Build search query across all searchable columns
          if searchable_columns.any?
            # Sanitize column names to prevent SQL injection
            search_conditions = searchable_columns.map { |col|
              "#{model.connection.quote_column_name(col)} ILIKE :search"
            }.join(" OR ")
            records = model.where(search_conditions, search: "%#{search_term}%")
              .limit(20)
              .order(:id)
          else
            # Fallback: just search the display column (sanitized)
            quoted_column = model.connection.quote_column_name(column.lookup_display_column)
            records = model.where(
              "#{quoted_column} ILIKE :search",
              search: "%#{search_term}%"
            ).limit(20).order(:id)
          end
        end

        # Performance: Cache text columns query outside the loop (avoids N+1)
        text_columns = target_foundation.columns
          .where(column_type: [ "single_line_text", "email", "phone", "url" ])
          .limit(3)
          .to_a

        # Build result with display value and additional context
        results = records.map do |record|
          # Get all text columns for context (using cached columns)
          context_fields = {}
          text_columns.each do |col|
            value = record.send(col.column_name)
            context_fields[col.name] = value if value.present?
          end

          {
            id: record.id,
            display: record.send(column.lookup_display_column).to_s,
            context: context_fields
          }
        rescue => e
          Rails.logger.error "Error reading lookup search result: #{e.message}"
          {
            id: record.id,
            display: "[Error]",
            context: {}
          }
        end

        render json: {
          success: true,
          results: results,
          count: results.length
        }
      rescue => e
        Rails.logger.error "Lookup search error: #{e.message}"
        render json: { error: e.message }, status: :internal_server_error
      end

      # GET /api/v1/foundations/:foundation_id/columns/:id/choices
      # Returns all unique values for a choice/select column with usage counts
      def choices
        column = find_column_by_id_or_name(params[:id])

        unless column.column_type.in?([ "single_select", "multi_select", "choice", "dropdown", "select" ])
          return render json: { error: "Not a choice column" }, status: :bad_request
        end

        model = @foundation.dynamic_model
        column_name = column.column_name

        # Get distinct values from actual data with counts
        data_choices = model
          .group(column_name)
          .count
          .map { |value, count| { value: value.to_s, count: count } }
          .reject { |c| c[:value].blank? }

        # Get manually-added available choices (with 0 count if not used yet)
        available_choices = column.available_choices || []
        available_choice_values = available_choices.map(&:to_s)

        # Merge: include all data choices + any available choices not yet used
        all_choice_values = (data_choices.map { |c| c[:value] } + available_choice_values).uniq

        # Build final choices list
        choices_data = all_choice_values.map do |value|
          existing = data_choices.find { |c| c[:value] == value }
          {
            value: value,
            count: existing ? existing[:count] : 0
          }
        end

        # Sort by saved order if it exists, otherwise alphabetically
        choices_data = if column.choices_order.present?
          # Sort by the saved order, putting unlisted items at the end alphabetically
          choices_data.sort_by do |c|
            index = column.choices_order.index(c[:value])
            [ index.nil? ? 1 : 0, index || 0, c[:value].downcase ]
          end
        else
          choices_data.sort_by { |c| c[:value].downcase }
        end

        total_records = model.count

        render json: {
          success: true,
          choices: choices_data,
          total_records: total_records
        }
      rescue => e
        Rails.logger.error "Error loading choices: #{e.message}"
        render json: { error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/foundations/:foundation_id/columns/:id/add_choice
      # Adds a new choice value (stored as metadata, no data modification)
      def add_choice
        column = find_column_by_id_or_name(params[:id])
        new_value = params[:value]

        if new_value.blank?
          return render json: { error: "value is required" }, status: :bad_request
        end

        unless column.column_type.in?([ "single_select", "multi_select", "choice", "dropdown", "select" ])
          return render json: { error: "Not a choice column" }, status: :bad_request
        end

        # Initialize available_choices array if it doesn't exist
        available_choices = column.available_choices || []

        # Check if choice already exists
        if available_choices.include?(new_value)
          return render json: { error: "Choice already exists" }, status: :bad_request
        end

        # Add the new choice
        available_choices << new_value
        column.update!(available_choices: available_choices)

        render json: {
          success: true,
          choices: available_choices
        }
      rescue => e
        Rails.logger.error "Error adding choice: #{e.message}"
        render json: { error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/foundations/:foundation_id/columns/:id/reorder_choices
      # Saves the display order for choice values (drag-and-drop persistence)
      def reorder_choices
        column = find_column_by_id_or_name(params[:id])
        new_order = params[:order] || []

        if new_order.empty?
          return render json: { error: "order array is required" }, status: :bad_request
        end

        unless column.column_type.in?([ "single_select", "multi_select", "choice", "dropdown", "select" ])
          return render json: { error: "Not a choice column" }, status: :bad_request
        end

        # Save the order
        column.update!(choices_order: new_order)

        render json: {
          success: true,
          choices_order: new_order
        }
      rescue => e
        Rails.logger.error "Error reordering choices: #{e.message}"
        render json: { error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/foundations/:foundation_id/columns/:id/rename_choice
      # Renames a choice value across all records
      def rename_choice
        column = find_column_by_id_or_name(params[:id])
        old_value = params[:old_value]
        new_value = params[:new_value]

        if old_value.blank? || new_value.blank?
          return render json: { error: "Both old_value and new_value are required" }, status: :bad_request
        end

        model = @foundation.dynamic_model
        column_name = column.column_name

        affected_rows = model.where(column_name => old_value).update_all(column_name => new_value)

        # Also update available_choices array if the old value exists there
        if column.available_choices.present? && column.available_choices.include?(old_value)
          updated_choices = column.available_choices.map { |c| c == old_value ? new_value : c }.uniq
          column.update(available_choices: updated_choices)
          Rails.logger.info "Renamed '#{old_value}' to '#{new_value}' in column #{column.id} available_choices"
        end

        render json: {
          success: true,
          affected_rows: affected_rows
        }
      rescue => e
        Rails.logger.error "Error renaming choice: #{e.message}"
        render json: { error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/foundations/:foundation_id/columns/:id/merge_choices
      # Merges multiple choice values into one
      def merge_choices
        column = find_column_by_id_or_name(params[:id])
        source_values = params[:source_values] || []
        target_value = params[:target_value]

        if source_values.empty? || target_value.blank?
          return render json: { error: "source_values and target_value are required" }, status: :bad_request
        end

        model = @foundation.dynamic_model
        column_name = column.column_name

        affected_rows = model.where(column_name => source_values).update_all(column_name => target_value)

        # Also update available_choices array - remove merged source values
        if column.available_choices.present?
          # Remove source values from available_choices (they're now merged into target)
          updated_choices = column.available_choices.reject { |c| source_values.include?(c) }
          # Ensure target_value is in the list (add if not present)
          updated_choices << target_value unless updated_choices.include?(target_value)
          column.update(available_choices: updated_choices)
          Rails.logger.info "Merged #{source_values.inspect} into '#{target_value}' in column #{column.id} available_choices"
        end

        render json: {
          success: true,
          affected_rows: affected_rows
        }
      rescue => e
        Rails.logger.error "Error merging choices: #{e.message}"
        render json: { error: e.message }, status: :internal_server_error
      end

      # DELETE /api/v1/foundations/:foundation_id/columns/:id/delete_choice
      # Deletes a choice by either clearing values or replacing with another value
      def delete_choice
        column = find_column_by_id_or_name(params[:id])
        value = params[:value]
        replacement_value = params[:replacement_value]

        if value.blank?
          return render json: { error: "value is required" }, status: :bad_request
        end

        model = @foundation.dynamic_model
        column_name = column.column_name

        # Update or clear data rows that use this choice
        if replacement_value.present?
          affected_rows = model.where(column_name => value).update_all(column_name => replacement_value)
        else
          affected_rows = model.where(column_name => value).update_all(column_name => nil)
        end

        # Also remove from available_choices array if it exists there
        if column.available_choices.present? && column.available_choices.include?(value)
          updated_choices = column.available_choices.reject { |c| c == value }
          column.update(available_choices: updated_choices)
          Rails.logger.info "Removed '#{value}' from column #{column.id} available_choices"
        end

        render json: {
          success: true,
          affected_rows: affected_rows
        }
      rescue => e
        Rails.logger.error "Error deleting choice: #{e.message}"
        render json: { error: e.message }, status: :internal_server_error
      end

      private

      def set_foundation
        @foundation = Foundation.includes(:columns).find(params[:foundation_id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Foundation not found" }, status: :not_found
      end

      def set_column
        @column = @foundation.columns.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Column not found" }, status: :not_found
      end

      # Find column by numeric ID or by column_name string
      def find_column_by_id_or_name(id_or_name)
        if id_or_name.to_s.match?(/^\d+$/)
          @foundation.columns.find(id_or_name)
        else
          @foundation.columns.find_by!(column_name: id_or_name)
        end
      rescue ActiveRecord::RecordNotFound
        raise ActiveRecord::RecordNotFound, "Column not found: #{id_or_name}"
      end

      def column_params
        permitted = params.require(:column).permit(
          :name,
          :column_name,
          :column_type,
          :column_group,
          :max_length,
          :min_length,
          :default_value,
          :description,
          :searchable,
          :is_title,
          :is_unique,
          :required,
          :min_value,
          :max_value,
          :validation_message,
          :lookup_foundation_id,
          :lookup_foundation_slug,  # SSoT: Prefer slug over ID
          :lookup_display_column,
          :is_multiple,
          :header_align,
          :data_align,
          available_choices: [],
          choice_descriptions: {}  # SSoT: descriptions for each choice value
        )

        # SSoT: If slug is provided, use it as the input for resolution
        if permitted[:lookup_foundation_slug].present?
          permitted[:lookup_foundation_slug_input] = permitted.delete(:lookup_foundation_slug)
        end

        permitted
      end

      def column_json(column)
        {
          id: column.id,
          name: column.name,
          column_name: column.column_name,
          column_type: column.column_type,
          column_group: column.column_group,
          max_length: column.max_length,
          min_length: column.min_length,
          default_value: column.default_value,
          description: column.description,
          searchable: column.searchable != false, # SSoT: Never return NULL, default to true
          is_title: column.is_title,
          is_unique: column.is_unique,
          required: column.required,
          min_value: column.min_value,
          max_value: column.max_value,
          validation_message: column.validation_message,
          position: column.position,
          lookup_foundation_id: column.lookup_foundation_id,
          lookup_foundation_slug: column.lookup_foundation_slug,  # SSoT: Always return slug
          lookup_display_column: column.lookup_display_column,
          is_multiple: column.is_multiple,
          has_cross_table_refs: column.has_cross_table_refs,
          header_align: column.header_align || "left",
          data_align: column.data_align || "left"
        }
      end

      # Add a new column to all existing views for this foundation
      # This ensures views stay in sync when columns are added
      def add_column_to_existing_views(column)
        views = FoundationView.where(foundation_id: @foundation.id)
        updated_count = 0

        views.each do |view|
          next unless view.columns.is_a?(Hash)

          # Add to visible columns (visible by default for new columns)
          if view.columns["visible"].is_a?(Hash)
            view.columns["visible"][column.column_name] = true
          end

          # Add to column order (at the end)
          if view.columns["order"].is_a?(Array)
            unless view.columns["order"].include?(column.column_name)
              view.columns["order"] << column.column_name
            end
          end

          if view.save
            updated_count += 1
            Rails.logger.info "[Column Create] Added column '#{column.column_name}' to view '#{view.name}' (ID: #{view.id})"
          else
            Rails.logger.error "[Column Create] Failed to update view '#{view.name}': #{view.errors.full_messages.join(', ')}"
          end
        end

        Rails.logger.info "[Column Create] Updated #{updated_count} views for foundation #{@foundation.id} with new column '#{column.column_name}'"
      end

      # Remove a deleted column from all existing views for this foundation
      # This ensures views stay in sync when columns are deleted
      def remove_column_from_views(column_name)
        views = FoundationView.where(foundation_id: @foundation.id)
        updated_count = 0

        views.each do |view|
          next unless view.columns.is_a?(Hash)
          modified = false

          # Remove from visible columns
          if view.columns["visible"].is_a?(Hash) && view.columns["visible"].key?(column_name)
            view.columns["visible"].delete(column_name)
            modified = true
          end

          # Remove from column order
          if view.columns["order"].is_a?(Array) && view.columns["order"].include?(column_name)
            view.columns["order"].delete(column_name)
            modified = true
          end

          if modified && view.save
            updated_count += 1
            Rails.logger.info "[Column Delete] Removed column '#{column_name}' from view '#{view.name}' (ID: #{view.id})"
          elsif modified
            Rails.logger.error "[Column Delete] Failed to update view '#{view.name}': #{view.errors.full_messages.join(', ')}"
          end
        end

        Rails.logger.info "[Column Delete] Updated #{updated_count} views for foundation #{@foundation.id}, removed column '#{column_name}'"
      end

      # Check if column is referenced by lookups or formulas
      def check_column_references(column)
        warnings = []

        # Check if this column is used as a lookup display column by other foundations
        lookup_refs = Column.where(lookup_foundation_id: column.foundation_id, lookup_display_column: column.column_name)
        if lookup_refs.any?
          lookup_refs.each do |ref|
            ref_foundation = ref.foundation
            warnings << {
              type: "lookup",
              message: "Column '#{ref.name}' in foundation '#{ref_foundation&.name || 'Unknown'}' uses this column as its display value",
              column_id: ref.id,
              column_name: ref.name,
              foundation_id: ref_foundation&.id,
              foundation_name: ref_foundation&.name
            }
          end
        end

        # Check if this column is referenced in computed/formula columns (same foundation)
        formula_refs = @foundation.columns.where(column_type: "computed")
        formula_refs.each do |formula_col|
          # Check if the formula references this column name
          # Formulas typically reference columns by name like {column_name} or column_name
          formula = formula_col.default_value.to_s
          if formula.include?(column.column_name) || formula.include?("{#{column.column_name}}")
            warnings << {
              type: "formula",
              message: "Formula column '#{formula_col.name}' references this column",
              column_id: formula_col.id,
              column_name: formula_col.name,
              foundation_id: @foundation.id,
              foundation_name: @foundation.name
            }
          end
        end

        # Check if this column is used as a lookup display column within the same foundation
        same_foundation_lookups = @foundation.columns.where(column_type: [ "lookup", "multiple_lookups" ])
          .where(lookup_display_column: column.column_name)
        same_foundation_lookups.each do |lookup_col|
          warnings << {
            type: "lookup_display",
            message: "Lookup column '#{lookup_col.name}' uses this column as its display value",
            column_id: lookup_col.id,
            column_name: lookup_col.name,
            foundation_id: @foundation.id,
            foundation_name: @foundation.name
          }
        end

        warnings
      end

      # Auto-detect Australian column types based on column name (Gold Standard compliance)
      # Returns the appropriate Gold Standard column type or "single_line_text" as fallback
      def auto_detect_australian_column_type(column_name)
        case column_name.to_s
        when /^(tax_number|abn)$/i
          "abn"
        when /^(company_number|acn)$/i
          "acn"
        when /^(bank_bsb|bsb)$/i
          "bsb"
        when /^(bank_account_number|bank_account)$/i
          "bank_account"
        when /^postcode$/i
          "postcode"
        when /^tfn$/i
          "tfn"
        else
          "single_line_text" # Default fallback
        end
      end
    end
  end
end
