# frozen_string_literal: true

# Creates a database view for Xero sync contacts that aggregates:
# - Contact base info
# - Xero link data from contact_external_links
# - Invoice/bill counts from external_invoices
# - PDF sync stats from corporate_company_documents
class CreateXeroSyncContactsView < ActiveRecord::Migration[7.1]
  def up
    execute <<-SQL
      CREATE OR REPLACE VIEW xero_sync_contacts_view AS
      SELECT
        c.id,
        c.display_name,
        c.email,
        c.entity_type,
        c.is_team_contact,
        c.primary_company_id,
        c.created_at,
        c.updated_at,

        -- Xero link data (from first/primary link)
        cel.id AS xero_link_id,
        cel.external_contact_id AS xero_id,
        cel.external_name AS xero_name,
        cel.tenant_id AS xero_tenant_id,
        cel.tenant_name AS xero_tenant_name,
        cel.sync_enabled,
        cel.sync_error,
        cel.last_synced_at AS contact_synced_at,
        cel.xero_contact_status,
        cel.needs_review,
        cel.match_type,
        cel.match_confidence,

        -- Derived sync status
        CASE WHEN cel.external_contact_id IS NOT NULL THEN true ELSE false END AS synced,
        CASE WHEN cel.sync_error IS NOT NULL AND cel.sync_error != '' THEN true ELSE false END AS has_error,

        -- Role detection from contact roles text field
        CASE
          WHEN c.roles LIKE '%customer%' AND c.roles LIKE '%supplier%' THEN 'Both'
          WHEN c.roles LIKE '%customer%' THEN 'Customer'
          WHEN c.roles LIKE '%supplier%' THEN 'Supplier'
          ELSE NULL
        END AS contact_role,
        c.roles LIKE '%customer%' AS is_customer,
        c.roles LIKE '%supplier%' AS is_supplier,

        -- Invoice/Bill counts (aggregated)
        COALESCE(inv_stats.invoices_count, 0) AS invoices_count,
        COALESCE(inv_stats.bills_count, 0) AS bills_count,
        COALESCE(inv_stats.total_docs, 0) AS total_docs,
        inv_stats.last_invoice_sync_at AS invoices_synced_at,

        -- PDF sync stats
        COALESCE(pdf_stats.pdfs_synced, 0) AS pdfs_synced,
        CASE
          WHEN COALESCE(inv_stats.total_docs, 0) > 0
          THEN ROUND((COALESCE(pdf_stats.pdfs_synced, 0)::numeric / inv_stats.total_docs::numeric) * 100)
          ELSE NULL
        END AS pdf_sync_percent,
        pdf_stats.last_pdf_sync_at AS pdfs_synced_at,

        -- Primary company info
        pc.display_name AS primary_company_name

      FROM contacts c

      -- Left join to get first Xero link (by created_at order)
      LEFT JOIN LATERAL (
        SELECT *
        FROM contact_external_links cel_inner
        WHERE cel_inner.contact_id = c.id
          AND cel_inner.source = 'xero'
        ORDER BY cel_inner.created_at ASC
        LIMIT 1
      ) cel ON true

      -- Invoice/bill stats subquery
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE invoice_type = 'sales_invoice') AS invoices_count,
          COUNT(*) FILTER (WHERE invoice_type = 'bill') AS bills_count,
          COUNT(*) AS total_docs,
          MAX(last_synced_at) AS last_invoice_sync_at
        FROM external_invoices ei
        WHERE ei.contact_id = c.id
      ) inv_stats ON true

      -- PDF stats subquery
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS pdfs_synced,
          MAX(ccd.created_at) AS last_pdf_sync_at
        FROM corporate_company_documents ccd
        INNER JOIN external_invoices ei ON ei.id = ccd.documentable_id
        WHERE ccd.documentable_type = 'ExternalInvoice'
          AND ccd.source = 'xero'
          AND ccd.external_id LIKE 'xero:%:pdf'
          AND ei.contact_id = c.id
      ) pdf_stats ON true

      -- Primary company join
      LEFT JOIN contacts pc ON pc.id = c.primary_company_id

      WHERE c.is_active = true OR c.is_active IS NULL;
    SQL

    # Add index on contact_external_links for faster lateral join if not exists
    unless index_exists?(:contact_external_links, [:contact_id, :source, :created_at], name: 'idx_cel_contact_source_created')
      add_index :contact_external_links, [:contact_id, :source, :created_at],
                name: 'idx_cel_contact_source_created'
    end
  end

  def down
    execute "DROP VIEW IF EXISTS xero_sync_contacts_view"

    if index_exists?(:contact_external_links, name: 'idx_cel_contact_source_created')
      remove_index :contact_external_links, name: 'idx_cel_contact_source_created'
    end
  end
end
