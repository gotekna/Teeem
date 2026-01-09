require "fileutils"

module Api
  module V1
    class ImportsController < ApplicationController
      # POST /api/v1/imports/upload
      # Upload a file and get preview data with type detection
      def upload
        unless params[:file].present?
          return render json: { error: "No file provided" }, status: :unprocessable_entity
        end

        file = params[:file]

        begin
          # Use /tmp directly for Heroku compatibility
          temp_dir = File.join(Dir.tmpdir, "imports")
          FileUtils.mkdir_p(temp_dir) unless Dir.exist?(temp_dir)

          # Generate unique filename
          timestamp = Time.current.to_i
          random_key = SecureRandom.hex(8)
          # Sanitize extension to prevent path traversal attacks
          raw_extension = File.extname(file.original_filename).to_s
          extension = raw_extension.gsub(/[^a-zA-Z0-9.]/, "").slice(0, 10) # Only allow alphanumeric + dot, max 10 chars
          temp_filename = "import_#{timestamp}_#{random_key}#{extension}"
          temp_file_path = File.join(temp_dir, temp_filename)

          # Save uploaded file to temp location
          File.open(temp_file_path, "wb") do |f|
            f.write(file.read)
          end

          # Parse the spreadsheet
          parser = SpreadsheetParser.new(temp_file_path)
          result = parser.parse

          if result[:success]
            # Read and store file contents in database for cross-dyno access
            file_data = File.read(temp_file_path)

            # Create import session record with file data
            import_session = ImportSession.create!(
              file_path: temp_file_path,
              original_filename: file.original_filename,
              file_size: File.size(temp_file_path),
              file_data: file_data
            )

            response_data = {
              success: true,
              data: {
                session_key: import_session.session_key,
                headers: result[:headers],
                preview_rows: result[:preview_data],
                total_rows: result[:total_rows],
                detected_types: result[:detected_types],
                suggested_table_name: result[:suggested_table_name],
                original_filename: file.original_filename
              }
            }

            Rails.logger.info "Upload response - session_key: #{import_session.session_key}"

            render json: response_data
          else
            # Clean up file if parsing failed
            File.delete(temp_file_path) if File.exist?(temp_file_path)

            render json: {
              success: false,
              errors: result[:errors]
            }, status: :unprocessable_entity
          end
        rescue => e
          # Clean up file on error
          File.delete(temp_file_path) if temp_file_path && File.exist?(temp_file_path)

          Rails.logger.error "Import upload error: #{e.class} - #{e.message}"
          Rails.logger.error e.backtrace.join("\n")

          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      # POST /api/v1/imports/execute
      # Create table and start background import job
      def execute
        session_key = params[:session_key]

        unless session_key.present?
          return render json: {
            success: false,
            error: "Session key not provided. Please upload the file again."
          }, status: :unprocessable_entity
        end

        # Find the import session
        import_session = ImportSession.valid.find_by(session_key: session_key)

        unless import_session
          return render json: {
            success: false,
            error: "Import session expired or not found. Please upload the file again."
          }, status: :unprocessable_entity
        end

        unless import_session.file_exists?
          import_session.destroy
          return render json: {
            success: false,
            error: "Import file not found. Please upload the file again."
          }, status: :unprocessable_entity
        end

        # Extract parameters
        table_name = params[:table_name]
        columns_data = params[:columns] || []

        # Create the foundation record
        foundation = Foundation.new(
          name: table_name,
          singular_name: params[:singular_name],
          plural_name: params[:plural_name],
          icon: params[:icon],
          title_column: params[:title_column],
          description: params[:description]
        )

        unless foundation.save
          Rails.logger.error "Foundation save failed: #{foundation.errors.full_messages.join(', ')}"
          return render json: { success: false, errors: foundation.errors.full_messages }, status: :unprocessable_entity
        end

        # Create column records
        columns_data.each_with_index do |col_data, index|
          column = foundation.columns.build(
            name: col_data[:name],
            column_name: col_data[:column_name] || col_data[:name].parameterize(separator: "_"),
            column_type: col_data[:column_type],
            searchable: col_data[:searchable] != false,
            is_title: col_data[:is_title] == true,
            is_unique: col_data[:is_unique] == true,
            required: col_data[:required] == true,
            position: index
          )

          unless column.save
            Rails.logger.error "Column save failed: #{column.errors.full_messages.join(', ')}"
            foundation.destroy
            return render json: { success: false, errors: column.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # Create the actual database table
        builder = TableBuilder.new(foundation)
        build_result = builder.create_database_table

        unless build_result[:success]
          Rails.logger.error "Foundation build failed: #{build_result[:errors].join(', ')}"
          foundation.destroy
          return render json: { success: false, errors: build_result[:errors] }, status: :unprocessable_entity
        end

        # Link foundation to import session
        import_session.update!(foundation_id: foundation.id, status: "queued")

        # Start background import job
        ImportJob.perform_later(import_session.id, foundation.id, params[:column_mapping] || {})

        render json: {
          success: true,
          session_key: session_key,
          foundation_id: foundation.id
        }
      end

      # GET /api/v1/imports/status/:session_key
      # Check the status of an import job
      def status
        session_key = params[:session_key]

        import_session = ImportSession.find_by(session_key: session_key)

        unless import_session
          return render json: {
            success: false,
            error: "Import session not found"
          }, status: :not_found
        end

        response = {
          success: true,
          status: import_session.status || "pending",
          progress: import_session.progress || 0,
          total_rows: import_session.total_rows || 0,
          processed_rows: import_session.processed_rows || 0
        }

        if import_session.status == "completed"
          response[:foundation_id] = import_session.foundation_id
          response[:result] = import_session.result
        elsif import_session.status == "failed"
          response[:error] = import_session.error_message
        end

        render json: response
      end
    end
  end
end
