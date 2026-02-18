# frozen_string_literal: true

module Api
  module V1
    # FoundationImportsController - Import data INTO existing Foundation tables
    # Unlike ImportsController which creates NEW tables, this imports into existing ones
    class FoundationImportsController < ApplicationController
      before_action :set_foundation

      MAX_IMPORT_ROWS = 5000

      # POST /api/v1/foundations/:foundation_id/import/preview
      # Upload file and generate preview with auto-mapped columns
      def preview
        unless params[:file].present?
          return render_error("No file provided", status: :unprocessable_entity)
        end

        file = params[:file]
        file_extension = File.extname(file.original_filename).downcase

        begin
          # Save file to temp location
          temp_file_path = save_temp_file(file)

          # Detect file type and parse
          source_type, parsed_data = parse_file(temp_file_path, file_extension)

          unless parsed_data[:success]
            File.delete(temp_file_path) if File.exist?(temp_file_path)
            return render_error(parsed_data[:errors].join(", "), status: :unprocessable_entity)
          end

          # Cap rows to prevent memory issues
          if parsed_data[:total_rows] > MAX_IMPORT_ROWS
            File.delete(temp_file_path) if File.exist?(temp_file_path)
            return render_error("File contains #{parsed_data[:total_rows]} rows. Maximum allowed is #{MAX_IMPORT_ROWS}.", status: :unprocessable_entity)
          end

          # Auto-map source columns to Foundation columns
          suggested_mapping = auto_map_columns(parsed_data[:headers], source_type)

          # Create import session to store parsed data
          import_session = create_import_session(temp_file_path, file, parsed_data)

          # Get first 5 rows for preview
          preview_rows = import_session.file_data["rows"].first(5)

          render json: {
            success: true,
            data: {
              session_key: import_session.session_key,
              source_type: source_type,
              headers: parsed_data[:headers],
              preview_rows: preview_rows,
              suggested_mapping: suggested_mapping,
              foundation_columns: foundation_columns_metadata,
              total_rows: parsed_data[:total_rows]
            }
          }
        rescue => e
          File.delete(temp_file_path) if defined?(temp_file_path) && File.exist?(temp_file_path)
          Rails.logger.error "Foundation import preview error: #{e.class} - #{e.message}"
          Rails.logger.error e.backtrace.join("\n")

          render_error("Failed to process file: #{e.message}", status: :internal_server_error)
        end
      end

      # POST /api/v1/foundations/:foundation_id/import/execute
      # Execute import with user-provided column mapping
      def execute
        session_key = params[:session_key]
        column_mapping = params[:column_mapping] || {}

        unless session_key.present?
          return render_error("Session key not provided", status: :unprocessable_entity)
        end

        # Find import session
        import_session = ImportSession.valid.find_by(session_key: session_key)
        unless import_session
          return render_error("Import session expired or not found. Please upload the file again.", status: :unprocessable_entity)
        end

        # Load parsed rows from session
        rows = import_session.file_data["rows"] || []
        if rows.empty?
          return render_error("No data found in import session", status: :unprocessable_entity)
        end

        # Execute import
        result = execute_import(rows, column_mapping)

        # Update session with result
        import_session.update!(
          status: result[:success] ? "completed" : "failed",
          total_rows: result[:total_count],
          processed_rows: result[:created_count],
          result: result
        )

        render json: {
          success: result[:success],
          data: {
            created_count: result[:created_count],
            error_count: result[:error_count],
            errors: result[:errors]
          }
        }
      rescue => e
        Rails.logger.error "Foundation import execute error: #{e.class} - #{e.message}"
        Rails.logger.error e.backtrace.join("\n")

        render_error("Import failed: #{e.message}", status: :internal_server_error)
      end

      # GET /api/v1/foundations/:foundation_id/import/status/:session_key
      # Check import status
      def status
        session_key = params[:session_key]

        import_session = ImportSession.find_by(session_key: session_key)
        unless import_session
          return render_error("Import session not found", status: :not_found)
        end

        render json: {
          success: true,
          data: {
            status: import_session.status || "pending",
            progress: import_session.progress || 0,
            total_rows: import_session.total_rows || 0,
            processed_rows: import_session.processed_rows || 0,
            result: import_session.result
          }
        }
      end

      private

      def set_foundation
        foundation_id = params[:foundation_id]
        @foundation = Foundation.find_by(id: foundation_id) || Foundation.find_by(slug: foundation_id)

        unless @foundation
          render_error("Foundation not found", status: :not_found)
        end
      end

      def save_temp_file(file)
        temp_dir = File.join(Dir.tmpdir, "foundation_imports")
        FileUtils.mkdir_p(temp_dir) unless Dir.exist?(temp_dir)

        timestamp = Time.current.to_i
        random_key = SecureRandom.hex(8)
        extension = File.extname(file.original_filename).gsub(/[^a-zA-Z0-9.]/, "").slice(0, 10)
        temp_filename = "foundation_import_#{timestamp}_#{random_key}#{extension}"
        temp_file_path = File.join(temp_dir, temp_filename)

        File.open(temp_file_path, "wb") do |f|
          f.write(file.read)
        end

        temp_file_path
      end

      def parse_file(file_path, extension)
        # Check if it's a Databuild XML file
        if extension == ".xml" && databuild_file?(file_path)
          source_type = "databuild"
          # TODO: Implement DatabuildParser when available
          # For now, return error
          return [ source_type, { success: false, errors: [ "Databuild XML import not yet implemented" ] } ]
        end

        # Parse as generic CSV/XLSX
        source_type = "generic"
        parser = SpreadsheetParser.new(file_path)
        result = parser.parse

        if result[:success]
          # Include all rows in result for storage
          result[:rows] = parser.all_rows
        end

        [ source_type, result ]
      end

      def databuild_file?(file_path)
        # Simple check for Databuild XML structure
        # TODO: Use DatabuildParser.detect? when available
        return false unless File.exist?(file_path)

        first_lines = File.open(file_path) { |f| f.read(500) }
        first_lines.include?("Databuild") || first_lines.include?("databuild")
      rescue StandardError => e
        Rails.logger.warn "[FoundationImports] Failed to detect Databuild format: #{e.message}"
        false
      end

      def auto_map_columns(source_headers, source_type)
        mapping = {}
        foundation_columns = @foundation.columns.pluck(:column_name, :name, :column_type).map do |col_name, display_name, col_type|
          { column_name: col_name, display_name: display_name, column_type: col_type }
        end

        source_headers.each do |source_col|
          next if source_col.blank?

          # Try exact match (case-insensitive)
          exact_match = foundation_columns.find do |fc|
            fc[:column_name].downcase == source_col.downcase ||
              fc[:display_name].downcase == source_col.downcase
          end

          if exact_match
            mapping[source_col] = exact_match[:column_name]
            next
          end

          # Try match without _id suffix (for lookup columns)
          source_without_id = source_col.gsub(/_id$/i, "")
          id_match = foundation_columns.find do |fc|
            fc[:column_name].downcase == source_without_id.downcase ||
              fc[:display_name].downcase == source_without_id.downcase
          end

          if id_match
            mapping[source_col] = id_match[:column_name]
            next
          end

          # TODO: Use DatabuildParser.column_mapping when available for Databuild files
        end

        mapping
      end

      def foundation_columns_metadata
        @foundation.columns.order(:position).map do |col|
          {
            column_name: col.column_name,
            display_name: col.name,
            column_type: col.column_type,
            required: col.required,
            is_lookup: Column::LOOKUP_COLUMN_TYPES.include?(col.column_type)
          }
        end
      end

      def create_import_session(temp_file_path, file, parsed_data)
        ImportSession.create!(
          file_path: temp_file_path,
          original_filename: file.original_filename,
          file_size: File.size(temp_file_path),
          file_data: {
            headers: parsed_data[:headers],
            rows: parsed_data[:rows],
            total_rows: parsed_data[:total_rows]
          },
          foundation_id: @foundation.id,
          status: "pending"
        )
      end

      def execute_import(rows, column_mapping)
        model = @foundation.dynamic_model
        created = []
        errors = []

        ActiveRecord::Base.transaction do
          rows.each_with_index do |row, idx|
            # Transform row using column mapping
            attributes = transform_row(row, column_mapping)
            next if attributes.empty?

            # Apply default values for required fields
            attributes = apply_default_values(model, attributes)

            record = model.new(attributes)

            if record.save
              created << { row: idx + 1, id: record.id }
            else
              errors << { row: idx + 1, errors: record.errors.full_messages }
              # Continue processing other rows instead of rolling back entire import
            end
          end
        end

        {
          success: errors.empty?,
          total_count: rows.length,
          created_count: created.length,
          error_count: errors.length,
          errors: errors.first(50) # Cap error list
        }
      rescue => e
        Rails.logger.error "Import execution failed: #{e.message}"
        {
          success: false,
          total_count: rows.length,
          created_count: created.length,
          error_count: rows.length - created.length,
          errors: [ { row: 0, errors: [ e.message ] } ]
        }
      end

      def transform_row(row, column_mapping)
        attributes = {}

        column_mapping.each do |source_col, target_col|
          next if source_col.blank? || target_col.blank?
          next unless row.key?(source_col)

          value = row[source_col]
          next if value.blank?

          attributes[target_col] = value
        end

        attributes
      end

      # Apply default values for required fields (SSoT pattern from RecordsController)
      def apply_default_values(model, attributes)
        attrs = attributes.to_h.with_indifferent_access

        # Handle Job model specifically
        if model == Job
          attrs[:title] = "Imported Job" if attrs[:title].blank?
        end

        # Handle Contact model
        if model == Contact
          attrs[:display_name] = "Imported Contact" if attrs[:display_name].blank?
        end

        attrs
      end

      def foundation_import_params
        params.permit(:foundation_id, :session_key, :file, column_mapping: {})
      end
    end
  end
end
