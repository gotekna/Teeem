# frozen_string_literal: true

# EmailMigration - Track migration job from O365 to PolarisMail
#
# Handles the actual migration of email content from Office 365
# to PolarisMail, tracking progress and handling errors.
#
# Usage:
#   migration = subscription.email_migrations.create!(
#     email_mailbox: mailbox,
#     migration_type: "full_mailbox",
#     source_email: "user@company.onmicrosoft.com"
#   )
#   migration.start!
#
class EmailMigration < ApplicationRecord
  belongs_to :email_subscription
  belongs_to :email_mailbox, optional: true
  belongs_to :initiated_by, class_name: "User", optional: true
  belongs_to :microsoft_credential, optional: true

  # Constants
  MIGRATION_TYPES = %w[full_mailbox emails_only calendar_only contacts_only].freeze
  STATUSES = %w[pending queued in_progress paused completed failed cancelled].freeze

  # Validations
  validates :migration_type, inclusion: { in: MIGRATION_TYPES }
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :pending, -> { where(status: %w[pending queued]) }
  scope :in_progress, -> { where(status: "in_progress") }
  scope :active, -> { where(status: %w[queued in_progress paused]) }
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :recent, -> { order(created_at: :desc) }
  scope :self_service, -> { where(is_self_service: true) }
  scope :staff_assisted, -> { where(is_self_service: false) }

  # Callbacks
  before_validation :set_defaults, on: :create

  # Progress tracking
  def progress_percentage
    return 0 if total_items.zero?
    (processed_items.to_f / total_items * 100).round(1)
  end

  def bytes_progress_percentage
    return 0 if total_bytes.zero?
    (processed_bytes.to_f / total_bytes * 100).round(1)
  end

  # State transitions
  def start!
    update!(status: "in_progress", started_at: Time.current)
    EmailMigrationJob.perform_later(id)
  end

  def queue!
    update!(status: "queued")
  end

  def pause!
    update!(status: "paused")
  end

  def resume!
    update!(status: "in_progress")
    EmailMigrationJob.perform_later(id)
  end

  def complete!
    update!(status: "completed", completed_at: Time.current)
    notify_completion
  end

  def fail!(error_message)
    update!(
      status: "failed",
      error_message: error_message[0..500],
      failed_at: Time.current
    )
    notify_failure
  end

  def cancel!
    update!(status: "cancelled")
  end

  # Status helpers
  def in_progress?
    status == "in_progress"
  end

  def completed?
    status == "completed"
  end

  def failed?
    status == "failed"
  end

  def can_resume?
    status.in?(%w[paused failed])
  end

  # Log progress update
  def log_progress(message, data = {})
    log_entry = {
      timestamp: Time.current.iso8601,
      message: message,
      **data
    }
    update!(migration_log: migration_log.merge(log_entry[:timestamp] => log_entry))
  end

  # Duration calculation
  def duration_minutes
    return nil unless started_at
    end_time = completed_at || failed_at || Time.current
    ((end_time - started_at) / 60).round(1)
  end

  private

  def set_defaults
    self.status ||= "pending"
    self.total_items ||= 0
    self.processed_items ||= 0
    self.failed_items ||= 0
    self.total_bytes ||= 0
    self.processed_bytes ||= 0
  end

  def notify_completion
    # TODO: Send notification email to contact
    Rails.logger.info "[EmailMigration] Migration #{id} completed successfully"
  end

  def notify_failure
    # TODO: Send notification email to admin
    Rails.logger.error "[EmailMigration] Migration #{id} failed: #{error_message}"
  end
end
