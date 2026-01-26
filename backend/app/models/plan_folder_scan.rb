# frozen_string_literal: true

# Tracks files found in storage (SharePoint/S3/Wasabi) for processing
# Used to detect new/updated plans from Revit exports
class PlanFolderScan < ApplicationRecord
  belongs_to :job
  belongs_to :job_plan, optional: true

  # Status values
  STATUSES = %w[pending processing processed skipped error].freeze

  # SSoT: storage_item_id is THE ONE identifier for all providers
  # (storage_file_id was renamed from sharepoint_file_id)
  validates :storage_item_id, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }

  scope :pending, -> { where(status: "pending") }
  scope :processing, -> { where(status: "processing") }
  scope :processed, -> { where(status: "processed") }
  scope :needs_processing, -> { where(status: %w[pending error]) }
  scope :recent, -> { order(created_at: :desc) }

  # Check if file needs reprocessing (modified since last scan)
  def needs_update?(new_modified_at)
    return true if file_modified_at.nil?
    new_modified_at > file_modified_at
  end

  # Mark as processing
  def start_processing!
    update!(status: "processing")
  end

  # Mark as processed with linked plan
  def mark_processed!(job_plan)
    update!(
      status: "processed",
      job_plan: job_plan,
      processed_at: Time.current,
      error_message: nil
    )
  end

  # Mark as error
  def mark_error!(message)
    update!(
      status: "error",
      error_message: message
    )
  end

  # Mark as skipped (e.g., not a plan file)
  def mark_skipped!(reason = nil)
    update!(
      status: "skipped",
      error_message: reason
    )
  end

  # Count of files pending processing (for navigation badge)
  def self.pending_count
    pending.count
  end

  # Provider-agnostic storage reference (SSoT: storage_item_id)
  # Falls back to storage_file_id for backwards compatibility
  def storage_reference
    storage_item_id.presence || storage_file_id
  end

end
