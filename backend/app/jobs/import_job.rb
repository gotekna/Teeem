class ImportJob < ApplicationJob
  queue_as :default

  def perform(import_session_id, foundation_id, column_mapping = {})
    import_session = ImportSession.find(import_session_id)
    foundation = Foundation.find(foundation_id)

    # Update progress: starting
    import_session.update(
      status: "processing",
      progress: 0,
      total_rows: 0,
      processed_rows: 0
    )

    begin
      # Restore file from database if it doesn't exist on this dyno
      unless File.exist?(import_session.file_path)
        # Ensure directory exists
        FileUtils.mkdir_p(File.dirname(import_session.file_path))

        # Write file data from database to filesystem
        File.write(import_session.file_path, import_session.file_data)

        Rails.logger.info "Restored import file from database to #{import_session.file_path}"
      end

      # Import the data using the saved file
      importer = DataImporter.new(foundation, import_session.file_path, column_mapping)

      # Pass the import session to track progress
      import_result = importer.import do |current, total|
        import_session.update(
          progress: ((current.to_f / total) * 100).round(2),
          total_rows: total,
          processed_rows: current
        )
      end

      # Update final status
      imported_count = import_result[:imported_count] || 0
      failed_count = import_result[:failed_count] || 0

      import_session.update(
        status: "completed",
        progress: 100,
        total_rows: imported_count + failed_count,
        processed_rows: imported_count,
        completed_at: Time.current,
        result: {
          imported_count: imported_count,
          failed_count: failed_count,
          failed_rows: import_result[:failed_rows] || []
        }
      )

      # Clean up the file after successful import
      import_session.cleanup_file!

    rescue => e
      Rails.logger.error "Import job error: #{e.class} - #{e.message}"
      Rails.logger.error e.backtrace.join("\n")

      import_session.update(
        status: "failed",
        error_message: e.message,
        completed_at: Time.current
      )

      # Clean up on error - destroy foundation but keep import session for error display
      foundation&.destroy
      # Delete the file but DON'T destroy the import_session so user can see error
      File.delete(import_session.file_path) if import_session.file_exists?

      raise e
    end
  end
end
