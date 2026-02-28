# frozen_string_literal: true

# SolidQueue error reporting - send thread-level errors to Sentry
#
# FRC (Feb 2026): SolidQueue worker threads can fail silently. This ensures
# all thread-level errors (not just job-level) are reported to Sentry for
# visibility into queue infrastructure issues.
#
# FRC (Feb 2026): Also cleans up orphaned SolidQueue::Job records for deleted
# job classes on boot. When job classes are renamed/deleted, their SolidQueue
# records remain. SolidQueue's concurrency_controls try to call methods on the
# (nil) job class, causing DelegationError (298 errors in 14 days).
#
Rails.application.config.after_initialize do
  if defined?(SolidQueue) && defined?(Sentry)
    SolidQueue.on_thread_error = ->(error) do
      Rails.logger.error "[SolidQueue] Thread error: #{error.class} - #{error.message}"
      Sentry.capture_exception(error) do |scope|
        scope.set_tags(source: "solid_queue", error_type: "thread_error")
      end
    end
  end

  # Clean up orphaned SolidQueue jobs for deleted job classes
  if defined?(SolidQueue) && SolidQueue::Job.table_exists?
    begin
      orphaned_class_names = SolidQueue::Job
        .where(finished_at: nil)
        .distinct
        .pluck(:class_name)
        .select { |name| name.safe_constantize.nil? }

      if orphaned_class_names.any?
        orphaned_jobs = SolidQueue::Job.where(class_name: orphaned_class_names, finished_at: nil)
        orphaned_ids = orphaned_jobs.pluck(:id)

        SolidQueue::BlockedExecution.where(job_id: orphaned_ids).delete_all
        SolidQueue::ReadyExecution.where(job_id: orphaned_ids).delete_all
        SolidQueue::FailedExecution.where(job_id: orphaned_ids).delete_all
        if SolidQueue::Job.column_names.include?("concurrency_key")
          SolidQueue::Semaphore.where(key: orphaned_class_names).delete_all
        end
        orphaned_jobs.update_all(finished_at: Time.current)

        Rails.logger.info "[SolidQueue] Cleaned up #{orphaned_ids.count} orphaned job(s) for deleted classes: #{orphaned_class_names.join(', ')}"
      end
    rescue => e
      Rails.logger.warn "[SolidQueue] Failed to clean orphaned jobs on boot: #{e.message}"
    end
  end
end
