# frozen_string_literal: true

# Adds unlinked Xero contacts to the view (from external_invoices where contact_id IS NULL)
class AddUnlinkedXeroContactsToView < ActiveRecord::Migration[7.1]
  def up
    execute <<-SQL
      DROP VIEW IF EXISTS xero_sync_contacts_view;
      CREATE VIEW xero_sync_contacts_view AS
      
      -- Part 1: Linked Xero contacts (from contact_external_links)
      SELECT
        cel.id AS id,
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
        c.id AS contact_id,
        c.display_name,
        c.email,
        c.entity_type,
        c.is_team_contact,
        c.primary_company_id,
        c.created_at,
        c.updated_at,
        COALESCE(link_count.xero_link_count, 1) AS xero_link_count,
        true AS synced,
        CASE WHEN cel.sync_error IS NOT NULL AND cel.sync_error != '' THEN true ELSE false END AS has_error,
        CASE
          WHEN c.roles LIKE '%customer%' AND c.roles LIKE '%supplier%' THEN 'Both'
          WHEN c.roles LIKE '%customer%' THEN 'Customer'
          WHEN c.roles LIKE '%supplier%' THEN 'Supplier'
          ELSE NULL
        END AS contact_role,
        COALESCE(c.roles LIKE '%customer%', false) AS is_customer,
        COALESCE(c.roles LIKE '%supplier%', false) AS is_supplier,
        COALESCE(inv_stats.invoices_count, 0) AS invoices_count,
        COALESCE(inv_stats.bills_count, 0) AS bills_count,
        COALESCE(inv_stats.total_docs, 0) AS total_docs,
        inv_stats.last_invoice_sync_at AS invoices_synced_at,
        COALESCE(pdf_stats.pdfs_synced, 0) AS pdfs_synced,
        CASE
          WHEN COALESCE(inv_stats.total_docs, 0) > 0
          THEN ROUND((COALESCE(pdf_stats.pdfs_synced, 0)::numeric / inv_stats.total_docs::numeric) * 100)
          ELSE NULL
        END AS pdf_sync_percent,
        pdf_stats.last_pdf_sync_at AS pdfs_synced_at,
        pc.display_name AS primary_company_name
      FROM contact_external_links cel
      LEFT JOIN contacts c ON c.id = cel.contact_id AND (c.is_active = true OR c.is_active IS NULL)
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS xero_link_count
        FROM contact_external_links cel2
        WHERE cel2.contact_id = c.id AND cel2.source = 'xero'
      ) link_count ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE invoice_type = 'sales_invoice') AS invoices_count,
          COUNT(*) FILTER (WHERE invoice_type = 'bill') AS bills_count,
          COUNT(*) AS total_docs,
          MAX(last_synced_at) AS last_invoice_sync_at
        FROM external_invoices ei
        WHERE ei.contact_id = c.id
      ) inv_stats ON true
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
      LEFT JOIN contacts pc ON pc.id = c.primary_company_id
      WHERE cel.source = 'xero'

      UNION ALL

      -- Part 2: Unlinked Xero contacts (from external_invoices with no TEEEM contact)
      SELECT
        -- Generate a negative ID to avoid collision with contact_external_links IDs
        -(ROW_NUMBER() OVER (ORDER BY unlinked.xero_contact_name))::integer AS id,
        NULL::integer AS xero_link_id,
        unlinked.external_contact_id AS xero_id,
        unlinked.xero_contact_name AS xero_name,
        unlinked.xero_tenant_id AS xero_tenant_id,
        xc.tenant_name AS xero_tenant_name,
        false AS sync_enabled,
        NULL AS sync_error,
        NULL::timestamp AS contact_synced_at,
        NULL AS xero_contact_status,
        true AS needs_review,
        NULL AS match_type,
        NULL::numeric AS match_confidence,
        NULL::integer AS contact_id,
        NULL AS display_name,
        NULL AS email,
        NULL AS entity_type,
        false AS is_team_contact,
        NULL::integer AS primary_company_id,
        unlinked.first_seen AS created_at,
        unlinked.last_seen AS updated_at,
        0 AS xero_link_count,
        false AS synced,
        false AS has_error,
        NULL AS contact_role,
        false AS is_customer,
        false AS is_supplier,
        unlinked.invoices_count,
        unlinked.bills_count,
        unlinked.total_docs,
        unlinked.last_seen AS invoices_synced_at,
        0 AS pdfs_synced,
        NULL::numeric AS pdf_sync_percent,
        NULL::timestamp AS pdfs_synced_at,
        NULL AS primary_company_name
      FROM (
        SELECT
          contact_name AS xero_contact_name,
          external_contact_id,
          tenant_id AS xero_tenant_id,
          COUNT(*) FILTER (WHERE invoice_type = 'sales_invoice') AS invoices_count,
          COUNT(*) FILTER (WHERE invoice_type = 'bill') AS bills_count,
          COUNT(*) AS total_docs,
          MIN(created_at) AS first_seen,
          MAX(last_synced_at) AS last_seen
        FROM external_invoices
        WHERE contact_id IS NULL
          AND contact_name IS NOT NULL
          AND contact_name != ''
          AND contact_name != 'No Contact'
          -- Exclude Xero contacts that already have a link
          AND external_contact_id NOT IN (
            SELECT DISTINCT external_contact_id
            FROM contact_external_links
            WHERE source = 'xero' AND external_contact_id IS NOT NULL
          )
        GROUP BY contact_name, external_contact_id, tenant_id
      ) unlinked
      LEFT JOIN xero_credentials xc ON xc.tenant_id = unlinked.xero_tenant_id

      UNION ALL

      -- Part 3: Xero contacts from invoices with NO ContactExternalLink
      -- Don't show TEEEM contact - it's unreliable (may be wrongly linked)
      SELECT
        -(100000 + ROW_NUMBER() OVER (ORDER BY missing_link.xero_contact_name))::integer AS id,
        NULL::integer AS xero_link_id,
        missing_link.external_contact_id AS xero_id,
        missing_link.xero_contact_name AS xero_name,
        missing_link.xero_tenant_id AS xero_tenant_id,
        xc2.tenant_name AS xero_tenant_name,
        false AS sync_enabled,
        NULL AS sync_error,
        NULL::timestamp AS contact_synced_at,
        NULL AS xero_contact_status,
        true AS needs_review,
        'invoice_only' AS match_type,
        NULL::numeric AS match_confidence,
        NULL::integer AS contact_id,
        NULL AS display_name,
        NULL AS email,
        NULL AS entity_type,
        false AS is_team_contact,
        NULL::integer AS primary_company_id,
        missing_link.first_seen AS created_at,
        missing_link.last_seen AS updated_at,
        0 AS xero_link_count,
        false AS synced,
        false AS has_error,
        NULL AS contact_role,
        false AS is_customer,
        false AS is_supplier,
        missing_link.invoices_count,
        missing_link.bills_count,
        missing_link.total_docs,
        missing_link.last_seen AS invoices_synced_at,
        0 AS pdfs_synced,
        NULL::numeric AS pdf_sync_percent,
        NULL::timestamp AS pdfs_synced_at,
        NULL AS primary_company_name
      FROM (
        SELECT
          contact_name AS xero_contact_name,
          external_contact_id,
          tenant_id AS xero_tenant_id,
          COUNT(*) FILTER (WHERE invoice_type = 'sales_invoice') AS invoices_count,
          COUNT(*) FILTER (WHERE invoice_type = 'bill') AS bills_count,
          COUNT(*) AS total_docs,
          MIN(created_at) AS first_seen,
          MAX(last_synced_at) AS last_seen
        FROM external_invoices
        WHERE external_contact_id IS NOT NULL
          AND contact_name IS NOT NULL
          AND contact_name != ''
          AND contact_name != 'No Contact'
          AND external_contact_id NOT IN (
            SELECT DISTINCT external_contact_id
            FROM contact_external_links
            WHERE source = 'xero' AND external_contact_id IS NOT NULL
          )
        GROUP BY contact_name, external_contact_id, tenant_id
      ) missing_link
      LEFT JOIN xero_credentials xc2 ON xc2.tenant_id = missing_link.xero_tenant_id;
    SQL
  end

  def down
    # Restore previous version
    execute <<-SQL
      DROP VIEW IF EXISTS xero_sync_contacts_view;
      CREATE VIEW xero_sync_contacts_view AS
      SELECT
        cel.id AS id,
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
        c.id AS contact_id,
        c.display_name,
        c.email,
        c.entity_type,
        c.is_team_contact,
        c.primary_company_id,
        c.created_at,
        c.updated_at,
        COALESCE(link_count.xero_link_count, 1) AS xero_link_count,
        CASE WHEN c.id IS NOT NULL THEN true ELSE false END AS synced,
        CASE WHEN cel.sync_error IS NOT NULL AND cel.sync_error != '' THEN true ELSE false END AS has_error,
        CASE
          WHEN c.roles LIKE '%customer%' AND c.roles LIKE '%supplier%' THEN 'Both'
          WHEN c.roles LIKE '%customer%' THEN 'Customer'
          WHEN c.roles LIKE '%supplier%' THEN 'Supplier'
          ELSE NULL
        END AS contact_role,
        COALESCE(c.roles LIKE '%customer%', false) AS is_customer,
        COALESCE(c.roles LIKE '%supplier%', false) AS is_supplier,
        COALESCE(inv_stats.invoices_count, 0) AS invoices_count,
        COALESCE(inv_stats.bills_count, 0) AS bills_count,
        COALESCE(inv_stats.total_docs, 0) AS total_docs,
        inv_stats.last_invoice_sync_at AS invoices_synced_at,
        COALESCE(pdf_stats.pdfs_synced, 0) AS pdfs_synced,
        CASE
          WHEN COALESCE(inv_stats.total_docs, 0) > 0
          THEN ROUND((COALESCE(pdf_stats.pdfs_synced, 0)::numeric / inv_stats.total_docs::numeric) * 100)
          ELSE NULL
        END AS pdf_sync_percent,
        pdf_stats.last_pdf_sync_at AS pdfs_synced_at,
        pc.display_name AS primary_company_name
      FROM contact_external_links cel
      LEFT JOIN contacts c ON c.id = cel.contact_id AND (c.is_active = true OR c.is_active IS NULL)
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS xero_link_count
        FROM contact_external_links cel2
        WHERE cel2.contact_id = c.id AND cel2.source = 'xero'
      ) link_count ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE invoice_type = 'sales_invoice') AS invoices_count,
          COUNT(*) FILTER (WHERE invoice_type = 'bill') AS bills_count,
          COUNT(*) AS total_docs,
          MAX(last_synced_at) AS last_invoice_sync_at
        FROM external_invoices ei
        WHERE ei.contact_id = c.id
      ) inv_stats ON true
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
      LEFT JOIN contacts pc ON pc.id = c.primary_company_id
      WHERE cel.source = 'xero';
    SQL
  end
end
