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
# the new instance exits immediately at perform-time.
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

  # ⚠️ DO NOT REPLACE pg_try_advisory_lock WITH ClaimedExecution CHECKS (Feb 2026)
  # ════════════════════════════════════════════
  # Why: When 2 threads claim the same job class simultaneously (e.g., after
  # worker restart), both ClaimedExecution records exist but neither thread's
  # before_perform can see the other's record due to transaction isolation.
  # Advisory locks are atomic at the PostgreSQL level - no race possible.
  # ❌ WRONG: Check ClaimedExecution.exists? — race condition on simultaneous claim
  # ✅ CORRECT: pg_try_advisory_lock — atomic, one winner guaranteed
  # ════════════════════════════════════════════
  included do
    before_perform do |job|
      # Atomic lock: only ONE instance of this job class can hold the lock.
      # pg_try_advisory_lock is session-scoped (released on connection close/return).
      lock_key = Zlib.crc32(self.class.name).to_i & 0x7FFFFFFF # Positive int32
      locked = ActiveRecord::Base.connection.select_value("SELECT pg_try_advisory_lock(#{lock_key})")

      unless locked
        Rails.logger.info "[DeduplicatableJob] Skipping #{job.class.name} (job_id: #{job.provider_job_id}) - another instance holds the lock"
        throw :abort
      end

      @_dedup_lock_key = lock_key

      # When this job starts executing, clear all other queued (Ready) copies.
      # The scheduler enqueues freely (avoiding SolidQueue bug), but when ANY copy
      # starts, it clears queued siblings. Net effect: at most 1 running + 1 queued.
      self.class.cleanup_duplicate_ready_copies!(excluding_job_id: job.provider_job_id)

      # Clean up dead predecessors so they don't accumulate
      self.class.cleanup_dead_predecessors!
    end

    after_perform do |_job|
      if @_dedup_lock_key
        ActiveRecord::Base.connection.execute("SELECT pg_advisory_unlock(#{@_dedup_lock_key})")
      end
    end
  end

  class_methods do

    # Clear all queued (ReadyExecution) copies of this job class except the one running.
    # Prevents queue bloat when scheduler enqueues faster than worker processes.
    def cleanup_duplicate_ready_copies!(excluding_job_id: nil)
      duplicates = SolidQueue::Job.where(finished_at: nil, class_name: name)
      duplicates = duplicates.where.not(id: excluding_job_id) if excluding_job_id

      ready_ids = SolidQueue::ReadyExecution.where(job_id: duplicates.select(:id)).pluck(:job_id)
      return if ready_ids.empty?

      Rails.logger.info "[DeduplicatableJob] Clearing #{ready_ids.count} duplicate queued #{name} job(s)"
      SolidQueue::ReadyExecution.where(job_id: ready_ids).delete_all
      SolidQueue::Job.where(id: ready_ids).update_all(finished_at: Time.current)
    end

    def cleanup_dead_predecessors!
      dead_job_ids = SolidQueue::Job
        .where(finished_at: nil)
        .where(class_name: name)
        .where.not(id: SolidQueue::ReadyExecution.select(:job_id))
        .where.not(id: SolidQueue::ClaimedExecution.select(:job_id))
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
