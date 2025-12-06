# frozen_string_literal: true

# Background job for importing legacy files from OneDrive to job folders
# Runs asynchronously to avoid HTTP request timeouts
class ImportLegacyFilesJob < ApplicationJob
  queue_as :default

  # Retry on Microsoft Graph API errors with exponential backoff
  retry_on MicrosoftGraphClient::APIError, wait: :exponentially_longer, attempts: 3

  def perform(job_id, file_ids, user_id = nil)
    job = Job.find(job_id)
    user = user_id ? User.find_by(id: user_id) : nil

    Rails.logger.info("[ImportLegacyFilesJob] Starting import of #{file_ids.length} files for job #{job_id}")

    service = JobDocumentMigrationService.new
    result = service.import_files_to_job(job, file_ids)

    Rails.logger.info("[ImportLegacyFilesJob] Completed: #{result[:imported].length} imported, #{result[:errors].length} errors")

    # Create a notification or activity log entry
    if result[:imported].any?
      ActivityLog.create(
        user: user,
        trackable: job,
        action: "imported_legacy_files",
        details: {
          imported_count: result[:imported].length,
          error_count: result[:errors].length,
          imported_files: result[:imported].map { |f| f[:name] }.first(10),
          errors: result[:errors].first(5)
        }
      ) if defined?(ActivityLog)
    end

    result
  rescue StandardError => e
    Rails.logger.error("[ImportLegacyFilesJob] Failed: #{e.message}")
    Rails.logger.error(e.backtrace.first(10).join("\n"))
    raise
  end
end
