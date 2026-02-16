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
      if self.class.already_running?(excluding_job_id: job.provider_job_id)
        Rails.logger.info "[DeduplicatableJob] Skipping #{job.class.name} (job_id: #{job.provider_job_id}) - another instance already running"
        throw :abort
      end

      # Clean up dead predecessors so they don't accumulate
      self.class.cleanup_dead_predecessors!
    end
  end

  class_methods do
    def already_running?(excluding_job_id: nil)
      # Only block if another job is currently executing (ClaimedExecution).
      # ReadyExecution means it's in queue but not running yet - that's fine,
      # the worker will pick them up sequentially.
      unfinished = SolidQueue::Job.where(finished_at: nil).where(class_name: name)
      unfinished = unfinished.where.not(id: excluding_job_id) if excluding_job_id

      SolidQueue::ClaimedExecution
        .where(job_id: unfinished.select(:id))
        .exists?
    end

    def cleanup_dead_predecessors!
      dead_job_ids = SolidQueue::Job
        .where(finished_at: nil)
        .where(class_name: name)
        .where.not(id: SolidQueue::ReadyExecution.select(:job_id))
        .where.not(id: SolidQueue::ClaimedExecution.select(:job_id))
        .pluck(:id)

      return if dead_job_ids.empty?

      Rails.logger.info "[DeduplicatableJob] Cleaning up #{dead_job_ids.count} dead #{name} job(s): #{dead_job_ids}"

      SolidQueue::FailedExecution.where(job_id: dead_job_ids).delete_all
      SolidQueue::Job.where(id: dead_job_ids).update_all(finished_at: Time.current)
    end
  end
end
