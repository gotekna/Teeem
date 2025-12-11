# frozen_string_literal: true

class XeroSyncEvent < ApplicationRecord
  belongs_to :xero_credential, optional: true

  # Sync types
  SYNC_TYPES = %w[
    invoices
    contacts
    bank_transactions
    attachments
    payments
    quotes
    credit_notes
    token_refresh
    health_check
  ].freeze

  # Event types
  EVENT_TYPES = %w[
    started
    completed
    failed
    skipped
    webhook_received
    partial
  ].freeze

  # Trigger sources
  TRIGGERS = %w[
    scheduled
    webhook
    manual
    retry
    health_check
    startup
  ].freeze

  validates :sync_type, presence: true, inclusion: { in: SYNC_TYPES }
  validates :event_type, presence: true, inclusion: { in: EVENT_TYPES }
  validates :trigger, presence: true, inclusion: { in: TRIGGERS }

  # Scopes
  scope :for_credential, ->(credential_id) { where(xero_credential_id: credential_id) }
  scope :for_sync_type, ->(type) { where(sync_type: type) }
  scope :completed, -> { where(event_type: "completed") }
  scope :failed, -> { where(event_type: "failed") }
  scope :recent, -> { order(created_at: :desc) }
  scope :today, -> { where("created_at >= ?", Time.current.beginning_of_day) }
  scope :last_24_hours, -> { where("created_at >= ?", 24.hours.ago) }
  scope :last_week, -> { where("created_at >= ?", 1.week.ago) }

  # Start a new sync event
  def self.start!(credential:, sync_type:, trigger:, metadata: {})
    create!(
      xero_credential: credential,
      sync_type: sync_type,
      event_type: "started",
      trigger: trigger,
      started_at: Time.current,
      metadata: metadata
    )
  end

  # Mark event as completed
  def complete!(records_processed: 0, records_created: 0, records_updated: 0, records_skipped: 0)
    update!(
      event_type: "completed",
      completed_at: Time.current,
      duration_ms: calculate_duration,
      records_processed: records_processed,
      records_created: records_created,
      records_updated: records_updated,
      records_skipped: records_skipped
    )
  end

  # Mark event as failed
  def fail!(error:, error_class: nil, records_processed: 0, records_failed: 0)
    update!(
      event_type: "failed",
      completed_at: Time.current,
      duration_ms: calculate_duration,
      error_message: error.to_s.truncate(1000),
      error_class: error_class || error.class.name,
      records_processed: records_processed,
      records_failed: records_failed
    )
  end

  # Mark event as skipped
  def skip!(reason:)
    update!(
      event_type: "skipped",
      completed_at: Time.current,
      duration_ms: calculate_duration,
      error_message: reason
    )
  end

  # Check if event succeeded
  def success?
    event_type == "completed"
  end

  # Check if event failed
  def failed?
    event_type == "failed"
  end

  # Get total records affected
  def total_records_affected
    records_created + records_updated
  end

  # Calculate duration in milliseconds
  def calculate_duration
    return nil unless started_at
    ((Time.current - started_at) * 1000).to_i
  end

  # Get human-readable duration
  def duration_human
    return "N/A" unless duration_ms
    if duration_ms < 1000
      "#{duration_ms}ms"
    elsif duration_ms < 60_000
      "#{(duration_ms / 1000.0).round(1)}s"
    else
      "#{(duration_ms / 60_000.0).round(1)}min"
    end
  end

  # Get the last successful sync event for a type
  def self.last_successful(sync_type:, credential: nil)
    scope = completed.for_sync_type(sync_type)
    scope = scope.for_credential(credential.id) if credential
    scope.recent.first
  end

  # Get the last sync event (regardless of status) for a type
  def self.last_sync(sync_type:, credential: nil)
    scope = for_sync_type(sync_type)
    scope = scope.for_credential(credential.id) if credential
    scope.recent.first
  end

  # Summary statistics for a credential
  def self.summary_for_credential(credential_id, period: 24.hours)
    events = for_credential(credential_id).where("created_at >= ?", period.ago)

    {
      total: events.count,
      completed: events.completed.count,
      failed: events.failed.count,
      by_type: events.group(:sync_type).count,
      total_records_synced: events.completed.sum(:records_processed),
      average_duration_ms: events.completed.average(:duration_ms)&.to_i
    }
  end

  # Get sync health status for a type
  def self.health_for_type(sync_type:, credential: nil, expected_interval: 30.minutes)
    last_event = last_sync(sync_type: sync_type, credential: credential)

    if last_event.nil?
      { status: :never_run, last_run: nil, message: "Never synced" }
    elsif last_event.failed?
      { status: :failed, last_run: last_event.completed_at, message: last_event.error_message }
    elsif last_event.completed_at && last_event.completed_at < expected_interval.ago
      { status: :stale, last_run: last_event.completed_at, message: "Sync is overdue" }
    else
      { status: :healthy, last_run: last_event.completed_at, message: "OK" }
    end
  end
end
