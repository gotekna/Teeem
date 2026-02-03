# frozen_string_literal: true

# Phase 4: Create materialized view for Xero sync stats
#
# Purpose: Pre-compute ALL stats in a materialized view for O(1) queries.
# At 15,000 connections, even batch queries may become slow. This MV
# provides instant access to pre-computed stats.
#
# Refresh Strategy:
# - Refreshed every 5 minutes by RefreshXeroStatsMvJob
# - Uses CONCURRENTLY to avoid locking during refresh
#
# Part of "Scale Xero Sync to 15k" plan
class CreateMvXeroSyncStats < ActiveRecord::Migration[8.0]
  def up
    execute <<-SQL
      CREATE MATERIALIZED VIEW mv_xero_sync_stats AS
      SELECT
        xc.tenant_id as xero_org_id,
        xc.tenant_name,
        xc.status,
        xc.is_primary,
        xc.teeem_tenant_id,

        -- Contact link stats (from contact_external_links)
        COALESCE(cel.total_links, 0) as total_links,
        COALESCE(cel.enabled_count, 0) as enabled_count,
        COALESCE(cel.pending_review, 0) as pending_review,
        COALESCE(cel.with_errors, 0) as with_errors,
        cel.last_contact_sync,

        -- Invoice stats (from external_invoices)
        COALESCE(inv.invoices, 0) as invoices,
        COALESCE(inv.bills, 0) as bills,
        COALESCE(inv.quotes, 0) as quotes,
        COALESCE(inv.credit_notes, 0) as credit_notes,
        COALESCE(inv.total_documents, 0) as total_documents,
        inv.last_invoice_sync,

        -- Match breakdown
        COALESCE(mb.exact_abn, 0) as match_exact_abn,
        COALESCE(mb.exact_email, 0) as match_exact_email,
        COALESCE(mb.fuzzy_name, 0) as match_fuzzy_name,
        COALESCE(mb.manual, 0) as match_manual,

        -- Unlinked count (contacts in TEEEM that are inactive/deleted)
        COALESCE(ul.unlinked_count, 0) as unlinked_count,

        -- Cross-tenant matches (contacts linked to multiple Xero orgs)
        COALESCE(ct.cross_tenant_count, 0) as cross_tenant_count,

        -- Timestamp for freshness checking
        NOW() as refreshed_at

      FROM xero_credentials xc

      -- Contact link stats (single subquery per tenant)
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) as total_links,
          COUNT(*) FILTER (WHERE sync_enabled = true) as enabled_count,
          COUNT(*) FILTER (WHERE needs_review = true) as pending_review,
          COUNT(*) FILTER (WHERE sync_error IS NOT NULL) as with_errors,
          MAX(last_synced_at) as last_contact_sync
        FROM contact_external_links
        WHERE source = 'xero' AND xero_org_id = xc.tenant_id
      ) cel ON true

      -- Invoice stats (single subquery per tenant)
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE invoice_type = 'sales_invoice') as invoices,
          COUNT(*) FILTER (WHERE invoice_type = 'bill') as bills,
          COUNT(*) FILTER (WHERE invoice_type = 'quote') as quotes,
          COUNT(*) FILTER (WHERE invoice_type = 'credit_note') as credit_notes,
          COUNT(*) as total_documents,
          MAX(last_synced_at) as last_invoice_sync
        FROM external_invoices
        WHERE source = 'xero' AND xero_org_id = xc.tenant_id
          AND status NOT IN ('draft', 'voided', 'deleted')
      ) inv ON true

      -- Match type breakdown
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE match_type = 'exact_abn') as exact_abn,
          COUNT(*) FILTER (WHERE match_type = 'exact_email') as exact_email,
          COUNT(*) FILTER (WHERE match_type = 'fuzzy_name') as fuzzy_name,
          COUNT(*) FILTER (WHERE match_type = 'manual') as manual
        FROM contact_external_links
        WHERE source = 'xero' AND xero_org_id = xc.tenant_id
      ) mb ON true

      -- Unlinked count (contacts inactive/deleted in TEEEM)
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as unlinked_count
        FROM contact_external_links cel
        LEFT JOIN contacts c ON cel.contact_id = c.id AND (c.is_active = true OR c.is_active IS NULL)
        WHERE cel.source = 'xero' AND cel.xero_org_id = xc.tenant_id AND c.id IS NULL
      ) ul ON true

      -- Cross-tenant matches
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT cel.contact_id) as cross_tenant_count
        FROM contact_external_links cel
        INNER JOIN contact_external_links cel2
          ON cel2.contact_id = cel.contact_id
          AND cel2.xero_org_id != cel.xero_org_id
          AND cel2.source = 'xero'
        WHERE cel.source = 'xero' AND cel.xero_org_id = xc.tenant_id
      ) ct ON true

      WITH DATA;
    SQL

    # Create unique index required for CONCURRENTLY refresh
    execute <<-SQL
      CREATE UNIQUE INDEX idx_mv_xero_sync_stats_org
        ON mv_xero_sync_stats (xero_org_id);
    SQL

    # Index for tenant filtering
    execute <<-SQL
      CREATE INDEX idx_mv_xero_sync_stats_tenant
        ON mv_xero_sync_stats (teeem_tenant_id);
    SQL
  end

  def down
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_xero_sync_stats"
  end
end
