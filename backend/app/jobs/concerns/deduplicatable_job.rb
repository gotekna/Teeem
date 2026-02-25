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

  included do
    before_perform do |job|
      my_job_id = job.provider_job_id.to_i
      other_claimed_id = self.class.lowest_claimed_job_id(excluding_job_id: my_job_id)

      if other_claimed_id
        # ⚠️ Race condition breaker: when 2 threads claim the same job class
        # simultaneously (e.g., after worker restart), LOWEST job ID wins.
        # Without this, both threads see the other as claimed and both abort,
        # or neither sees the other (timing) and both proceed.
        if other_claimed_id < my_job_id
          Rails.logger.info "[DeduplicatableJob] Skipping #{job.class.name} (job_id: #{my_job_id}) - lower instance #{other_claimed_id} already running"
          throw :abort
        else
          Rails.logger.info "[DeduplicatableJob] Proceeding #{job.class.name} (job_id: #{my_job_id}) - this is the lowest claimed instance (other: #{other_claimed_id})"
        end
      end

      # When this job starts executing, clear all other queued (Ready) copies.
      # The scheduler enqueues freely (avoiding SolidQueue bug), but when ANY copy
      # starts, it clears queued siblings. Net effect: at most 1 running + 1 queued.
      self.class.cleanup_duplicate_ready_copies!(excluding_job_id: my_job_id)

      # Clean up dead predecessors so they don't accumulate
      self.class.cleanup_dead_predecessors!
    end
  end

  class_methods do
    # Returns the lowest SolidQueue::Job ID that is currently claimed (running)
    # for this job class, excluding the given job_id. Returns nil if none found.
    def lowest_claimed_job_id(excluding_job_id: nil)
      unfinished = SolidQueue::Job.where(finished_at: nil).where(class_name: name)
      unfinished = unfinished.where.not(id: excluding_job_id) if excluding_job_id

      SolidQueue::ClaimedExecution
        .where(job_id: unfinished.select(:id))
        .joins(:job)
        .minimum("solid_queue_jobs.id")
    end

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
