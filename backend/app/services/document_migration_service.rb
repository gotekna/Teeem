# frozen_string_literal: true

# DocumentMigrationService - Manages bulk document migration between storage providers
#
# This service orchestrates migration of documents from one provider to another.
# It handles batch enqueueing, progress tracking, and reporting for all document types:
# - JobDocument
# - CorporateCompanyDocument
# - PeopleDocument
#
# Usage:
#   # Start migration for all SharePoint documents to S3
#   result = DocumentMigrationService.start_migration(
#     from: 'sharepoint',
#     to: 's3_compatible',
#     delete_source: false
#   )
#
#   # Start migration for specific document type
#   result = DocumentMigrationService.start_migration(
#     from: 'sharepoint',
#     to: 's3_compatible',
#     document_types: ['CorporateCompanyDocument']
#   )
#
#   # Get migration status
#   status = DocumentMigrationService.migration_status
#
#   # Cancel ongoing migration
#   DocumentMigrationService.cancel_migration
#
class DocumentMigrationService
  # All supported document types for migration
  DOCUMENT_TYPES = {
    'JobDocument' => JobDocument,
    'CorporateCompanyDocument' => CorporateCompanyDocument,
    'PeopleDocument' => PeopleDocument
  }.freeze

  class << self
    # Start migrating documents from one provider to another
    #
    # @param from [String] Source provider ('sharepoint' or 's3_compatible')
    # @param to [String] Destination provider ('sharepoint' or 's3_compatible')
    # @param options [Hash] Migration options
    #   - delete_source: [Boolean] Delete from source after migration (default: false)
    #   - batch_size: [Integer] Number of documents per batch (default: 100)
    #   - document_types: [Array<String>] Specific document types to migrate (default: all)
    #   - job_id: [Integer] Only migrate JobDocuments from this job (optional)
    #
    # @return [Hash] Migration start result with job count
    #
    def start_migration(from:, to:, **options)
      delete_source = options.fetch(:delete_source, false)
      batch_size = options.fetch(:batch_size, 100)
      job_id = options[:job_id]
      requested_types = options[:document_types] || DOCUMENT_TYPES.keys

      # Validate providers
      unless JobDocument::STORAGE_PROVIDERS.include?(from) && JobDocument::STORAGE_PROVIDERS.include?(to)
        return { success: false, error: "Invalid provider. Must be one of: #{JobDocument::STORAGE_PROVIDERS.join(', ')}" }
      end

      if from == to
        return { success: false, error: "Source and destination providers are the same" }
      end

      # Validate document types
      invalid_types = requested_types - DOCUMENT_TYPES.keys
      if invalid_types.any?
        return { success: false, error: "Invalid document types: #{invalid_types.join(', ')}" }
      end

      Rails.logger.info "[DocumentMigration] Starting migration from #{from} to #{to} for types: #{requested_types.join(', ')}"

      results = {}
      total_documents = 0
      total_jobs_enqueued = 0

      requested_types.each do |type_name|
        klass = DOCUMENT_TYPES[type_name]
        result = migrate_document_type(klass, type_name, from, to, delete_source, batch_size, job_id)
        results[type_name] = result
        total_documents += result[:document_count]
        total_jobs_enqueued += result[:jobs_enqueued]
      end

      Rails.logger.info "[DocumentMigration] Total: #{total_documents} documents, #{total_jobs_enqueued} jobs enqueued"

      {
        success: true,
        message: "Migration started",
        total_documents: total_documents,
        jobs_enqueued: total_jobs_enqueued,
        source_provider: from,
        dest_provider: to,
        delete_source: delete_source,
        by_type: results
      }
    end

    # Migrate a single document type
    def migrate_document_type(klass, type_name, from, to, delete_source, batch_size, job_id = nil)
      # Build query based on document type
      # Skip orphaned documents (sync_status: 'missing' means file deleted from source)
      documents = klass.where(storage_provider: [from, nil])
                       .where(migration_status: [nil, 'failed'])
                       .where.not(sync_status: 'missing')

      # Add type-specific filters
      case type_name
      when 'JobDocument'
        documents = documents.where.not(sharepoint_item_id: nil)
        documents = documents.where(job_id: job_id) if job_id.present?
      when 'CorporateCompanyDocument'
        documents = documents.where.not(sharepoint_file_id: nil)
      when 'PeopleDocument'
        documents = documents.where.not(external_id: nil)
      end

      count = documents.count

      if count == 0
        return { document_count: 0, jobs_enqueued: 0, message: "No #{type_name} documents to migrate" }
      end

      Rails.logger.info "[DocumentMigration] Migrating #{count} #{type_name} documents"

      # Get document IDs first (before updating status, which would change query results)
      document_ids = documents.pluck(:id)

      # Reset failed and mark as pending
      klass.where(id: document_ids, migration_status: 'failed').update_all(
        migration_status: 'pending',
        migration_error: nil
      )
      klass.where(id: document_ids, migration_status: nil).update_all(migration_status: 'pending')

      # Enqueue jobs using the captured IDs
      jobs_enqueued = 0
      document_ids.each_slice(batch_size) do |id_batch|
        id_batch.each do |document_id|
          DocumentMigrationJob.perform_later(
            document_id,
            document_type: type_name,
            delete_source: delete_source
          )
          jobs_enqueued += 1
        end
      end

      { document_count: count, jobs_enqueued: jobs_enqueued }
    end

    # Get current migration status for all document types
    #
    # @return [Hash] Status with counts by migration_status
    #
    def migration_status
      status_by_type = {}
      total_counts = { pending: 0, in_progress: 0, completed: 0, failed: 0, not_migrated: 0 }
      total_documents = 0
      all_failures = []
      provider_breakdown = {}

      DOCUMENT_TYPES.each do |type_name, klass|
        counts = klass.group(:migration_status).count
        providers = klass.group(:storage_provider).count

        type_status = {
          total: klass.count,
          pending: counts['pending'] || 0,
          in_progress: counts['in_progress'] || 0,
          completed: counts['completed'] || 0,
          failed: counts['failed'] || 0,
          not_migrated: counts[nil] || 0,
          provider_breakdown: providers
        }

        status_by_type[type_name] = type_status
        total_documents += type_status[:total]
        total_counts[:pending] += type_status[:pending]
        total_counts[:in_progress] += type_status[:in_progress]
        total_counts[:completed] += type_status[:completed]
        total_counts[:failed] += type_status[:failed]
        total_counts[:not_migrated] += type_status[:not_migrated]

        # Collect failures
        failures = klass.where(migration_status: 'failed')
                        .order(updated_at: :desc)
                        .limit(3)
                        .pluck(:id, :file_name, :migration_error)
                        .map { |id, name, error| { type: type_name, id: id, file_name: name, error: error } }
        all_failures.concat(failures)

        # Merge provider breakdown
        providers.each do |provider, count|
          provider_breakdown[provider] ||= 0
          provider_breakdown[provider] += count
        end
      end

      total_with_status = total_counts.values.sum - total_counts[:not_migrated]

      # Email, attachment, and task counts (stored but not migration-tracked)
      email_eml_count = EmailWarehouse.where.not(sharepoint_email_path: [nil, ""]).count rescue 0
      email_attachment_count = EmailAttachment.where.not(sharepoint_path: [nil, ""]).count rescue 0
      task_doc_count = SmTaskAttachment.where(attachable_type: 'CorporateCompanyDocument').distinct.count(:attachable_id) rescue 0

      # Add to provider breakdown
      provider_breakdown['s3_compatible'] ||= 0
      provider_breakdown['s3_compatible'] += email_eml_count + email_attachment_count + task_doc_count

      # Grand total including emails, attachments, and tasks
      grand_total = total_documents + email_eml_count + email_attachment_count + task_doc_count

      {
        total_documents: total_documents,
        grand_total: grand_total,
        migration_in_progress: total_counts[:in_progress] > 0 || total_counts[:pending] > 0,
        status_counts: total_counts,
        provider_breakdown: provider_breakdown,
        progress_percent: total_with_status > 0 ? ((total_counts[:completed].to_f / total_with_status) * 100).round(1) : 0,
        by_type: status_by_type,
        recent_failures: all_failures.first(10),
        # Additional file types (not migration-tracked)
        additional_files: {
          email_eml: email_eml_count,
          email_attachments: email_attachment_count,
          task_documents: task_doc_count,
          total: email_eml_count + email_attachment_count + task_doc_count
        }
      }
    end

    # Cancel ongoing migration (marks pending as cancelled) for all types
    #
    # @return [Hash] Result with count of cancelled jobs
    #
    def cancel_migration
      total_cancelled = 0

      DOCUMENT_TYPES.each do |type_name, klass|
        cancelled = klass.where(migration_status: 'pending').update_all(migration_status: nil)
        total_cancelled += cancelled
        Rails.logger.info "[DocumentMigration] Cancelled #{cancelled} pending #{type_name} migrations"
      end

      {
        success: true,
        message: "Migration cancelled",
        cancelled_count: total_cancelled
      }
    end

    # Retry failed migrations for all document types
    #
    # @param options [Hash] Options for retry
    #   - delete_source: [Boolean] Delete from source after migration
    #   - document_types: [Array<String>] Specific types to retry (default: all)
    #
    # @return [Hash] Result with count of retried jobs
    #
    def retry_failed(**options)
      delete_source = options.fetch(:delete_source, false)
      requested_types = options[:document_types] || DOCUMENT_TYPES.keys

      total_retried = 0
      results = {}

      requested_types.each do |type_name|
        klass = DOCUMENT_TYPES[type_name]
        next unless klass

        failed_documents = klass.where(migration_status: 'failed')
        count = failed_documents.count

        if count > 0
          # Reset status and re-enqueue
          failed_documents.update_all(
            migration_status: 'pending',
            migration_error: nil
          )

          failed_documents.find_each do |document|
            DocumentMigrationJob.perform_later(
              document.id,
              document_type: type_name,
              delete_source: delete_source
            )
          end

          Rails.logger.info "[DocumentMigration] Retrying #{count} failed #{type_name} migrations"
        end

        results[type_name] = count
        total_retried += count
      end

      {
        success: true,
        message: "Retrying #{total_retried} failed migrations",
        retried_count: total_retried,
        by_type: results
      }
    end

    # Estimate migration time based on document count and sizes for all types
    #
    # @param from [String] Source provider
    # @return [Hash] Estimation with document count and estimated time
    #
    def estimate_migration(from:)
      estimates = {}
      total_count = 0
      total_size = 0

      DOCUMENT_TYPES.each do |type_name, klass|
        documents = klass.where(storage_provider: [from, nil])
                         .where(migration_status: [nil, 'failed'])

        count = documents.count
        size = documents.sum(:file_size) || 0

        estimates[type_name] = { count: count, size_bytes: size, size_formatted: format_size(size) }
        total_count += count
        total_size += size
      end

      # Rough estimate: 5 seconds per document (download + upload + db update)
      # Add time for large files
      estimated_seconds = total_count * 5
      estimated_seconds += (total_size / (10.megabytes)) * 10 # Extra 10s per 10MB

      {
        document_count: total_count,
        total_size_bytes: total_size,
        total_size_formatted: format_size(total_size),
        estimated_minutes: (estimated_seconds / 60.0).ceil,
        estimated_time_formatted: format_duration(estimated_seconds),
        by_type: estimates
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
