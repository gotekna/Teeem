# frozen_string_literal: true

# EmailMigrationJob - Long-running email migration from O365 to PolarisMail
#
# Executes the actual migration of email content (emails, calendar, contacts)
# from Office 365 to PolarisMail. This job may run for hours depending on
# mailbox size.
#
# Usage:
#   EmailMigrationJob.perform_later(migration.id)
#
class EmailMigrationJob < ApplicationJob
  queue_as :low  # Use low priority queue for long-running jobs

  # Longer retry delays for migration jobs
  retry_on PolarisMailService::ApiError, wait: 5.minutes, attempts: 3
  retry_on PolarisMailService::RateLimitError, wait: 10.minutes, attempts: 5

  # Don't retry on credential errors - needs manual intervention
  discard_on PolarisMailService::NotConnectedError

  def perform(migration_id)
    migration = EmailMigration.find_by(id: migration_id)
    return unless migration
    return if migration.status.in?(%w[completed cancelled])

    Rails.logger.info "[EmailMigrationJob] Starting migration #{migration_id} for #{migration.source_email}"

    begin
      # Get the migration service
      service = EmailMigrationService.new(migration.email_subscription)

      # Execute the migration (this blocks until complete or failed)
      service.execute_migration(migration)

      Rails.logger.info "[EmailMigrationJob] Migration #{migration_id} finished with status: #{migration.reload.status}"

    rescue EmailMigrationService::MigrationError => e
      Rails.logger.error "[EmailMigrationJob] Migration error: #{e.message}"
      migration.fail!(e.message) unless migration.failed?
      raise # Re-raise for retry logic
    rescue StandardError => e
      Rails.logger.error "[EmailMigrationJob] Unexpected error: #{e.class} - #{e.message}"
      migration.fail!("Unexpected error: #{e.message}") unless migration.failed?
      raise
    end
  end
end
