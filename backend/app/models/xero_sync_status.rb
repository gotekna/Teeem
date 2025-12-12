# frozen_string_literal: true

# SSoT for Xero sync timestamps across all sync types.
# This table centralizes "when was Xero data last synced" for:
# - invoices (ExternalInvoiceSyncService - every 30 min)
# - contacts (XeroContactSyncService - every 30 min)
# - pdfs (XeroAttachmentSyncService - every 2 hours)
# - payments (future)
class XeroSyncStatus < ApplicationRecord
  SYNC_TYPES = %w[invoices contacts pdfs payments bank_transactions].freeze
  STATUSES = %w[success failed in_progress].freeze

  validates :sync_type, presence: true, inclusion: { in: SYNC_TYPES }
  validates :status, inclusion: { in: STATUSES }, allow_nil: true

  scope :for_type, ->(type) { where(sync_type: type) }
  scope :for_tenant, ->(tenant_id) { where(tenant_id: tenant_id) }
  scope :successful, -> { where(status: "success") }
  scope :failed, -> { where(status: "failed") }

  class << self
    # Find or initialize a sync status record for a given type and tenant
    def for(sync_type, tenant_id: nil)
      find_or_initialize_by(sync_type: sync_type, tenant_id: tenant_id)
    end

    # Record the start of a sync operation
    def start_sync!(sync_type, tenant_id: nil)
      status = self.for(sync_type, tenant_id: tenant_id)
      status.update!(
        status: "in_progress",
        last_error: nil
      )
      status
    end

    # Record successful completion of a sync
    def complete_sync!(sync_type, tenant_id: nil, records_synced: 0, next_sync_at: nil)
      status = self.for(sync_type, tenant_id: tenant_id)
      status.update!(
        status: "success",
        last_synced_at: Time.current,
        records_synced: records_synced,
        next_sync_at: next_sync_at,
        last_error: nil
      )
      status
    end

    # Record a failed sync
    def fail_sync!(sync_type, tenant_id: nil, error:)
      status = self.for(sync_type, tenant_id: tenant_id)
      status.update!(
        status: "failed",
        last_error: error.to_s.truncate(1000)
      )
      status
    end

    # Get health summary for all sync types
    def health_summary(tenant_id: nil)
      statuses = tenant_id ? for_tenant(tenant_id) : all

      STALE_THRESHOLD = 5.minutes
      CRITICAL_THRESHOLD = 10.minutes

      result = {}
      health_statuses = []

      SYNC_TYPES.each do |sync_type|
        status = statuses.find { |s| s.sync_type == sync_type }

        if status
          # Calculate freshness
          last_synced = status.last_synced_at
          age_seconds = last_synced ? (Time.current - last_synced).to_i : nil
          age_minutes = age_seconds ? (age_seconds / 60.0).round(1) : nil

          # Determine health status: green (< 5 min), yellow (5-10 min), red (> 10 min)
          health_status = if age_seconds.nil?
            "red"
          elsif age_seconds <= STALE_THRESHOLD
            "green"
          elsif age_seconds <= CRITICAL_THRESHOLD
            "yellow"
          else
            "red"
          end

          is_stale = age_seconds.nil? || age_seconds > STALE_THRESHOLD

          health_statuses << health_status

          result[sync_type] = {
            status: status.status,
            health_status: health_status,  # SSoT: red/yellow/green freshness
            stale: is_stale,
            last_synced_at: status.last_synced_at&.iso8601,
            age_seconds: age_seconds,
            age_minutes: age_minutes,
            next_sync_at: status.next_sync_at&.iso8601,
            records_synced: status.records_synced,
            last_error: status.last_error,
            message: is_stale ? "Sync stale: #{age_minutes || '∞'} min ago" : "Healthy"
          }
        else
          health_statuses << "red"
          result[sync_type] = {
            status: nil,
            health_status: "red",
            stale: true,
            last_synced_at: nil,
            age_seconds: nil,
            age_minutes: nil,
            next_sync_at: nil,
            records_synced: nil,
            last_error: nil,
            message: "No sync status record found"
          }
        end
      end

      # Calculate overall health status (prioritize worst status)
      overall_health = if health_statuses.include?("red")
        "red"
      elsif health_statuses.include?("yellow")
        "yellow"
      else
        "green"
      end

      # Calculate overall status (original logic for backwards compatibility)
      all_statuses = result.values.map { |v| v[:status] }.compact
      overall_status = if all_statuses.empty?
        "unknown"
      elsif all_statuses.include?("failed")
        "unhealthy"
      elsif all_statuses.include?("in_progress")
        "syncing"
      elsif all_statuses.all? { |s| s == "success" }
        "healthy"
      else
        "partial"
      end

      # Most recent activity
      last_activity = result.values.map { |v| v[:last_synced_at] }.compact.max

      {
        overall_status: overall_status,
        overall_health: overall_health,  # SSoT: red/yellow/green system health
        last_activity_at: last_activity,
        sync_types: result
      }
    end
  end
end
