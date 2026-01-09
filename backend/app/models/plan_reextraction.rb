# frozen_string_literal: true

# =============================================================================
# PlanReextraction - Tracks the lifecycle of plan re-extraction operations
# =============================================================================
# This model is THE SSoT for plan re-extraction progress tracking.
#
# Status Flow:
#   pending → processing → completed
#                ↓
#              failed
#
# Usage:
#   reextraction = PlanReextraction.create!(job: job)
#   reextraction.start_processing!(total: 14)
#   reextraction.update_progress!(processed: 5, current_name: "05 - Floor Plan")
#   reextraction.add_updated_plan!("01-PERSPECTIVE 05 Wategos ConD")
#   reextraction.mark_completed!
#
# =============================================================================
class PlanReextraction < ApplicationRecord
  belongs_to :job

  # Status constants
  STATUSES = %w[pending processing completed failed].freeze

  validates :status, inclusion: { in: STATUSES }

  scope :active, -> { where(status: %w[pending processing]) }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :recent, -> { order(created_at: :desc) }

  # ============================================================================
  # Status Transitions
  # ============================================================================

  def start_processing!(total:)
    update!(
      status: "processing",
      total_plans: total,
      processed_plans: 0,
      started_at: Time.current,
      current_step: "Starting re-extraction..."
    )
  end

  def update_progress!(processed:, current_name: nil)
    update!(
      processed_plans: processed,
      current_plan_name: current_name,
      current_step: "Processing #{processed + 1} of #{total_plans}..."
    )
  end

  def add_updated_plan!(new_name)
    updated = plans_updated || []
    updated << new_name
    update!(plans_updated: updated)
  end

  def add_rename_error!(filename, error_message)
    errors = rename_errors || []
    errors << { file: filename, error: error_message }
    update!(rename_errors: errors)
  end

  def mark_completed!
    update!(
      status: "completed",
      completed_at: Time.current,
      processed_plans: total_plans,
      current_step: "Completed",
      current_plan_name: nil
    )
  end

  def mark_failed!(message)
    update!(
      status: "failed",
      error_message: message,
      current_step: "Failed"
    )
  end

  # ============================================================================
  # Query Methods
  # ============================================================================

  def in_progress?
    %w[pending processing].include?(status)
  end

  def progress_percent
    return 0 if total_plans.nil? || total_plans.zero?
    return 100 if status == "completed"

    ((processed_plans.to_f / total_plans) * 100).round
  end

  def duration_seconds
    return nil unless started_at
    end_time = completed_at || Time.current
    (end_time - started_at).round
  end

  def formatted_duration
    seconds = duration_seconds
    return nil unless seconds

    if seconds < 60
      "#{seconds}s"
    else
      minutes = seconds / 60
      remaining_seconds = seconds % 60
      "#{minutes}m #{remaining_seconds}s"
    end
  end

  # ============================================================================
  # Serialization
  # ============================================================================

  def as_json_status
    {
      id: id,
      job_id: job_id,
      status: status,
      current_step: current_step,
      progress_percent: progress_percent,
      total_plans: total_plans,
      processed_plans: processed_plans,
      current_plan_name: current_plan_name,
      plans_updated: plans_updated || [],
      plans_count: (plans_updated || []).length,
      rename_errors: rename_errors || [],
      error_message: error_message,
      duration: formatted_duration,
      started_at: started_at&.iso8601,
      completed_at: completed_at&.iso8601,
      created_at: created_at&.iso8601
    }
  end
end
