# frozen_string_literal: true

# =============================================================================
# PlanUpload - Tracks the lifecycle of plan set uploads
# =============================================================================
# This model is THE SSoT for plan upload progress tracking.
#
# Status Flow:
#   pending → uploading → splitting → processing → completed
#                ↓            ↓           ↓
#              failed ←───────┴───────────┘
#                ↓
#            (can resume)
#
# Usage:
#   upload = PlanUpload.create!(job: job, original_filename: "plans.pdf")
#   upload.start_uploading!
#   upload.mark_splitting!(total_pages: 13)
#   upload.mark_processing!
#   upload.update_progress!(page: 5, plan_name: "05 - Floor Plan")
#   upload.mark_completed!
#
# =============================================================================
class PlanUpload < ApplicationRecord
  belongs_to :job
  belongs_to :uploaded_by, class_name: "User", optional: true
  belongs_to :job_plan_tab, optional: true

  # Status constants
  STATUSES = %w[pending uploading splitting processing completed failed].freeze

  validates :status, inclusion: { in: STATUSES }
  validates :original_filename, presence: true

  scope :active, -> { where(status: %w[pending uploading splitting processing]) }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :recent, -> { order(created_at: :desc) }

  # ============================================================================
  # Status Transitions
  # ============================================================================

  def start_uploading!
    update!(
      status: "uploading",
      started_at: Time.current,
      current_step: "Uploading to SharePoint..."
    )
  end

  def mark_splitting!(total_pages:)
    update!(
      status: "splitting",
      total_pages: total_pages,
      current_step: "Splitting PDF into #{total_pages} pages..."
    )
  end

  def mark_processing!
    update!(
      status: "processing",
      current_step: "Processing pages..."
    )
  end

  def update_progress!(page:, plan_name: nil)
    new_plans = plans_created || []
    new_plans << plan_name if plan_name.present?

    update!(
      processed_pages: page,
      plans_created: new_plans,
      current_step: "Uploading page #{page} of #{total_pages}..."
    )
  end

  def mark_completed!
    update!(
      status: "completed",
      completed_at: Time.current,
      current_step: "Completed"
    )
  end

  def mark_failed!(error_message)
    update!(
      status: "failed",
      error_message: error_message,
      current_step: "Failed"
    )
  end

  def mark_retrying!
    update!(
      status: "processing",
      retry_count: (retry_count || 0) + 1,
      last_retry_at: Time.current,
      error_message: nil,
      current_step: "Retrying from page #{processed_pages + 1}..."
    )
  end

  # ============================================================================
  # Query Methods
  # ============================================================================

  def in_progress?
    %w[pending uploading splitting processing].include?(status)
  end

  def can_resume?
    status == "failed" && staging_file_id.present? && processed_pages.to_i < total_pages.to_i
  end

  def progress_percent
    return 0 if total_pages.nil? || total_pages.zero?
    return 100 if status == "completed"

    # Weight: uploading=10%, splitting=10%, processing=80%
    base_percent = case status
    when "pending" then 0
    when "uploading" then 5
    when "splitting" then 10
    when "processing", "failed"
      10 + ((processed_pages.to_f / total_pages) * 80).round
    when "completed" then 100
    else 0
    end

    [base_percent, 100].min
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
      total_pages: total_pages,
      processed_pages: processed_pages,
      plans_created: plans_created || [],
      plans_count: (plans_created || []).length,
      can_resume: can_resume?,
      error_message: error_message,
      duration: formatted_duration,
      started_at: started_at&.iso8601,
      completed_at: completed_at&.iso8601,
      created_at: created_at&.iso8601
    }
  end

  # ============================================================================
  # Staging File Management
  # ============================================================================

  def staging_filename
    "#{id}_#{created_at.to_i}_#{original_filename}"
  end

  def self.staging_folder_name
    "_staging"
  end

  # Clean up old staging files (called by scheduled job)
  def self.cleanup_stale_staging_files!(max_age: 24.hours)
    stale_uploads = where(status: "failed")
                      .where("created_at < ?", max_age.ago)
                      .where.not(staging_file_id: nil)

    credential = OrganizationSharePointCredential.active_credential
    return { cleaned: 0, errors: [] } unless credential

    client = MicrosoftGraphClient.new(credential)
    cleaned = 0
    errors = []

    stale_uploads.find_each do |upload|
      begin
        client.delete("/drives/#{credential.drive_id}/items/#{upload.staging_file_id}")
        upload.update!(staging_file_id: nil)
        cleaned += 1
      rescue => e
        errors << { id: upload.id, error: e.message }
      end
    end

    { cleaned: cleaned, errors: errors }
  end
end
