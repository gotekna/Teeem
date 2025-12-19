module Api
  module V1
    class RecordsController < ApplicationController
      before_action :set_foundation

      # GET /api/v1/foundations/:foundation_id/records
      def index
        # Sanitize and validate pagination parameters to prevent DoS
        # Support both 'limit' (new cursor pagination) and 'per_page' (legacy offset pagination)
        page = [ (params[:page] || 1).to_i, 1 ].max
        limit_or_per_page = params[:limit]&.to_i || params[:per_page]&.to_i || 50
        per_page = [ limit_or_per_page, 1 ].max
        per_page = [ per_page, 10000 ].min  # Cap at 10000 to prevent DoS

        search = params[:search]
        search_all = params[:search_all] == "true" # Search all text columns instead of just searchable ones
        sort_by = params[:sort_by]
        sort_direction = params[:sort_direction]&.downcase == "desc" ? "desc" : "asc"

        model = @foundation.dynamic_model
        query = model.all

        # SSoT: Auto-eager-load ALL associations for ANY table to prevent N+1 queries
        # This works for both system tables and user-created tables
        query = apply_eager_loading(query, model)

        # CRITICAL: Add distinct to prevent duplicates caused by JOINs from eager loading
        # When a record has multiple associations (e.g., Contact with multiple external_links),
        # includes() creates LEFT OUTER JOINs that produce duplicate rows
        query = query.distinct

        # Exclude soft-deleted records if the table has a 'deleted' column
        if model.column_names.include?("deleted")
          query = query.where(deleted: [ false, nil ])
        end

        # Exclude archived contacts (is_active=false) unless explicitly requested
        if model.table_name == "contacts" && params[:include_archived] != "true"
          query = query.where(is_active: [ true, nil ])
        end

        # Apply duplicates_only filter for Contacts
        if params[:duplicates_only] == "true" && model.table_name == "contacts"
          duplicate_ids = find_duplicate_contact_ids
          query = query.where(id: duplicate_ids)
        end

        # Apply search filter with multiple search modes
        # SSoT: Foundation column `searchable: true` is the source of truth for ALL tables
        # Search modes: contains (default), exact, starts_with, fuzzy, regex
        if search.present?
          search_mode = params[:search_mode] || "contains"

          searchable_columns = if search_all
            # Search ALL text columns (comprehensive but slower)
            if @foundation.table_type == "system"
              model.columns.select { |c| [ :string, :text ].include?(c.type) && !c.array }.map(&:name)
            else
              text_types = %w[single_line_text multiple_lines_text email phone url]
              @foundation.columns.where(column_type: text_types).pluck(:column_name)
            end
          else
            # SSoT: Use foundation's searchable column definitions (works for ALL tables)
            foundation_searchable = @foundation.columns.where(searchable: true).pluck(:column_name)

            if foundation_searchable.any?
              # Filter out array columns to prevent ILIKE errors
              array_columns = model.columns.select(&:array).map(&:name)
              foundation_searchable.reject { |col| array_columns.include?(col) }
            elsif @foundation.table_type == "system"
              # Fallback for system tables without column definitions: auto-detect text columns
              model.columns.select { |c| [ :string, :text ].include?(c.type) && !c.array }.map(&:name).first(5)
            else
              []
            end
          end

          if searchable_columns.any?
            conn = ActiveRecord::Base.connection
            sanitized_search = conn.quote(search)

            # Get column type information to handle non-text columns
            column_types = model.columns.each_with_object({}) { |c, h| h[c.name] = c.type }

            # Helper to get SQL-safe column reference with optional TEXT casting
            get_column_sql = ->(col) {
              if [:integer, :bigint, :decimal, :float, :boolean, :date, :datetime].include?(column_types[col])
                "CAST(#{conn.quote_column_name(col)} AS TEXT)"
              else
                conn.quote_column_name(col)
              end
            }

            case search_mode
            when "exact"
              # Exact case-insensitive match
              conditions = searchable_columns.map do |col|
                "LOWER(#{get_column_sql.call(col)}) = LOWER(:search)"
              end.join(" OR ")
              query = query.where(conditions, search: search)

            when "starts_with"
              # Prefix match (ILIKE term%)
              conditions = searchable_columns.map do |col|
                "#{get_column_sql.call(col)} ILIKE :search"
              end.join(" OR ")
              query = query.where(conditions, search: "#{search}%")

            when "fuzzy"
              # Trigram similarity search for typo tolerance
              # Uses pg_trgm's word_similarity function
              fuzzy_columns = searchable_columns.first(5) # Limit for performance
              fuzzy_conditions = fuzzy_columns.map do |col|
                "word_similarity(#{sanitized_search}, COALESCE(#{get_column_sql.call(col)}, '')) > 0.3"
              end.join(" OR ")

              # Also include ILIKE as fallback for short terms (trigrams work better with 3+ chars)
              ilike_conditions = searchable_columns.map do |col|
                "#{get_column_sql.call(col)} ILIKE :search"
              end.join(" OR ")

              combined = "(#{ilike_conditions}) OR (#{fuzzy_conditions})"
              query = query.where(combined, search: "%#{search}%")

              # Order by similarity for fuzzy results (best matches first)
              if fuzzy_columns.any?
                primary_col = get_column_sql.call(fuzzy_columns.first)
                query = query.order(Arel.sql("word_similarity(#{sanitized_search}, COALESCE(#{primary_col}, '')) DESC"))
              end

            when "regex"
              # PostgreSQL regex search (~* for case-insensitive)
              # Note: This can be slow and dangerous with complex patterns
              begin
                # Validate regex is valid before executing
                Regexp.new(search)
                conditions = searchable_columns.map do |col|
                  "#{get_column_sql.call(col)} ~* :search"
                end.join(" OR ")
                query = query.where(conditions, search: search)
              rescue RegexpError => e
                Rails.logger.warn "Invalid regex search pattern: #{search} - #{e.message}"
                # Fall back to contains search for invalid regex
                conditions = searchable_columns.map do |col|
                  "#{get_column_sql.call(col)} ILIKE :search"
                end.join(" OR ")
                query = query.where(conditions, search: "%#{search}%")
              end

            else # "contains" (default)
              # Substring match (ILIKE %term%)
              conditions = searchable_columns.map do |col|
                "#{get_column_sql.call(col)} ILIKE :search"
              end.join(" OR ")
              query = query.where(conditions, search: "%#{search}%")
            end
          end
        end

        # Apply cascade filters (sent from frontend view state)
        # Filters format: [{ column: "status", operator: "=", value: "Active", groupId: "group1" }, ...]
        # Groups format: [{ id: "group1", logic: "AND" }, ...]
        # Inter-group logic: "AND" or "OR"
        if params[:filters].present?
          begin
            filters = JSON.parse(params[:filters])
            filter_groups = params[:filter_groups].present? ? JSON.parse(params[:filter_groups]) : []
            inter_group_logic = params[:inter_group_logic] || "AND"

            # Group filters by groupId
            filters_by_group = filters.group_by { |f| f["groupId"] || "default" }

            # Build group conditions
            group_conditions = filters_by_group.map do |group_id, group_filters|
              # Get group logic (AND/OR within group)
              group = filter_groups.find { |g| g["id"] == group_id }
              group_logic = group&.dig("logic") || "AND"

              # Build conditions for this group
              filter_conditions = group_filters.map do |filter|
                column = filter["column"]
                operator = filter["operator"]
                value = filter["value"]

                # Validate column exists
                valid_columns = if @foundation.table_type == "system"
                  model.column_names
                else
                  @foundation.columns.pluck(:column_name)
                end

                next nil unless valid_columns.include?(column)

                # Build SQL condition based on operator
                conn = ActiveRecord::Base.connection
                quoted_column = conn.quote_column_name(column)

                case operator
                when "="
                  ["#{quoted_column} = ?", value]
                when "!="
                  ["#{quoted_column} != ? OR #{quoted_column} IS NULL", value]
                when ">"
                  ["#{quoted_column} > ?", value]
                when "<"
                  ["#{quoted_column} < ?", value]
                when ">="
                  ["#{quoted_column} >= ?", value]
                when "<="
                  ["#{quoted_column} <= ?", value]
                when "contains"
                  ["#{quoted_column} ILIKE ?", "%#{value}%"]
                when "not_contains"
                  ["#{quoted_column} NOT ILIKE ? OR #{quoted_column} IS NULL", "%#{value}%"]
                when "starts_with"
                  ["#{quoted_column} ILIKE ?", "#{value}%"]
                when "ends_with"
                  ["#{quoted_column} ILIKE ?", "%#{value}"]
                when "is_empty"
                  ["#{quoted_column} IS NULL OR #{quoted_column} = ''"]
                when "is_not_empty"
                  ["#{quoted_column} IS NOT NULL AND #{quoted_column} != ''"]
                else
                  nil
                end
              end.compact

              # Combine conditions within group
              if filter_conditions.any?
                if group_logic == "AND"
                  # Combine with AND
                  sql = filter_conditions.map(&:first).join(" AND ")
                  bind_values = filter_conditions.flat_map { |c| c[1..-1] }
                  [sql, *bind_values]
                else
                  # Combine with OR
                  sql = "(" + filter_conditions.map(&:first).join(" OR ") + ")"
                  bind_values = filter_conditions.flat_map { |c| c[1..-1] }
                  [sql, *bind_values]
                end
              else
                nil
              end
            end.compact

            # Combine groups with inter-group logic
            if group_conditions.any?
              if inter_group_logic == "AND"
                group_conditions.each do |condition|
                  query = query.where(condition)
                end
              else
                # OR logic between groups
                or_sql = group_conditions.map { |c| "(#{c.first})" }.join(" OR ")
                or_bind_values = group_conditions.flat_map { |c| c[1..-1] }
                query = query.where(or_sql, *or_bind_values)
              end
            end
          rescue JSON::ParserError => e
            Rails.logger.error "Failed to parse filter params: #{e.message}"
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

        # Get count before pagination (skip if using cursor pagination for performance)
        total_count = params[:cursor].present? ? nil : query.count

        # NOTE: We removed the fields=minimal SELECT hack here.
        # It was breaking features (cascading filters, column selection, associations).
        # Performance is achieved through:
        # 1. Eager loading associations (apply_eager_loading - auto-derived from model)
        # 2. Proper pagination (offset OR cursor-based)
        # See: Ultra philosophy - load what the UI needs, optimize HOW we load it

        # Paginate: Use cursor-based for infinite scroll, offset for traditional pagination
        if params[:cursor].present? || params[:limit].present?
          # Cursor-based pagination (for infinite scroll)
          # Format: cursor is the ID of the last record from previous page
          cursor_id = params[:cursor]&.to_i || 0
          limit = [params[:limit]&.to_i || 50, 100].min # Default 50, max 100 per request

          # CRITICAL: When using cursor pagination, we MUST sort by the cursor field (id)
          # to ensure consistent pagination. Sorting by created_at with id cursor causes
          # records to be skipped because id and created_at are not monotonically aligned.
          query = query.reorder(id: :desc)

          # Fetch records after cursor (id < cursor to go backwards through IDs)
          if cursor_id > 0
            records = query.where("#{model.table_name}.id < ?", cursor_id).limit(limit + 1)
          else
            records = query.limit(limit + 1)
          end

          # Check if there are more records (fetch limit+1, return limit)
          has_more = records.length > limit
          records = records.first(limit) if has_more
        else
          # Traditional offset pagination (backwards compatible)
          records = query.offset((page - 1) * per_page).limit(per_page)
        end

        # Build lookup cache to prevent N+1 queries (only for user foundations with lookup columns)
        lookup_cache = @foundation.table_type == "system" ? {} : build_lookup_cache(records)

        # Serialize records to JSON
        serialized_records = records.map { |r| record_to_json(r, lookup_cache) }

        # DEBUG: Log if we're finding duplicates in the query result
        record_ids = records.map(&:id)
        duplicate_ids = record_ids.select { |id| record_ids.count(id) > 1 }.uniq
        if duplicate_ids.any?
          Rails.logger.error "[DUPLICATE BUG] Found #{duplicate_ids.count} duplicate IDs in query result: #{duplicate_ids.first(10).inspect}"
          Rails.logger.error "[DUPLICATE BUG] Foundation: #{@foundation.slug}, Total records: #{records.count}, Unique: #{record_ids.uniq.count}"
        end

        # CRITICAL: Deduplicate by ID (belt-and-suspenders approach)
        # This ensures no duplicate IDs appear in the response regardless of query issues
        unique_records = serialized_records.uniq { |r| r[:id] || r["id"] }

        # DEBUG: Log deduplication results
        if serialized_records.count != unique_records.count
          Rails.logger.error "[DUPLICATE BUG] Deduplication removed #{serialized_records.count - unique_records.count} duplicate records"
        end

        # Response format: cursor pagination includes has_more + next_cursor
        response = {
          success: true,
          records: unique_records
        }

        if params[:cursor].present?
          # Cursor pagination response (loading more)
          response[:has_more] = has_more
          # CRITICAL: Use last record from unique_records, not original records (after deduplication)
          response[:next_cursor] = unique_records.last&.dig(:id) || unique_records.last&.dig("id")
          # Don't include total_count on subsequent requests (performance optimization)
        elsif params[:limit].present?
          # Cursor pagination response (first request - includes total_count for UX)
          response[:has_more] = has_more || (records.length == limit)
          # CRITICAL: Use last record from unique_records, not original records (after deduplication)
          response[:next_cursor] = unique_records.last&.dig(:id) || unique_records.last&.dig("id")
          response[:total_count] = total_count # Include total_count on first request
        else
          # Traditional offset pagination response (backwards compatible)
          response[:pagination] = {
            page: page,
            per_page: per_page,
            total_count: total_count,
            total_pages: (total_count.to_f / per_page).ceil
          }
        end

        render json: response
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
        # If no records, hard delete. If has records, soft delete (archive via is_active=false).
        if model.table_name == "contacts"
          has_records = contact_has_records?(record)

          if has_records
            # Soft delete - archive the contact (set is_active=false, can be recovered)
            record.update!(is_active: false)
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

        # Check for nil, empty string, OR empty array (Rails: [].blank? is false!)
        if secondary_ids.blank? || (secondary_ids.is_a?(Array) && secondary_ids.empty?)
          return render json: { error: "No secondary record IDs provided. Select at least 2 records to merge." }, status: :unprocessable_entity
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
            # Map lookup IDs to their string values from the lookup table
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
          # Get only the columns that were actually loaded (not full schema)
          loaded_columns = record.attributes.keys
          loaded_columns.each do |key|
            next if [ "id", "created_at", "updated_at" ].include?(key)
            # Use send to go through model accessors (which may have safe decryption wrappers)
            begin
              attr_value = record.send(key)
              # Skip if this returned an ActiveRecord object (association) - these should only be IDs
              json[key] = attr_value.is_a?(ActiveRecord::Base) ? nil : attr_value
            rescue ActiveRecord::Encryption::Errors::Decryption => e
              Rails.logger.warn "Decryption failed for #{record.class.name}##{record.id}.#{key}: #{e.message}"
              json[key] = nil
            rescue ActiveModel::MissingAttributeError
              # Column wasn't loaded - skip silently
              next
            rescue => e
              Rails.logger.warn "Error reading #{record.class.name}##{record.id}.#{key}: #{e.message}"
              json[key] = record.attributes[key]
            end
          end

          # Expand _id columns to include display value for lookup columns
          # e.g., job_type_id => { id: 1, display: "Residential" }
          # IMPORTANT: Only expand _id columns that were actually loaded
          loaded_id_columns = loaded_columns.select { |k| k.to_s.end_with?("_id") && k != "id" }
          loaded_id_columns.each do |id_column|
            # Skip if the _id column wasn't loaded or has no value
            next unless json.key?(id_column) && json[id_column].present?

            association_name = id_column.to_s.sub(/_id$/, "")
            if record.respond_to?(association_name)
              begin
                related = record.send(association_name)
                if related
                  # Use centralized DisplayValueResolver (SSoT for display values)
                  display_value = DisplayValueResolver.resolve(related)
                  json[id_column] = { id: json[id_column], display: display_value }
                end
              rescue ActiveModel::MissingAttributeError
                # Column wasn't loaded - skip expansion
                next
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
            # SSoT: employees_count is now kept in sync by ContactRelationship callbacks
            # See ContactRelationship#update_company_employees_count
            json[:employees_count] = record.employees_count
            json[:display_name] = record.display_name  # Computed: includes company name for team contacts

            # SSoT: Xero link data from contact_external_links (not legacy xero_id)
            json[:xero_linked_count] = record.xero_linked_count
            json[:xero_tenant_names] = record.xero_tenant_names
            json[:xero_link_summary] = record.xero_link_summary
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

      # SSoT: Auto-derive associations from model reflections
      # No manual maintenance needed - Rails reflection system finds all belongs_to associations
      # Works for ALL tables (system and user-created)
      def apply_eager_loading(query, model)
        associations = []

        # Method 1: Get associations from model's belongs_to reflections (most reliable)
        # This uses Rails' built-in reflection system to find all belongs_to associations
        model.reflect_on_all_associations(:belongs_to).each do |reflection|
          associations << reflection.name
        end

        # Apply eager loading if we found associations
        if associations.any?
          query.includes(*associations)
        else
          query
        end
      end
    end
  end
end
