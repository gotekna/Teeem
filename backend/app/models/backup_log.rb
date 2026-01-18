# frozen_string_literal: true

# BackupLog - Tracks backup history for each tenant
#
# Each backup operation creates a log entry tracking:
#   - Type: database, documents, or mirror
#   - Status: started, completed, failed
#   - Size, duration, file count
#   - Storage location and provider
#   - Error messages for failures
#
class BackupLog < ApplicationRecord
  acts_as_tenant :organization, through: :backup_configuration

  belongs_to :backup_configuration

  # Backup types
  BACKUP_TYPES = %w[database documents mirror].freeze

  # Status values
  STATUSES = %w[started completed failed].freeze

  # Validations
  validates :backup_type, inclusion: { in: BACKUP_TYPES }
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :completed, -> { where(status: "completed") }
  scope :failed, -> { where(status: "failed") }
  scope :recent, -> { order(created_at: :desc) }
  scope :by_type, ->(type) { where(backup_type: type) }

  # Create a log entry for a started backup
  # @param config [BackupConfiguration]
  # @param type [String] "database", "documents", or "mirror"
  # @param provider [String] Provider name (e.g., "wasabi", "backblaze")
  # @return [BackupLog]
  def self.start!(config, type:, provider:)
    create!(
      backup_configuration: config,
      backup_type: type,
      status: "started",
      provider_name: provider
    )
  end

  # Mark backup as completed
  # @param size_bytes [Integer] Size of backup in bytes
  # @param duration_seconds [Integer] Duration of backup
  # @param storage_key [String] Path in storage
  # @param files_count [Integer] Number of files (for document backups)
  # @param metadata [Hash] Additional metadata
  def complete!(size_bytes:, duration_seconds:, storage_key: nil, files_count: nil, metadata: {})
    update!(
      status: "completed",
      size_bytes: size_bytes,
      duration_seconds: duration_seconds,
      storage_key: storage_key,
      files_count: files_count,
      metadata: self.metadata.merge(metadata)
    )
  end

  # Mark backup as failed
  # @param error_message [String] Error description
  # @param duration_seconds [Integer] Duration before failure
  def fail!(error_message:, duration_seconds: nil)
    update!(
      status: "failed",
      error_message: error_message,
      duration_seconds: duration_seconds
    )
  end

  # Human-readable size
  def size_display
    return nil unless size_bytes

    if size_bytes >= 1_073_741_824
      "#{(size_bytes / 1_073_741_824.0).round(2)} GB"
    elsif size_bytes >= 1_048_576
      "#{(size_bytes / 1_048_576.0).round(1)} MB"
    elsif size_bytes >= 1024
      "#{(size_bytes / 1024.0).round(1)} KB"
    else
      "#{size_bytes} bytes"
    end
  end

  # Human-readable duration
  def duration_display
    return nil unless duration_seconds

    if duration_seconds >= 3600
      "#{(duration_seconds / 3600.0).round(1)}h"
    elsif duration_seconds >= 60
      "#{(duration_seconds / 60.0).round(1)}m"
    else
      "#{duration_seconds}s"
    end
  end

  # Check if this is a successful backup
  def success?
    status == "completed"
  end

  # Check if this is a failed backup
  def failure?
    status == "failed"
  end

  # Check if backup is still running
  def running?
    status == "started"
  end
end
