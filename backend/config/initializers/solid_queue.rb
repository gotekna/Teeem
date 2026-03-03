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
# FRC (Mar 2026): Boot-time duplicate ReadyExecution cleanup. After a restart,
# the recurring scheduler may enqueue dozens of duplicate copies of each
# recurring job class. Rather than processing them all one-by-one through
# StaleJobGuard/DeduplicatableJob (which works but is slow), we purge
# duplicates in bulk at boot time. For each recurring job class with multiple
# ReadyExecutions, keep only the newest and finish the rest.
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

    # Purge duplicate ReadyExecutions per job class (keep newest of each)
    begin
      # Group ReadyExecutions by class_name, find classes with duplicates
      dupes_by_class = SolidQueue::ReadyExecution
        .joins(:job)
        .group("solid_queue_jobs.class_name")
        .having("COUNT(*) > 1")
        .count # Returns { "ClassName" => count }

      if dupes_by_class.any?
        total_purged = 0

        dupes_by_class.each do |class_name, count|
          # Get all ReadyExecution IDs for this class, ordered newest first
          ready_ids = SolidQueue::ReadyExecution
            .joins(:job)
            .where(solid_queue_jobs: { class_name: class_name })
            .order("solid_queue_jobs.id DESC")
            .pluck(:id, :job_id)

          # Keep the newest (first), finish the rest
          excess = ready_ids[1..]
          next if excess.empty?

          excess_ready_ids = excess.map(&:first)
          excess_job_ids = excess.map(&:last)

          SolidQueue::ReadyExecution.where(id: excess_ready_ids).delete_all
          SolidQueue::Job.where(id: excess_job_ids).update_all(finished_at: Time.current)
          total_purged += excess.size
        end

        Rails.logger.info "[SolidQueue] Boot cleanup: purged #{total_purged} duplicate ReadyExecution(s) across #{dupes_by_class.size} job class(es): #{dupes_by_class.keys.join(', ')}"
      end
    rescue => e
      Rails.logger.warn "[SolidQueue] Failed to purge duplicate ReadyExecutions on boot: #{e.message}"
    end
  end
end
