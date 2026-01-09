# frozen_string_literal: true

# =============================================================================
# BatchOperation - THE ONE SSoT for all batch operation progress tracking
# =============================================================================
# This model consolidates all batch operation tracking into a single table.
#
# Replaces:
#   - PlanUpload (operation_type: "plan_upload")
#   - PlanReextraction (operation_type: "plan_reextract")
#
# Adds:
#   - folder_scan: Scan SharePoint folders for new plan files
#   - folder_process: Process pending scanned files into plans
#
# Status Flow:
#   pending → processing → completed
#                ↓
#              failed
#
# Usage:
#   op = BatchOperation.create_plan_upload!(job: job, user: user, filename: "plans.pdf")
#   op.start_processing!(total: 14)
#   op.update_progress!(processed: 5, current_name: "05 - Floor Plan")
#   op.add_completed_item!("01-PERSPECTIVE")
#   op.mark_completed!
#
# =============================================================================
class BatchOperation < ApplicationRecord
  belongs_to :job, optional: true  # folder_scan doesn't require a job
  belongs_to :user, optional: true

  # Operation types
  OPERATION_TYPES = %w[plan_upload plan_reextract folder_scan folder_process].freeze

  # Status constants
  STATUSES = %w[pending processing completed failed].freeze

  validates :operation_type, presence: true, inclusion: { in: OPERATION_TYPES }
  validates :status, inclusion: { in: STATUSES }

  scope :active, -> { where(status: %w[pending processing]) }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :recent, -> { order(created_at: :desc) }

  # Scopes by operation type
  scope :plan_uploads, -> { where(operation_type: "plan_upload") }
  scope :plan_reextracts, -> { where(operation_type: "plan_reextract") }
  scope :folder_scans, -> { where(operation_type: "folder_scan") }
  scope :folder_processes, -> { where(operation_type: "folder_process") }

  # ============================================================================
  # Factory Methods (create operations with proper defaults)
  # ============================================================================

  def self.create_plan_upload!(job:, user: nil, filename:, tab_id: nil)
    create!(
      job: job,
      user: user,
      operation_type: "plan_upload",
      status: "pending",
      current_step: "Uploading to SharePoint...",
      metadata: {
        original_filename: filename,
        job_plan_tab_id: tab_id
      }
    )
  end

  def self.create_plan_reextract!(job:, user: nil)
    create!(
      job: job,
      user: user,
      operation_type: "plan_reextract",
      status: "pending",
      current_step: "Preparing re-extraction...",
      metadata: {
        apply_templates: true,
        rename_sharepoint: true
      }
    )
  end

  def self.create_folder_scan!(user: nil)
    create!(
      user: user,
      operation_type: "folder_scan",
      status: "pending",
      current_step: "Preparing to scan folders...",
      metadata: {
        jobs_scanned: [],
        files_found: 0
      }
    )
  end

  def self.create_folder_process!(user: nil)
    create!(
      user: user,
      operation_type: "folder_process",
      status: "pending",
      current_step: "Preparing to process files...",
      metadata: {}
    )
  end

  # ============================================================================
  # Status Transitions
  # ============================================================================

  def start_processing!(total:)
    update!(
      status: "processing",
      total_items: total,
      processed_items: 0,
      started_at: Time.current,
      current_step: step_message_for_start
    )
  end

  def update_progress!(processed:, current_name: nil)
    update!(
      processed_items: processed,
      current_item_name: current_name,
      current_step: step_message_for_progress(processed)
    )
  end

  def add_completed_item!(item_name_or_details)
    items = items_completed || []
    items << item_name_or_details
    update!(items_completed: items)
  end

  def add_error!(item:, message:)
    errs = operation_errors || []
    errs << { item: item, message: message }
    update!(operation_errors: errs)
  end

  def mark_completed!
    update!(
      status: "completed",
      completed_at: Time.current,
      processed_items: total_items,
      current_step: "Completed",
      current_item_name: nil
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
  # Metadata Helpers (operation-specific)
  # ============================================================================

  def original_filename
    metadata&.dig("original_filename")
  end

  def staging_file_id
    metadata&.dig("staging_file_id")
  end

  def staging_file_id=(value)
    self.metadata = (metadata || {}).merge("staging_file_id" => value)
  end

  def jobs_scanned
    metadata&.dig("jobs_scanned") || []
  end

  def add_scanned_job!(job_name)
    current = jobs_scanned
    current << job_name
    self.metadata = (metadata || {}).merge("jobs_scanned" => current)
    save!
  end

  def files_found_count
    metadata&.dig("files_found") || 0
  end

  def increment_files_found!(count = 1)
    current = files_found_count
    self.metadata = (metadata || {}).merge("files_found" => current + count)
    save!
  end

  # ============================================================================
  # Query Methods
  # ============================================================================

  def in_progress?
    %w[pending processing].include?(status)
  end

  def progress_percent
    return 0 if total_items.nil? || total_items.zero?
    return 100 if status == "completed"

    ((processed_items.to_f / total_items) * 100).round
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
  # Display Helpers
  # ============================================================================

  def operation_title
    case operation_type
    when "plan_upload" then "Uploading Plan Set"
    when "plan_reextract" then "Re-extracting Plans"
    when "folder_scan" then "Scanning Folders"
    when "folder_process" then "Processing Scanned Files"
    else "Processing"
    end
  end

  def items_label
    case operation_type
    when "plan_upload" then "pages"
    when "plan_reextract" then "plans"
    when "folder_scan" then "jobs"
    when "folder_process" then "files"
    else "items"
    end
  end

  def completed_items_label
    case operation_type
    when "plan_upload" then "Plans Created"
    when "plan_reextract" then "Plans Updated"
    when "folder_scan" then "Files Found"
    when "folder_process" then "Plans Created"
    else "Items Completed"
    end
  end

  # ============================================================================
  # Serialization
  # ============================================================================

  def as_json_status
    {
      id: id,
      job_id: job_id,
      operation_type: operation_type,
      operation_title: operation_title,
      status: status,
      current_step: current_step,
      progress_percent: progress_percent,
      total_items: total_items,
      processed_items: processed_items,
      items_label: items_label,
      current_item_name: current_item_name,
      items_completed: items_completed || [],
      items_count: (items_completed || []).length,
      completed_items_label: completed_items_label,
      operation_errors: operation_errors || [],
      error_message: error_message,
      duration: formatted_duration,
      metadata: metadata,
      started_at: started_at&.iso8601,
      completed_at: completed_at&.iso8601,
      created_at: created_at&.iso8601
    }
  end

  private

  def step_message_for_start
    case operation_type
    when "plan_upload" then "Starting upload..."
    when "plan_reextract" then "Starting re-extraction..."
    when "folder_scan" then "Scanning SharePoint folders..."
    when "folder_process" then "Processing scanned files..."
    else "Starting..."
    end
  end

  def step_message_for_progress(processed)
    next_item = processed + 1
    case operation_type
    when "plan_upload" then "Uploading page #{next_item} of #{total_items}..."
    when "plan_reextract" then "Processing #{next_item} of #{total_items}..."
    when "folder_scan" then "Scanning job #{next_item} of #{total_items}..."
    when "folder_process" then "Processing file #{next_item} of #{total_items}..."
    else "Processing #{next_item} of #{total_items}..."
    end
  end
end
