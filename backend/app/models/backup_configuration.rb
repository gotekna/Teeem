# frozen_string_literal: true

# BackupConfiguration - Per-tenant backup settings
#
# Each tenant can configure their own backup schedule, storage providers,
# and retention policies. This is the SSoT for all backup configuration.
#
# Schedule Presets:
#   disabled     - Backups disabled
#   hourly       - Every hour
#   every_6h     - Every 6 hours
#   every_12h    - Every 12 hours (12am, 12pm)
#   daily_2am    - Daily at 2am
#   daily_6am    - Daily at 6am
#   weekly_sunday - Weekly on Sunday at 3am
#
# Storage Strategy:
#   primary_credential   - Primary storage (e.g., Wasabi)
#   secondary_credential - Mirror storage (e.g., Backblaze) - optional
#   mirror_enabled       - If true, backups are copied to secondary after primary
#
class BackupConfiguration < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :tenant
  belongs_to :primary_credential, class_name: "S3CompatibleCredential", optional: true
  belongs_to :secondary_credential, class_name: "S3CompatibleCredential", optional: true

  has_many :backup_logs, dependent: :destroy

  # Schedule presets with human-readable labels and cron expressions
  SCHEDULE_PRESETS = {
    "disabled" => { label: "Disabled", cron: nil },
    "hourly" => { label: "Every hour", cron: "0 * * * *" },
    "every_6h" => { label: "Every 6 hours", cron: "0 */6 * * *" },
    "every_12h" => { label: "Every 12 hours", cron: "0 0,12 * * *" },
    "daily_2am" => { label: "Daily at 2am", cron: "0 2 * * *" },
    "daily_6am" => { label: "Daily at 6am", cron: "0 6 * * *" },
    "weekly_sunday" => { label: "Weekly (Sunday 3am)", cron: "0 3 * * 0" }
  }.freeze

  # Validations
  validates :database_schedule, inclusion: { in: SCHEDULE_PRESETS.keys }
  validates :document_schedule, inclusion: { in: SCHEDULE_PRESETS.keys }
  validates :retention_days, numericality: { greater_than: 0, less_than_or_equal_to: 365 }
  validates :tenant_id, uniqueness: true

  # Validate that mirror requires both credentials
  validate :mirror_requires_secondary_credential

  # Get or create configuration for current tenant
  # @return [BackupConfiguration, nil] Returns nil if no tenant context
  def self.for_tenant
    tenant = ActsAsTenant.current_tenant
    return nil unless tenant

    find_or_create_by!(tenant: tenant)
  end

  # Check if database backups are enabled
  def database_backups_enabled?
    enabled? && database_schedule != "disabled"
  end

  # Check if document backups are enabled
  def document_backups_enabled?
    enabled? && document_schedule != "disabled"
  end

  # Get cron expression for database backups
  def database_cron
    SCHEDULE_PRESETS.dig(database_schedule, :cron)
  end

  # Get cron expression for document backups
  def document_cron
    SCHEDULE_PRESETS.dig(document_schedule, :cron)
  end

  # Get human-readable label for database schedule
  def database_schedule_label
    SCHEDULE_PRESETS.dig(database_schedule, :label)
  end

  # Get human-readable label for document schedule
  def document_schedule_label
    SCHEDULE_PRESETS.dig(document_schedule, :label)
  end

  # Check if a backup is due based on schedule and last run time
  # @param type [Symbol] :database or :documents
  # @return [Boolean]
  def backup_due?(type)
    return false unless enabled?

    case type
    when :database
      return false if database_schedule == "disabled"
      check_schedule_due(database_schedule, last_database_backup_at)
    when :documents
      return false if document_schedule == "disabled"
      check_schedule_due(document_schedule, last_document_backup_at)
    else
      false
    end
  end

  # Record a completed backup
  # @param type [Symbol] :database or :documents
  def record_backup_completed!(type)
    case type
    when :database
      update!(last_database_backup_at: Time.current)
    when :documents
      update!(last_document_backup_at: Time.current)
    when :mirror
      update!(last_mirror_sync_at: Time.current)
    end
  end

  # Get recent backup logs
  # @param limit [Integer] Number of logs to return
  # @return [ActiveRecord::Relation]
  def recent_logs(limit: 20)
    backup_logs.order(created_at: :desc).limit(limit)
  end

  # Get next scheduled backup time for a type
  # @param type [Symbol] :database or :documents
  # @return [Time, nil]
  def next_scheduled_backup(type)
    schedule = type == :database ? database_schedule : document_schedule
    return nil if schedule == "disabled"

    cron = SCHEDULE_PRESETS.dig(schedule, :cron)
    return nil unless cron

    Fugit::Cron.parse(cron)&.next_time&.to_t
  rescue
    nil
  end

  private

  def mirror_requires_secondary_credential
    if mirror_enabled? && secondary_credential_id.blank?
      errors.add(:secondary_credential, "is required when mirror is enabled")
    end
  end

  def check_schedule_due(schedule, last_run_at)
    return true if last_run_at.nil?

    cron = SCHEDULE_PRESETS.dig(schedule, :cron)
    return false unless cron

    # Use Fugit to parse cron and check if it's time
    parsed = Fugit::Cron.parse(cron)
    return false unless parsed

    # Get the last scheduled time before now
    last_scheduled = parsed.previous_time(Time.current).to_t

    # If last run was before the last scheduled time, it's due
    last_run_at < last_scheduled
  rescue
    false
  end
end
