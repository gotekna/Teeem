# frozen_string_literal: true

# DeduplicatableJob - Prevents duplicate recurring jobs from executing concurrently
#
# FRC (Feb 2026): When the worker falls behind (R14 memory, slow jobs, etc.),
# the SolidQueue scheduler keeps enqueuing new instances of recurring jobs even
# though identical ones haven't finished yet. This caused 6,179 queued jobs on
# teeem-staging-worker with hundreds of duplicates per job class.
#
# Include this concern in any recurring job that should only have ONE active
# instance at a time. If a job of the same class is already executing,
# the new instance waits as a BlockedExecution until the running one finishes.
#
# ⚠️ DO NOT SIMPLIFY already_running? to just check finished_at (Feb 2026)
# ════════════════════════════════════════════
# Why: SolidQueue never sets finished_at on failed jobs. When a Heroku dyno dies
# during deploy, SolidQueue creates a FailedExecution with ProcessPrunedError but
# leaves finished_at NULL. The old check (finished_at: nil) would permanently block
# ALL future scheduled enqueues for that job class until manual DB cleanup.
# ❌ WRONG: .where(finished_at: nil).exists? — blocks on dead/failed jobs forever
# ✅ CORRECT: Check for ReadyExecution OR ClaimedExecution (genuinely active jobs)
# ════════════════════════════════════════════
#
# ⚠️ DO NOT MOVE BACK TO before_enqueue (Feb 2026)
# ════════════════════════════════════════════
# Why: SolidQueue 1.1.5's RecurringTask#enqueue_and_record sets
# `successfully_enqueued = true` OUTSIDE `run_callbacks(:enqueue)`.
# When before_enqueue throws :abort, Job.enqueue is never called so
# provider_job_id stays nil, but the code still tries to insert into
# solid_queue_recurring_executions with job_id: NULL → NotNullViolation.
# This caused 3,140 Sentry errors in 48 hours across all 22 jobs using
# this concern. Perform-time dedup avoids the SolidQueue bug entirely.
# ❌ WRONG: before_enqueue { throw :abort } — breaks SolidQueue recurring scheduler
# ✅ CORRECT: before_perform check — job enqueues normally, exits early if duplicate
# ════════════════════════════════════════════
#
# ⚠️ DO NOT REPLACE limits_concurrency WITH pg_try_advisory_lock (Feb 2026)
# ════════════════════════════════════════════
# Why: Heroku's managed PostgreSQL shares the same backend PID across all
# connections in a pool (tested: both threads get pg_backend_pid=677616).
# pg_try_advisory_lock is reentrant within the same session, so BOTH threads
# successfully acquire the "same" lock — zero dedup effect.
# SolidQueue's limits_concurrency uses solid_queue_semaphores table with
# database-level unique constraints — works regardless of connection pooling.
# ❌ WRONG: pg_try_advisory_lock — reentrant on shared PG sessions (Heroku)
# ✅ CORRECT: limits_concurrency — uses DB semaphore table, atomic guarantee
# ════════════════════════════════════════════
#
# Usage:
#   class MyRecurringJob < ApplicationJob
#     include DeduplicatableJob
#
#     def perform
#       # ...
#     end
#   end
#
module DeduplicatableJob
  extend ActiveSupport::Concern

  included do
    # SolidQueue's built-in concurrency control (uses solid_queue_semaphores table).
    # Only 1 instance of each job class can execute at a time.
    # Additional copies wait as BlockedExecution (not consuming threads).
    # When the running job finishes, SolidQueue auto-unblocks the next one.
    # ⚠️ key lambda runs via instance_exec (SolidQueue line 53 in concurrency_controls.rb)
    # so `self` is the job INSTANCE, not the class. Must use self.class.name.
    limits_concurrency to: 1, key: ->(*) { self.class.name }

    before_perform do |job|
      # Clean up duplicate queued/blocked copies (housekeeping).
      self.class.cleanup_duplicate_copies!(excluding_job_id: job.provider_job_id)
      self.class.cleanup_dead_predecessors!
    end
  end

  class_methods do

    # Clear duplicate Ready and excess Blocked copies of this job class.
    # With limits_concurrency, excess jobs accumulate as BlockedExecutions.
    # Keep at most 1 blocked copy (the next one to run when current finishes).
    def cleanup_duplicate_copies!(excluding_job_id: nil)
      duplicates = SolidQueue::Job.where(finished_at: nil, class_name: name)
      duplicates = duplicates.where.not(id: excluding_job_id) if excluding_job_id

      # Clean ready copies
      ready_ids = SolidQueue::ReadyExecution.where(job_id: duplicates.select(:id)).pluck(:job_id)
      if ready_ids.any?
        Rails.logger.info "[DeduplicatableJob] Clearing #{ready_ids.count} duplicate ready #{name} job(s)"
        SolidQueue::ReadyExecution.where(job_id: ready_ids).delete_all
        SolidQueue::Job.where(id: ready_ids).update_all(finished_at: Time.current)
      end

      # Clean excess blocked copies (keep 1 for when current finishes)
      blocked_job_ids = SolidQueue::BlockedExecution
        .joins(:job)
        .where(solid_queue_jobs: { class_name: name, finished_at: nil })
        .order("solid_queue_jobs.id ASC")
        .pluck(:job_id)

      if blocked_job_ids.size > 1
        excess_ids = blocked_job_ids[1..] # Keep oldest, remove rest
        Rails.logger.info "[DeduplicatableJob] Clearing #{excess_ids.count} excess blocked #{name} job(s)"
        SolidQueue::BlockedExecution.where(job_id: excess_ids).delete_all
        SolidQueue::Job.where(id: excess_ids).update_all(finished_at: Time.current)
      end
    end

    def cleanup_dead_predecessors!
      dead_job_ids = SolidQueue::Job
        .where(finished_at: nil)
        .where(class_name: name)
        .where.not(id: SolidQueue::ReadyExecution.select(:job_id))
        .where.not(id: SolidQueue::ClaimedExecution.select(:job_id))
        .where.not(id: SolidQueue::BlockedExecution.select(:job_id))
        .pluck(:id)

      if dead_job_ids.any?
        Rails.logger.info "[DeduplicatableJob] Cleaning up #{dead_job_ids.count} dead #{name} job(s): #{dead_job_ids}"
        SolidQueue::FailedExecution.where(job_id: dead_job_ids).delete_all
        SolidQueue::Job.where(id: dead_job_ids).update_all(finished_at: Time.current)
      end

      # Also clear stale FailedExecutions older than 24 hours for this job class.
      # Failed jobs accumulate forever otherwise, cluttering the dashboard.
      old_failed_job_ids = SolidQueue::FailedExecution
        .joins(:job)
        .where(solid_queue_jobs: { class_name: name })
        .where("solid_queue_failed_executions.created_at < ?", 24.hours.ago)
        .pluck(:job_id)

      return if old_failed_job_ids.empty?

      Rails.logger.info "[DeduplicatableJob] Clearing #{old_failed_job_ids.count} stale failed #{name} job(s)"
      SolidQueue::FailedExecution.where(job_id: old_failed_job_ids).delete_all
      SolidQueue::Job.where(id: old_failed_job_ids).update_all(finished_at: Time.current)
    end
  end
end
