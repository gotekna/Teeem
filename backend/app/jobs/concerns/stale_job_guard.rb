# frozen_string_literal: true

# StaleJobGuard - Skips recurring jobs that sat in the queue too long
#
# FRC (Mar 2026): When the shared worker restarts (deploy, R14 crash, etc.),
# SolidQueue's recurring scheduler enqueues new copies of every recurring job
# immediately. If the worker was down for 30 minutes, some jobs (like
# XeroInvoiceSyncJob at 15-min intervals) accumulate 2-3 stale copies.
# With a single-threaded worker, each 30-second Xero sync processes sequentially,
# creating 40+ minutes of redundant work from jobs that are no longer relevant.
#
# This concern checks job age in before_perform. If the job was enqueued longer
# ago than max_job_age, it skips instantly (log + throw :abort). The next
# scheduler-enqueued copy will be fresh and process normally.
#
# Usage:
#   class MyRecurringJob < ApplicationJob
#     include StaleJobGuard
#     self.max_job_age = 90.seconds  # ~1.5x the schedule interval
#
#     def perform
#       # ...
#     end
#   end
#
# Guidelines for max_job_age:
#   - Set to ~1.5x the recurring schedule interval
#   - 60s schedule  → 90s max_job_age
#   - 5min schedule → 8min max_job_age
#   - 15min schedule → 20min max_job_age
#
# NOT suitable for:
#   - One-shot jobs (BPMN, user-triggered) - they must always run
#   - Jobs with internal time budgets that handle staleness themselves
#   - SmRolloverJob (daily, must always run even if late)
#
module StaleJobGuard
  extend ActiveSupport::Concern

  included do
    class_attribute :max_job_age, default: nil

    before_perform :skip_if_stale!
  end

  private

  def skip_if_stale!
    return unless self.class.max_job_age

    job_age = compute_job_age
    return unless job_age # Can't determine age — run the job

    if job_age > self.class.max_job_age
      Rails.logger.info(
        "[StaleJobGuard] Skipping stale #{self.class.name} " \
        "(age: #{job_age.round(1)}s, max: #{self.class.max_job_age}s)"
      )
      throw :abort
    end
  end

  # Compute how long this job has been waiting in the queue.
  # Uses provider_job_id to look up the SolidQueue::Job record's created_at.
  def compute_job_age
    return nil unless provider_job_id

    sq_job = SolidQueue::Job.find_by(id: provider_job_id)
    return nil unless sq_job&.created_at

    Time.current - sq_job.created_at
  rescue StandardError => e
    Rails.logger.debug("[StaleJobGuard] Could not compute age for #{self.class.name}: #{e.message}")
    nil
  end
end
