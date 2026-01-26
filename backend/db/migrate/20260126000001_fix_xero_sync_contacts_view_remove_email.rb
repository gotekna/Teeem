# frozen_string_literal: true

# Fix: Remove c.email from view - contacts table has no email column
# Emails are stored in contact_emails table, not as a column on contacts
class FixXeroSyncContactsViewRemoveEmail < ActiveRecord::Migration[7.1]
  def up
    execute <<-SQL
      DROP VIEW IF EXISTS xero_sync_contacts_view;
      CREATE VIEW xero_sync_contacts_view AS
      SELECT
        -- Use xero_link_id as the primary identifier (Xero is SSoT)
        cel.id AS id,
        cel.id AS xero_link_id,

        -- Xero contact info (from the link)
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

        -- Linked TEEEM contact info
        c.id AS contact_id,
        c.display_name,
        -- REMOVED: c.email (column does not exist in contacts table)
        c.entity_type,
        c.is_team_contact,
        c.primary_company_id,
        c.created_at,
        c.updated_at,

        -- Count of Xero links for this TEEEM contact
        COALESCE(link_count.xero_link_count, 1) AS xero_link_count,

        -- Derived sync status
        CASE WHEN c.id IS NOT NULL THEN true ELSE false END AS synced,
        CASE WHEN cel.sync_error IS NOT NULL AND cel.sync_error != '' THEN true ELSE false END AS has_error,

        -- Role detection from contact roles text field
        CASE
          WHEN c.roles LIKE '%customer%' AND c.roles LIKE '%supplier%' THEN 'Both'
          WHEN c.roles LIKE '%customer%' THEN 'Customer'
          WHEN c.roles LIKE '%supplier%' THEN 'Supplier'
          ELSE NULL
        END AS contact_role,
        COALESCE(c.roles LIKE '%customer%', false) AS is_customer,
        COALESCE(c.roles LIKE '%supplier%', false) AS is_supplier,

        -- Invoice/Bill counts (aggregated for the linked contact)
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

      -- SSoT: Start from Xero links (contact_external_links where source = 'xero')
      FROM contact_external_links cel

      -- Left join to the linked TEEEM contact
      LEFT JOIN contacts c ON c.id = cel.contact_id AND (c.is_active = true OR c.is_active IS NULL)

      -- Count of Xero links for the same contact
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS xero_link_count
        FROM contact_external_links cel2
        WHERE cel2.contact_id = c.id
          AND cel2.source = 'xero'
      ) link_count ON true

      -- Invoice/bill stats subquery (for the linked contact)
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

      -- Only Xero links
      WHERE cel.source = 'xero';
    SQL
  end

  def down
    # Restore previous version (with the buggy email column reference)
    # This will fail if run, which is intentional - the email column never existed
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
        WHERE cel2.contact_id = c.id
          AND cel2.source = 'xero'
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
