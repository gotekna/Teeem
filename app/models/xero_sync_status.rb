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

      result = {}
      SYNC_TYPES.each do |sync_type|
        status = statuses.find { |s| s.sync_type == sync_type }
        result[sync_type] = if status
          {
            status: status.status,
            last_synced_at: status.last_synced_at&.iso8601,
            next_sync_at: status.next_sync_at&.iso8601,
            records_synced: status.records_synced,
            last_error: status.last_error
          }
        else
          {
            status: nil,
            last_synced_at: nil,
            next_sync_at: nil,
            records_synced: nil,
            last_error: nil
          }
        end
      end

      # Calculate overall status
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
        last_activity_at: last_activity,
        sync_types: result
      }
    end
  end
end
