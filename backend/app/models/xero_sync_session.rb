# frozen_string_literal: true

# XeroSyncSession: Progress tracking for ultra-scale batch sync
#
# Part of the Ultra-Scale Xero Sync Architecture (Feb 2026)
# Enables visibility into long-running sync operations across 15-20K contacts.
#
# Lifecycle:
#   pending -> fetching -> processing -> completed/failed
#
# Usage:
#   session = XeroSyncSession.start!(tenant_id, teeem_tenant_id: ..., sync_mode: :incremental)
#   session.increment_fetched!(100)
#   session.increment_processed!(created: 10, updated: 85, skipped: 5)
#   session.complete!
#
class XeroSyncSession < ApplicationRecord
  # Associations
  belongs_to :teeem_tenant, class_name: 'Tenant', optional: true

  # Validations
  SYNC_TYPES = %w[contacts invoices].freeze
  STATUSES = %w[pending fetching processing completed failed].freeze
  SYNC_MODES = %w[full incremental].freeze

  validates :tenant_id, presence: true
  validates :sync_type, presence: true, inclusion: { in: SYNC_TYPES }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :sync_mode, inclusion: { in: SYNC_MODES }, allow_nil: true

  # Scopes
  scope :for_tenant, ->(tenant_id) { where(tenant_id: tenant_id) }
  scope :for_teeem_tenant, ->(teeem_tenant) { where(teeem_tenant_id: teeem_tenant.is_a?(Tenant) ? teeem_tenant.id : teeem_tenant) }
  scope :contacts, -> { where(sync_type: 'contacts') }
  scope :active, -> { where(status: %w[pending fetching processing]) }
  scope :completed, -> { where(status: 'completed') }
  scope :failed, -> { where(status: 'failed') }
  scope :recent, -> { order(created_at: :desc) }

  # ========================================
  # Factory Methods
  # ========================================

  # Start a new sync session
  # @param tenant_id [String] Xero org UUID
  # @param options [Hash]
  #   - teeem_tenant_id: TEEEM tenant ID for multi-tenancy
  #   - sync_type: 'contacts' (default) or 'invoices'
  #   - sync_mode: 'full' or 'incremental'
  #   - modified_since: DateTime for incremental sync
  def self.start!(tenant_id, options = {})
    # Cancel any active sessions for this tenant/type to prevent duplicates
    active.for_tenant(tenant_id).where(sync_type: options[:sync_type] || 'contacts').update_all(
      status: 'failed',
      error_message: 'Cancelled: new session started'
    )

    create!(
      tenant_id: tenant_id,
      teeem_tenant_id: options[:teeem_tenant_id],
      sync_type: options[:sync_type] || 'contacts',
      sync_mode: options[:sync_mode] || 'full',
      modified_since: options[:modified_since],
      status: 'fetching',
      started_at: Time.current
    )
  end

  # Find the most recent session for a tenant
  def self.latest_for(tenant_id, sync_type: 'contacts')
    for_tenant(tenant_id).where(sync_type: sync_type).recent.first
  end

  # Find the most recent successful session for incremental sync
  def self.last_successful_for(tenant_id, sync_type: 'contacts')
    for_tenant(tenant_id)
      .where(sync_type: sync_type, status: 'completed')
      .recent.first
  end

  # ========================================
  # Progress Tracking
  # ========================================

  # Update total after first page gives us an estimate
  def set_total!(count)
    update!(total_records: count)
  end

  # Increment fetched count (called after each batch fetch)
  def increment_fetched!(count, page: nil)
    with_lock do
      increment!(:fetched_count, count)
      update!(last_page_fetched: page) if page
    end
  end

  # Increment processed counts (called after each batch process)
  def increment_processed!(created: 0, updated: 0, skipped: 0, errors: 0)
    with_lock do
      increment!(:processed_count, created + updated + skipped)
      increment!(:created_count, created)
      increment!(:updated_count, updated)
      increment!(:skipped_count, skipped)
      increment!(:error_count, errors)
    end
  end

  # Save checkpoint data for resumability
  def checkpoint!(data)
    update!(checkpoint_data: checkpoint_data.merge(data))
  end

  # ========================================
  # Status Transitions
  # ========================================

  # Transition from fetching to processing (all data fetched)
  def start_processing!
    update!(status: 'processing', total_records: fetched_count)
  end

  # Mark session as complete
  def complete!
    update!(
      status: 'completed',
      completed_at: Time.current,
      duration_seconds: calculate_duration
    )

    # Also update XeroSyncStatus (SSoT for health dashboard)
    XeroSyncStatus.complete_sync!(
      sync_type,
      tenant_id: tenant_id,
      records_synced: processed_count
    )
  end

  # Mark session as failed
  def fail!(error_message)
    update!(
      status: 'failed',
      error_message: error_message.to_s.truncate(1000),
      completed_at: Time.current,
      duration_seconds: calculate_duration
    )

    # Also update XeroSyncStatus
    XeroSyncStatus.fail_sync!(
      sync_type,
      tenant_id: tenant_id,
      error: error_message
    )
  end

  # ========================================
  # Status Checks
  # ========================================

  def pending?
    status == 'pending'
  end

  def fetching?
    status == 'fetching'
  end

  def processing?
    status == 'processing'
  end

  def completed?
    status == 'completed'
  end

  def failed?
    status == 'failed'
  end

  def active?
    %w[pending fetching processing].include?(status)
  end

  def finished?
    %w[completed failed].include?(status)
  end

  # ========================================
  # Progress Calculations
  # ========================================

  def progress_percentage
    return 0 if total_records.zero?
    ((processed_count.to_f / total_records) * 100).round(1)
  end

  def estimated_remaining_seconds
    return nil unless started_at && processed_count.positive?
    return 0 if finished?

    elapsed = Time.current - started_at
    rate = processed_count.to_f / elapsed
    return nil if rate.zero?

    remaining = total_records - processed_count
    (remaining / rate).round
  end

  def records_per_second
    return 0 unless duration_seconds&.positive? || (started_at && processed_count.positive?)

    elapsed = duration_seconds || (Time.current - started_at).to_i
    return 0 if elapsed.zero?

    (processed_count.to_f / elapsed).round(2)
  end

  # Human-readable duration
  def duration_human
    seconds = duration_seconds || calculate_duration
    return '< 1s' if seconds < 1

    minutes = seconds / 60
    remaining_seconds = seconds % 60

    if minutes.zero?
      "#{seconds}s"
    elsif minutes < 60
      "#{minutes}m #{remaining_seconds}s"
    else
      hours = minutes / 60
      remaining_minutes = minutes % 60
      "#{hours}h #{remaining_minutes}m"
    end
  end

  # Summary for logging
  def summary
    {
      id: id,
      tenant_id: tenant_id,
      status: status,
      sync_mode: sync_mode,
      progress: "#{processed_count}/#{total_records} (#{progress_percentage}%)",
      created: created_count,
      updated: updated_count,
      skipped: skipped_count,
      errors: error_count,
      duration: duration_human,
      rate: "#{records_per_second}/s"
    }
  end

  private

  def calculate_duration
    return 0 unless started_at
    end_time = completed_at || Time.current
    (end_time - started_at).to_i
  end
end
