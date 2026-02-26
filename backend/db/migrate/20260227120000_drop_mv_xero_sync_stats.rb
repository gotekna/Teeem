# frozen_string_literal: true

# Drop the mv_xero_sync_stats materialized view.
#
# Context: RefreshXeroStatsCacheJob (Phase 3) and RefreshXeroStatsMvJob (Phase 4)
# have been removed. The endpoint uses Rails.cache.fetch + XeroSyncStatsService
# directly. QueueStatusCacheJob now uses ContactExternalLink.xero.pending_review.count
# instead of the MV. Zero consumers remain.
class DropMvXeroSyncStats < ActiveRecord::Migration[7.2]
  def up
    execute <<~SQL
      DROP MATERIALIZED VIEW IF EXISTS mv_xero_sync_stats;
    SQL
  end

  def down
    # Recreate the materialized view (matches original 20260203120001 migration)
    execute <<~SQL
      CREATE MATERIALIZED VIEW mv_xero_sync_stats AS
      SELECT
        xc.xero_org_id,
        xc.tenant_name,
        xc.status,
        xc.is_primary,
        xc.teeem_tenant_id,
        -- Contact link stats
        COUNT(cel.id) AS total_links,
        COUNT(cel.id) FILTER (WHERE cel.sync_enabled = true) AS enabled_count,
        COUNT(cel.id) FILTER (WHERE cel.needs_review = true) AS pending_review,
        COUNT(cel.id) FILTER (WHERE cel.sync_error IS NOT NULL) AS with_errors,
        -- Match type breakdown
        COUNT(cel.id) FILTER (WHERE cel.match_type = 'exact_abn') AS match_exact_abn,
        COUNT(cel.id) FILTER (WHERE cel.match_type = 'exact_email') AS match_exact_email,
        COUNT(cel.id) FILTER (WHERE cel.match_type = 'fuzzy_name') AS match_fuzzy_name,
        COUNT(cel.id) FILTER (WHERE cel.match_type = 'manual') AS match_manual,
        -- Unlinked count (Xero contacts without TEEEM link)
        0 AS unlinked_count,
        -- Cross-tenant matches
        0 AS cross_tenant_count,
        -- Document stats
        COUNT(ei.id) FILTER (WHERE ei.invoice_type = 'ACCREC') AS invoices,
        COUNT(ei.id) FILTER (WHERE ei.invoice_type = 'ACCPAY') AS bills,
        COUNT(ei.id) FILTER (WHERE ei.invoice_type = 'QUOTE') AS quotes,
        COUNT(ei.id) FILTER (WHERE ei.invoice_type = 'CREDIT_NOTE') AS credit_notes,
        COUNT(ei.id) AS total_documents,
        -- Timestamps
        MAX(cel.last_synced_at) AS last_contact_sync,
        MAX(ei.updated_at) AS last_invoice_sync,
        NOW() AS refreshed_at
      FROM xero_credentials xc
      LEFT JOIN contact_external_links cel ON cel.xero_org_id = xc.xero_org_id AND cel.source = 'xero'
      LEFT JOIN external_invoices ei ON ei.xero_org_id = xc.xero_org_id
      GROUP BY xc.xero_org_id, xc.tenant_name, xc.status, xc.is_primary, xc.teeem_tenant_id
      WITH DATA;
    SQL

    add_index :mv_xero_sync_stats, :xero_org_id, unique: true
    add_index :mv_xero_sync_stats, :teeem_tenant_id
  end
end
