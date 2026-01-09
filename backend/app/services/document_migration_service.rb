# frozen_string_literal: true

# DocumentMigrationService - Manages bulk document migration between storage providers
#
# This service orchestrates migration of documents from one provider to another.
# It handles batch enqueueing, progress tracking, and reporting.
#
# Usage:
#   # Start migration for all SharePoint documents to S3
#   result = DocumentMigrationService.start_migration(
#     from: 'sharepoint',
#     to: 's3_compatible',
#     delete_source: false
#   )
#
#   # Get migration status
#   status = DocumentMigrationService.migration_status
#
#   # Cancel ongoing migration
#   DocumentMigrationService.cancel_migration
#
class DocumentMigrationService
  class << self
    # Start migrating documents from one provider to another
    #
    # @param from [String] Source provider ('sharepoint' or 's3_compatible')
    # @param to [String] Destination provider ('sharepoint' or 's3_compatible')
    # @param options [Hash] Migration options
    #   - delete_source: [Boolean] Delete from source after migration (default: false)
    #   - batch_size: [Integer] Number of documents per batch (default: 100)
    #   - job_id: [Integer] Only migrate documents from this job (optional)
    #
    # @return [Hash] Migration start result with job count
    #
    def start_migration(from:, to:, **options)
      delete_source = options.fetch(:delete_source, false)
      batch_size = options.fetch(:batch_size, 100)
      job_id = options[:job_id]

      # Validate providers
      unless JobDocument::STORAGE_PROVIDERS.include?(from) && JobDocument::STORAGE_PROVIDERS.include?(to)
        return { success: false, error: "Invalid provider. Must be one of: #{JobDocument::STORAGE_PROVIDERS.join(', ')}" }
      end

      if from == to
        return { success: false, error: "Source and destination providers are the same" }
      end

      # Find documents to migrate
      documents = JobDocument.where(storage_provider: from)
                             .where(migration_status: [nil, 'failed']) # Skip completed/in_progress
                             .where.not(sharepoint_item_id: nil)       # Must have a storage reference

      documents = documents.where(job_id: job_id) if job_id.present?

      total_count = documents.count

      if total_count == 0
        return {
          success: true,
          message: "No documents found to migrate from #{from}",
          total_documents: 0,
          jobs_enqueued: 0
        }
      end

      Rails.logger.info "[DocumentMigration] Starting migration of #{total_count} documents from #{from} to #{to}"

      # Reset any previously failed migrations
      documents.where(migration_status: 'failed').update_all(
        migration_status: 'pending',
        migration_error: nil
      )

      # Mark all as pending
      documents.update_all(migration_status: 'pending')

      # Enqueue migration jobs in batches
      jobs_enqueued = 0
      documents.find_each(batch_size: batch_size) do |document|
        DocumentMigrationJob.perform_later(
          document.id,
          delete_source: delete_source
        )
        jobs_enqueued += 1
      end

      Rails.logger.info "[DocumentMigration] Enqueued #{jobs_enqueued} migration jobs"

      {
        success: true,
        message: "Migration started",
        total_documents: total_count,
        jobs_enqueued: jobs_enqueued,
        source_provider: from,
        dest_provider: to,
        delete_source: delete_source
      }
    end

    # Get current migration status
    #
    # @return [Hash] Status with counts by migration_status
    #
    def migration_status
      # Get counts by status
      status_counts = JobDocument.group(:migration_status).count
      total_with_status = JobDocument.where.not(migration_status: nil).count

      # Calculate progress
      completed = status_counts['completed'] || 0
      failed = status_counts['failed'] || 0
      in_progress = status_counts['in_progress'] || 0
      pending = status_counts['pending'] || 0

      # Get recent failures for debugging
      recent_failures = JobDocument.where(migration_status: 'failed')
                                   .order(updated_at: :desc)
                                   .limit(5)
                                   .pluck(:id, :file_name, :migration_error)
                                   .map { |id, name, error| { id: id, file_name: name, error: error } }

      # Provider breakdown
      provider_breakdown = JobDocument.group(:storage_provider).count

      {
        total_documents: JobDocument.count,
        migration_in_progress: in_progress > 0 || pending > 0,
        status_counts: {
          pending: pending,
          in_progress: in_progress,
          completed: completed,
          failed: failed,
          not_migrated: JobDocument.where(migration_status: nil).count
        },
        provider_breakdown: provider_breakdown,
        progress_percent: total_with_status > 0 ? ((completed.to_f / total_with_status) * 100).round(1) : 0,
        recent_failures: recent_failures
      }
    end

    # Cancel ongoing migration (marks pending as cancelled)
    #
    # @return [Hash] Result with count of cancelled jobs
    #
    def cancel_migration
      cancelled_count = JobDocument.where(migration_status: 'pending')
                                   .update_all(migration_status: nil)

      Rails.logger.info "[DocumentMigration] Cancelled #{cancelled_count} pending migrations"

      {
        success: true,
        message: "Migration cancelled",
        cancelled_count: cancelled_count
      }
    end

    # Retry failed migrations
    #
    # @param options [Hash] Options for retry
    #   - delete_source: [Boolean] Delete from source after migration
    #
    # @return [Hash] Result with count of retried jobs
    #
    def retry_failed(**options)
      delete_source = options.fetch(:delete_source, false)

      failed_documents = JobDocument.where(migration_status: 'failed')
      count = failed_documents.count

      if count == 0
        return { success: true, message: "No failed migrations to retry", retried_count: 0 }
      end

      # Reset status and re-enqueue
      failed_documents.update_all(
        migration_status: 'pending',
        migration_error: nil
      )

      failed_documents.find_each do |document|
        DocumentMigrationJob.perform_later(document.id, delete_source: delete_source)
      end

      Rails.logger.info "[DocumentMigration] Retrying #{count} failed migrations"

      {
        success: true,
        message: "Retrying #{count} failed migrations",
        retried_count: count
      }
    end

    # Estimate migration time based on document count and sizes
    #
    # @param from [String] Source provider
    # @return [Hash] Estimation with document count and estimated time
    #
    def estimate_migration(from:)
      documents = JobDocument.where(storage_provider: from)
                             .where(migration_status: [nil, 'failed'])

      count = documents.count
      total_size = documents.sum(:file_size) || 0

      # Rough estimate: 5 seconds per document (download + upload + db update)
      # Add time for large files
      estimated_seconds = count * 5
      estimated_seconds += (total_size / (10.megabytes)) * 10 # Extra 10s per 10MB

      {
        document_count: count,
        total_size_bytes: total_size,
        total_size_formatted: format_size(total_size),
        estimated_minutes: (estimated_seconds / 60.0).ceil,
        estimated_time_formatted: format_duration(estimated_seconds)
      }
    end

    private

    def format_size(bytes)
      return "0 B" if bytes.nil? || bytes == 0

      if bytes >= 1.gigabyte
        "#{(bytes.to_f / 1.gigabyte).round(2)} GB"
      elsif bytes >= 1.megabyte
        "#{(bytes.to_f / 1.megabyte).round(1)} MB"
      elsif bytes >= 1.kilobyte
        "#{(bytes.to_f / 1.kilobyte).round(0)} KB"
      else
        "#{bytes} B"
      end
    end

    def format_duration(seconds)
      if seconds >= 3600
        hours = seconds / 3600
        minutes = (seconds % 3600) / 60
        "#{hours}h #{minutes}m"
      elsif seconds >= 60
        "#{(seconds / 60).ceil} minutes"
      else
        "#{seconds} seconds"
      end
    end
  end
end
