# frozen_string_literal: true

# BackgroundJobProgress - SSoT for tracking long-running background job progress
#
# This model tracks progress for jobs like:
# - folder_reorganization: Moving files when folder templates change
# - document_migration: Migrating documents between storage providers
# - batch_processing: Bulk document operations
#
# Usage:
#   # Create progress tracker
#   progress = BackgroundJobProgress.start(
#     job_type: "folder_reorganization",
#     scope: "corporate",
#     total_items: 150,
#     metadata: { old_template: "...", new_template: "..." }
#   )
#
#   # Update progress
#   progress.increment!
#   progress.increment!(success: true)
#   progress.increment!(success: false, error: "File not found")
#
#   # Complete job
#   progress.complete!
#   progress.fail!(message: "Connection lost")
#
class BackgroundJobProgress < ApplicationRecord
  # Status constants
  STATUSES = %w[pending running completed failed].freeze

  # Validations
  validates :job_type, presence: true
  validates :job_id, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :running, -> { where(status: "running") }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :active, -> { where(status: %w[pending running]) }
  scope :for_type, ->(type) { where(job_type: type) }
  scope :for_scope, ->(scope) { where(scope: scope) }
  scope :recent, -> { order(created_at: :desc) }

  # ========================================
  # Class Methods
  # ========================================

  # Start tracking a new job
  def self.start(job_type:, scope: nil, total_items: 0, metadata: {})
    create!(
      job_type: job_type,
      job_id: SecureRandom.uuid,
      scope: scope,
      status: "running",
      total_items: total_items,
      processed_items: 0,
      success_count: 0,
      error_count: 0,
      errors: [],
      metadata: metadata,
      started_at: Time.current
    )
  end

  # Find active jobs for a type/scope
  def self.active_for(job_type:, scope: nil)
    query = for_type(job_type).active
    query = query.for_scope(scope) if scope.present?
    query.recent.first
  end

  # Find recent jobs for a type/scope (including completed)
  def self.recent_for(job_type:, scope: nil, limit: 5)
    query = for_type(job_type)
    query = query.for_scope(scope) if scope.present?
    query.recent.limit(limit)
  end

  # ========================================
  # Instance Methods
  # ========================================

  # Progress percentage (0-100)
  def progress_percent
    return 0 if total_items.zero?
    [(processed_items.to_f / total_items * 100).round, 100].min
  end

  # Check if job is active
  def active?
    status.in?(%w[pending running])
  end

  # Check if job is done (success or failure)
  def done?
    status.in?(%w[completed failed])
  end

  # Time elapsed since job started
  def elapsed_time
    return nil unless started_at
    end_time = completed_at || Time.current
    end_time - started_at
  end

  # Formatted elapsed time
  def elapsed_time_formatted
    seconds = elapsed_time.to_i
    return nil if seconds.nil?

    if seconds < 60
      "#{seconds}s"
    elsif seconds < 3600
      "#{seconds / 60}m #{seconds % 60}s"
    else
      "#{seconds / 3600}h #{(seconds % 3600) / 60}m"
    end
  end

  # Estimated time remaining
  def estimated_remaining
    return nil unless started_at && processed_items.positive? && total_items.positive?

    elapsed = elapsed_time
    rate = processed_items.to_f / elapsed
    remaining_items = total_items - processed_items

    return nil if rate.zero?
    (remaining_items / rate).round
  end

  # Increment progress (call after processing each item)
  def increment!(success: true, error: nil, current_item: nil)
    updates = {
      processed_items: processed_items + 1
    }

    if success
      updates[:success_count] = success_count + 1
    else
      updates[:error_count] = error_count + 1
      if error.present?
        updates[:errors] = (errors || []) + [{ message: error, at: Time.current.iso8601 }]
      end
    end

    updates[:current_item] = current_item if current_item.present?

    update!(updates)
  end

  # Update current processing item (for UI display)
  def processing!(item_name)
    update!(current_item: item_name)
  end

  # Set total items (if not known at start)
  def set_total!(count)
    update!(total_items: count)
  end

  # Mark job as completed
  def complete!(message: nil)
    update!(
      status: "completed",
      message: message || "Completed successfully",
      completed_at: Time.current,
      current_item: nil
    )
  end

  # Mark job as failed
  def fail!(message: "Job failed")
    update!(
      status: "failed",
      message: message,
      completed_at: Time.current,
      current_item: nil
    )
  end

  # JSON representation for API
  def as_json(options = {})
    {
      id: id,
      job_type: job_type,
      job_id: job_id,
      scope: scope,
      status: status,
      total_items: total_items,
      processed_items: processed_items,
      success_count: success_count,
      error_count: error_count,
      progress_percent: progress_percent,
      current_item: current_item,
      message: message,
      errors: errors&.last(5),  # Only return last 5 errors
      metadata: metadata,
      started_at: started_at&.iso8601,
      completed_at: completed_at&.iso8601,
      elapsed_time: elapsed_time_formatted,
      estimated_remaining: estimated_remaining
    }
  end
end
