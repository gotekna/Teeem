# frozen_string_literal: true

# =============================================================================
# PlanCombinerJob - Auto-regenerate "All Plans" combined PDF
# =============================================================================
# Triggered after any plan is added/updated/deleted.
# Debounces multiple rapid changes by using unique job key.
# =============================================================================
class PlanCombinerJob < ApplicationJob
  queue_as :default

  # Debounce: Only run once per job within 5 seconds
  # If multiple plans change rapidly, only one combine runs
  def self.enqueue_for_job(job_id)
    set(wait: 5.seconds).perform_later(job_id)
  end

  def perform(job_id)
    job = Job.find_by(id: job_id)
    return unless job

    Rails.logger.info "[PlanCombinerJob] Starting combine for job #{job_id}"

    PlanCombinerService.new(job).combine_all_plans!

    Rails.logger.info "[PlanCombinerJob] Completed combine for job #{job_id}"
  rescue PlanCombinerService::CombineError => e
    Rails.logger.error "[PlanCombinerJob] Combine failed: #{e.message}"
    # Don't re-raise - this is a non-critical operation
  rescue => e
    Rails.logger.error "[PlanCombinerJob] Unexpected error: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    # Don't re-raise - this is a non-critical operation
  end
end
