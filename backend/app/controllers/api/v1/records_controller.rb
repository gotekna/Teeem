module Api
  module V1
    class RecordsController < ApplicationController
      before_action :set_foundation

      # GET /api/v1/foundations/:foundation_id/records
      def index
        # Sanitize and validate pagination parameters to prevent DoS
        page = [ (params[:page] || 1).to_i, 1 ].max
        per_page = [ (params[:per_page] || 50).to_i, 1 ].max

        # Support minimal fields for fast initial loading
        fields_mode = params[:fields] # 'minimal' or nil (full)

        # For minimal mode, allow loading all records at once (it's lightweight)
        if fields_mode == "minimal"
          per_page = [ per_page, 20000 ].min  # Allow up to 20K items in minimal mode
        else
          per_page = [ per_page, 10000 ].min  # Cap at 10000 to prevent DoS
        end

        search = params[:search]
        search_all = params[:search_all] == "true" # Search all text columns instead of just searchable ones
        sort_by = params[:sort_by]
        sort_direction = params[:sort_direction]&.downcase == "desc" ? "desc" : "asc"

        model = @foundation.dynamic_model
        query = model.all

        # Include associations for system tables to prevent N+1 queries
        if @foundation.table_type == "system"
          query = apply_system_table_includes(query, model)
        end

        # Exclude soft-deleted records if the table has a 'deleted' column
        if model.column_names.include?("deleted")
          query = query.where(deleted: [ false, nil ])
        end

        # Apply duplicates_only filter for Contacts
        if params[:duplicates_only] == "true" && model.table_name == "contacts"
          duplicate_ids = find_duplicate_contact_ids
          query = query.where(id: duplicate_ids)
        end

        # Apply search filter with fuzzy matching support (pg_trgm)
        if search.present?
          searchable_columns = if @foundation.table_type == "system"
            if search_all
              # Search all text columns from the model (slower but comprehensive)
              # Exclude array columns (e.g., roles) as ILIKE doesn't work on arrays
              model.columns.select { |c| [ :string, :text ].include?(c.type) && !c.array }.map(&:name)
            else
              # For system tables, use a predefined list of key searchable columns (fast)
              # These are the columns users typically want to search
              system_searchable = {
                "contacts" => %w[display_name first_name last_name email company_name_or_trust mobile_phone office_phone notes],
                "constructions" => %w[name description address status],
                "jobs" => %w[title location ted_number]
              }
              table_name = model.table_name
              system_searchable[table_name] || model.columns.select { |c| [ :string, :text ].include?(c.type) && !c.array }.map(&:name).first(5)
            end
          elsif search_all
            # Search all text-like columns when search_all is enabled
            text_types = %w[single_line_text multiple_lines_text email phone url]
            @foundation.columns.where(column_type: text_types).pluck(:column_name)
          else
            @foundation.columns.where(searchable: true).pluck(:column_name)
          end
          if searchable_columns.any?
            # Build search conditions: exact ILIKE OR fuzzy similarity (pg_trgm)
            # Fuzzy search catches typos like "coasal" -> "coastal"
            sanitized_search = ActiveRecord::Base.connection.quote(search)
            conn = ActiveRecord::Base.connection

            # ILIKE conditions for exact substring matches
            # Security: Quote column names to prevent SQL injection
            ilike_conditions = searchable_columns.map { |col| "#{conn.quote_column_name(col)} ILIKE :search" }.join(" OR ")

            # Fuzzy word_similarity conditions (matches search term against words in text)
            # word_similarity > 0.4 catches typos like "tekan" -> "Tekna Admin"
            # Only apply to first few columns to keep it fast
            fuzzy_columns = searchable_columns.first(3)
            fuzzy_conditions = fuzzy_columns.map { |col| "word_similarity(#{sanitized_search}, COALESCE(#{conn.quote_column_name(col)}, '')) > 0.4" }.join(" OR ")

            # Combine: match if ILIKE OR fuzzy match
            combined_conditions = "(#{ilike_conditions}) OR (#{fuzzy_conditions})"
            query = query.where(combined_conditions, search: "%#{search}%")
          end
        end

        # Apply sorting with SQL injection prevention
        if sort_by.present?
          # For system foundations, validate against model columns
          valid_columns = if @foundation.table_type == "system"
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
        if fields_mode == "minimal"
          essential_columns = determine_essential_columns(@foundation, params[:view_id])
          query = query.select(*essential_columns) if essential_columns.any?
        end

        # Paginate
        records = query.offset((page - 1) * per_page).limit(per_page)

        # Build lookup cache to prevent N+1 queries (only for user foundations with lookup columns)
        lookup_cache = @foundation.table_type == "system" ? {} : build_lookup_cache(records)

        render json: {
          success: true,
          records: records.map { |r| record_to_json(r, lookup_cache) },
          pagination: {
            page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          },
          fields_mode: fields_mode || "full", # Indicate which mode was used
          progressive_loading: fields_mode == "minimal" # Flag for frontend
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
        render json: { error: "Record not found" }, status: :not_found
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
        render json: { error: "Record not found" }, status: :not_found
      rescue => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # DELETE /api/v1/foundations/:foundation_id/records/:id
      def destroy
        model = @foundation.dynamic_model
        record = model.find(params[:id])

        # For contacts, check if it has related records
        # If no records, hard delete. If has records, soft delete (archive).
        if model.table_name == "contacts"
          has_records = contact_has_records?(record)

          if has_records
            # Soft delete - archive the contact (can be recovered)
            record.update!(deleted: true)
          else
            # Hard delete - no related records, safe to remove completely
            record.destroy!
          end
        elsif model.column_names.include?("deleted")
          # Other tables with deleted column: soft delete
          record.update!(deleted: true)
        else
          # Tables without deleted column: hard delete
          record.destroy!
        end

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Record not found" }, status: :not_found
      end

      # POST /api/v1/foundations/:foundation_id/records/bulk_update
      def bulk_update
        model = @foundation.dynamic_model
        record_ids = params[:record_ids]
        updates = params[:updates]&.to_unsafe_h || {}

        if record_ids.blank?
          return render json: { error: "No record IDs provided" }, status: :unprocessable_entity
        end

        if updates.blank?
          return render json: { error: "No updates provided" }, status: :unprocessable_entity
        end

        # Get valid column names for this foundation
        valid_columns = if @foundation.table_type == "system"
          model.column_names
        else
          @foundation.columns.pluck(:column_name)
        end

        # Filter updates to only valid columns
        filtered_updates = updates.select { |k, _| valid_columns.include?(k.to_s) }

        if filtered_updates.blank?
          return render json: { error: "No valid columns to update" }, status: :unprocessable_entity
        end

        # Special handling for Contact model's roles column
        # Convert lookup IDs to string values (same as single record update)
        if @foundation.model_class == "Contact" && filtered_updates.key?("roles")
          value = filtered_updates["roles"]
          if value.is_a?(Array) && value.first.is_a?(Integer)
            roles_col = @foundation.columns.find_by(column_name: "roles")
            if roles_col&.lookup_foundation_id.present?
              lookup_foundation = Foundation.find_by(id: roles_col.lookup_foundation_id)
              if lookup_foundation
                lookup_model = lookup_foundation.dynamic_model
                display_col = roles_col.lookup_display_column || "display_name"
                string_values = lookup_model.where(id: value).pluck(display_col).map do |display|
                  display.to_s.downcase.gsub(" ", "_")
                end
                filtered_updates["roles"] = string_values
              end
            end
          end
        end

        updated_count = 0
        errors = []

        ActiveRecord::Base.transaction do
          record_ids.each do |id|
            record = model.find_by(id: id)
            if record
              # Special handling for Contact entity_type changes
              # Auto-populate company_name_or_trust when changing to company/trust
              if @foundation.model_class == "Contact" && filtered_updates.key?("entity_type")
                new_entity_type = filtered_updates["entity_type"]
                if [ "company", "trust" ].include?(new_entity_type)
                  # If company_name_or_trust is blank, set it to display_name
                  if record.company_name_or_trust.blank? && record.display_name.present?
                    filtered_updates["company_name_or_trust"] = record.display_name
                  end
                end
              end

              if record.update(filtered_updates)
                updated_count += 1
              else
                errors << { id: id, errors: record.errors.full_messages }
              end
            else
              errors << { id: id, errors: [ "Record not found" ] }
            end
          end
        end

        render json: {
          success: errors.empty?,
          updated_count: updated_count,
          total_requested: record_ids.size,
          errors: errors
        }
      rescue => e
        render json: { error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/foundations/:foundation_id/records/:id/merge
      # Merge multiple records into one primary record
      # Params:
      #   - secondary_ids: Array of record IDs to merge into the primary
      def merge
        model = @foundation.dynamic_model
        primary = model.find(params[:id])
        secondary_ids = params[:secondary_ids]

        if secondary_ids.blank?
          return render json: { error: "No secondary record IDs provided" }, status: :unprocessable_entity
        end

        secondaries = model.where(id: secondary_ids)

        if secondaries.empty?
          return render json: { error: "No valid secondary records found" }, status: :unprocessable_entity
        end

        service = GenericMergeService.new(primary, secondaries, model)
        result = service.merge!

        render json: {
          success: true,
          record: record_to_json(result),
          merged_count: service.merged_count,
          message: "Successfully merged #{service.merged_count} record(s) into primary record"
        }
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Primary record not found" }, status: :not_found
      rescue => e
        Rails.logger.error "Merge failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
        render json: { error: "Merge failed: #{e.message}" }, status: :unprocessable_entity
      end

      # POST /api/v1/foundations/:foundation_id/records/bulk_delete
      def bulk_delete
        model = @foundation.dynamic_model
        ids = params[:ids]  # Changed from record_ids to ids for consistency with other bulk_delete endpoints

        if ids.blank?
          return render json: { error: "No record IDs provided" }, status: :unprocessable_entity
        end

        deleted_count = 0
        errors = []

        ActiveRecord::Base.transaction do
          ids.each do |id|
            record = model.find_by(id: id)
            if record
              record.destroy
              deleted_count += 1
            else
              errors << { id: id, errors: [ "Record not found" ] }
            end
          end
        end

        render json: {
          success: errors.empty?,
          deleted_count: deleted_count,
          total_requested: ids.size,
          errors: errors
        }
      rescue => e
        render json: { error: e.message }, status: :internal_server_error
      end

      private

      # Check if a contact has any related records that would require soft delete
      def contact_has_records?(contact)
        # Check key associations that indicate this contact has history
        return true if contact.job_contacts.exists?
        return true if contact.purchase_orders.exists?
        return true if contact.external_invoices.exists?
        return true if contact.subcontractor_invoices.exists?
        return true if contact.quote_responses.exists?
        return true if contact.quote_request_contacts.exists?
        return true if contact.pricebook_items.exists?
        return true if contact.case_contacts.exists?
        return true if contact.corporate_company_directorships.exists?
        return true if contact.corporate_company_shareholdings.exists?
        return true if contact.contact_activities.exists?

        false
      end

      def set_foundation
        # Support both ID and slug
        @foundation = if params[:foundation_id].to_i.to_s == params[:foundation_id]
          Foundation.includes(:columns).find(params[:foundation_id])
        else
          Foundation.includes(:columns).find_by!(slug: params[:foundation_id])
        end
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Foundation not found" }, status: :not_found
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
              [ "select", "actions" ].include?(col) || !valid_column_names.include?(col)
            end

            Rails.logger.info "[Progressive Loading] Validated columns: #{db_columns.inspect}" if db_columns.size != view.visible_columns.size
            return [ :id, :created_at, :updated_at ] + db_columns.map(&:to_sym)
          end
        end

        # PHASE 2: Smart defaults based on column metadata
        if foundation.table_type == "system"
          # For system foundations, use model introspection
          model = foundation.dynamic_model
          # Get first 5 non-system columns
          essential = model.column_names
            .reject { |col| [ "created_at", "updated_at", "id" ].include?(col) }
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
        [ :id, :created_at, :updated_at ] + essential
      end

      def record_params
        # Get all column names for this foundation
        columns = @foundation.columns

        # Build permit list - arrays need special handling
        permit_list = columns.map do |col|
          if col.column_type == "multiple_lookups"
            # multiple_lookups columns accept arrays of IDs
            { col.column_name.to_sym => [] }
          else
            col.column_name.to_sym
          end
        end

        permitted = params.require(:record).permit(*permit_list)

        # Convert multiple_lookups arrays to JSON strings for storage in TEXT columns
        # BUT NOT for system tables - they use native PostgreSQL arrays
        unless @foundation.table_type == "system" && @foundation.model_class.present?
          columns.each do |col|
            col_name = col.column_name
            # Check both string and symbol keys
            if col.column_type == "multiple_lookups" && (permitted.key?(col_name) || permitted.key?(col_name.to_sym))
              value = permitted[col_name] || permitted[col_name.to_sym]
              if value.is_a?(Array)
                permitted[col_name] = value.to_json
              end
            end
          end
        end

        # Special handling for Contact model's roles column
        # It stores string values like ["customer", "supplier"] but receives lookup IDs
        if @foundation.model_class == "Contact" && permitted.key?("roles")
          value = permitted["roles"]
          if value.is_a?(Array) && value.first.is_a?(Integer)
            # Map lookup IDs to their string values from the ContactRole lookup table
            roles_col = columns.find { |c| c.column_name == "roles" }
            if roles_col&.lookup_foundation_id.present?
              lookup_foundation = Foundation.find_by(id: roles_col.lookup_foundation_id)
              if lookup_foundation
                lookup_model = lookup_foundation.dynamic_model
                display_col = roles_col.lookup_display_column || "display_name"
                # Fetch the display values and convert to lowercase snake_case
                string_values = lookup_model.where(id: value).pluck(display_col).map do |display|
                  display.to_s.downcase.gsub(" ", "_")
                end
                permitted["roles"] = string_values
              end
            end
          end
        end

        permitted
      end

      # Apply default values for required fields that are blank
      def apply_default_values(model, attributes)
        attrs = attributes.to_h.with_indifferent_access

        # Handle Job model specifically
        if model == Job
          attrs[:title] = "New Job" if attrs[:title].blank?
          # Note: job_status_id is a lookup field - don't set a default here
          # The user should select a status from the lookup dropdown
          attrs[:site_supervisor_name] = "TBA" if attrs[:site_supervisor_name].blank?
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
        if @foundation.table_type == "system"
          record.attributes.each do |key, value|
            next if [ "id", "created_at", "updated_at" ].include?(key)
            # Use send to go through model accessors (which may have safe decryption wrappers)
            begin
              attr_value = record.send(key)
              # Skip if this returned an ActiveRecord object (association) - these should only be IDs
              json[key] = attr_value.is_a?(ActiveRecord::Base) ? nil : attr_value
            rescue ActiveRecord::Encryption::Errors::Decryption => e
              Rails.logger.warn "Decryption failed for #{record.class.name}##{record.id}.#{key}: #{e.message}"
              json[key] = nil
            rescue => e
              Rails.logger.warn "Error reading #{record.class.name}##{record.id}.#{key}: #{e.message}"
              json[key] = value
            end
          end

          # Expand _id columns to include display value for lookup columns
          # e.g., job_type_id => { id: 1, display: "Residential" }
          record.attributes.keys.select { |k| k.to_s.end_with?("_id") && k != "id" }.each do |id_column|
            association_name = id_column.to_s.sub(/_id$/, "")
            if record.respond_to?(association_name)
              begin
                related = record.send(association_name)
                if related
                  # Use centralized DisplayValueResolver (SSoT for display values)
                  display_value = DisplayValueResolver.resolve(related)
                  json[id_column] = { id: json[id_column], display: display_value }
                end
              rescue => e
                Rails.logger.warn "Error expanding #{association_name}: #{e.message}"
              end
            end
          end

          # Expand multiple_lookups columns for system tables (e.g., roles)
          @foundation.columns.where(column_type: "multiple_lookups").each do |column|
            value = json[column.column_name]
            next if value.blank?

            begin
              # Parse the stored value - could be JSON string or array
              parsed_values = if value.is_a?(String)
                JSON.parse(value) rescue []
              else
                Array(value)
              end

              # For Contact model's roles, values are strings like ["customer", "supplier"]
              if parsed_values.any? && parsed_values.first.is_a?(String)
                json[column.column_name] = parsed_values.map do |str_value|
                  { id: str_value, display_value: str_value.to_s.titleize }
                end
              elsif parsed_values.any? && column.lookup_foundation.present?
                # Values are IDs - look up display values
                lookup_model = column.lookup_foundation.dynamic_model
                display_col = column.lookup_display_column || "name"
                related_records = lookup_model.where(id: parsed_values).index_by(&:id)

                json[column.column_name] = parsed_values.map do |lookup_id|
                  related = related_records[lookup_id.to_i]
                  {
                    id: lookup_id,
                    display_value: related ? related.send(display_col).to_s : "[Deleted ##{lookup_id}]"
                  }
                end
              else
                json[column.column_name] = []
              end
            rescue => e
              Rails.logger.error "Error expanding multiple_lookups #{column.column_name}: #{e.message}"
            end
          end

          # Add computed columns for contacts (employees_count for companies, display_name for team contacts)
          if record.class.name == "Contact"
            json[:employees_count] = record.employees_count  # Cached column (counter_cache)
            json[:display_name] = record.display_name  # Computed: includes company name for team contacts
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
          if column.column_type == "computed"
            formula_expression = column.settings&.dig("formula")
            if formula_expression.present?
              # Pass the record instance for cross-table references
              json[column.column_name] = formula_evaluator.evaluate(formula_expression, record_data, record)
            else
              json[column.column_name] = nil
            end
          # Handle lookup columns - return both ID and display value
          elsif column.column_type == "lookup" && value.present?
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
          # Handle multiple_lookups columns - return array of objects with id and display
          elsif column.column_type == "multiple_lookups" && value.present?
            begin
              # Parse the stored value - could be JSON string or array
              parsed_values = if value.is_a?(String)
                JSON.parse(value) rescue []
              else
                Array(value)
              end

              # For Contact model's roles, values are strings like ["customer", "supplier"]
              # Convert them to display format for the frontend
              if parsed_values.any? && parsed_values.first.is_a?(String)
                # Values are already strings (like roles) - display as-is
                json[column.column_name] = parsed_values.map do |str_value|
                  { id: str_value, display_value: str_value.to_s.titleize }
                end
              elsif parsed_values.any? && column.lookup_foundation.present?
                # Values are IDs - look up display values from the lookup table
                lookup_model = column.lookup_foundation.dynamic_model
                display_col = column.lookup_display_column || "name"
                related_records = lookup_model.where(id: parsed_values).index_by(&:id)

                json[column.column_name] = parsed_values.map do |lookup_id|
                  related = related_records[lookup_id.to_i]
                  {
                    id: lookup_id,
                    display_value: related ? related.send(display_col).to_s : "[Deleted ##{lookup_id}]"
                  }
                end
              else
                json[column.column_name] = []
              end
            rescue => e
              Rails.logger.error "Error loading multiple_lookups value for #{column.column_name}: #{e.message}"
              json[column.column_name] = []
            end
          else
            json[column.column_name] = value
          end
        end

        json
      end

      def build_lookup_cache(records)
        # Preload all lookup data to prevent N+1 queries
        lookup_columns = @foundation.columns.where(column_type: "lookup").includes(:lookup_foundation)
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

      # Find all contact IDs that are possible duplicates (share normalized name with another contact)
      def find_duplicate_contact_ids
        contacts_by_name = Contact.where(deleted: [ false, nil ])
          .select(:id, :display_name)
          .group_by { |c| normalize_contact_name(c.display_name) }

        duplicate_ids = []
        contacts_by_name.each do |normalized_name, contacts|
          next if normalized_name.blank?
          next if contacts.size < 2
          duplicate_ids.concat(contacts.map(&:id))
        end
        duplicate_ids
      end

      def normalize_contact_name(name)
        return nil if name.blank?
        name.to_s.downcase.gsub(/\s+/, " ").strip
      end

      # Apply eager loading for system table associations to prevent N+1 queries
      def apply_system_table_includes(query, model)
        case model.name
        when "Job"
          query.includes(:job_type, :job_status, :job_stage)
        when "Contact"
          query.includes(:corporate_group, :primary_company)
        when "Company"
          query.includes(:corporate_group, :parent_company)
        else
          query
        end
      end
    end
  end
end
