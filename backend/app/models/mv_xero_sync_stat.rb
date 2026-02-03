# frozen_string_literal: true

# Model for mv_xero_sync_stats materialized view
#
# This view pre-computes Xero sync statistics for instant queries.
# Refreshed every 5 minutes by RefreshXeroStatsMvJob.
#
# Usage:
#   MvXeroSyncStat.for_tenant(tenant_id)
#   MvXeroSyncStat.all.order(:tenant_name)
#
# Part of "Scale Xero Sync to 15k" plan (Phase 4)
class MvXeroSyncStat < ApplicationRecord
  self.table_name = "mv_xero_sync_stats"
  self.primary_key = "xero_org_id"

  # This is a read-only view
  def readonly?
    true
  end

  # Scopes
  scope :for_tenant, ->(tenant_id) {
    tenant_id ? where(teeem_tenant_id: tenant_id) : all
  }

  scope :for_xero_org, ->(xero_org_id) {
    where(xero_org_id: xero_org_id)
  }

  scope :primary_only, -> { where(is_primary: true) }
  scope :connected, -> { where(status: "connected") }

  # Class methods
  class << self
    # Refresh the materialized view
    # Uses CONCURRENTLY to avoid locking (requires unique index)
    def refresh!
      start = Time.current
      ActiveRecord::Base.connection.execute(
        "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_xero_sync_stats"
      )
      elapsed = (Time.current - start).round(2)
      Rails.logger.info("[MvXeroSyncStat] Refreshed in #{elapsed}s")
      elapsed
    end

    # Check if MV exists (for feature flag/rollout)
    def available?
      ActiveRecord::Base.connection.table_exists?("mv_xero_sync_stats")
    rescue StandardError
      false
    end

    # Get freshness of the view
    def refreshed_at
      first&.refreshed_at
    end

    # Check if view is stale (older than threshold)
    def stale?(threshold: 10.minutes)
      ts = refreshed_at
      return true unless ts
      Time.current - ts > threshold
    end
  end

  # Instance methods

  # Convert to stats hash matching XeroSyncStatsService format
  def to_stats_hash
    {
      tenant_id: xero_org_id,
      tenant_name: tenant_name,
      status: status,
      is_primary: is_primary,
      contacts: {
        total_links: total_links,
        sync_enabled: enabled_count,
        pending_review: pending_review,
        with_errors: with_errors,
        unlinked: unlinked_count,
        cross_tenant_matches: cross_tenant_count,
        last_synced_at: last_contact_sync
      },
      documents: {
        invoices: invoices,
        bills: bills,
        quotes: quotes,
        credit_notes: credit_notes,
        total: total_documents,
        last_synced_at: last_invoice_sync
      },
      match_breakdown: {
        exact_abn: match_exact_abn,
        exact_email: match_exact_email,
        fuzzy_name: match_fuzzy_name,
        manual: match_manual
      }
    }
  end
end
