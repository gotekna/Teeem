class AddTenantIdToExternalInvoices < ActiveRecord::Migration[8.0]
  def up
    # external_invoices already has tenant_id as string - convert to bigint reference
    # Must drop dependent view first
    execute "DROP VIEW IF EXISTS xero_sync_contacts_view"

    # Clear any existing string values (they're not valid foreign keys anyway)
    execute "UPDATE external_invoices SET tenant_id = NULL WHERE tenant_id IS NOT NULL"

    # Convert column from string to bigint using ALTER TABLE
    execute "ALTER TABLE external_invoices ALTER COLUMN tenant_id TYPE bigint USING tenant_id::bigint"

    # Index already exists, no need to add

    # Backfill from contact → tenant
    execute <<-SQL
      UPDATE external_invoices
      SET tenant_id = contacts.tenant_id
      FROM contacts
      WHERE external_invoices.contact_id = contacts.id
      AND external_invoices.tenant_id IS NULL
      AND contacts.tenant_id IS NOT NULL
    SQL

    # Backfill from job → tenant for any still missing
    execute <<-SQL
      UPDATE external_invoices
      SET tenant_id = jobs.tenant_id
      FROM jobs
      WHERE external_invoices.job_id = jobs.id
      AND external_invoices.tenant_id IS NULL
      AND jobs.tenant_id IS NOT NULL
    SQL

    orphaned = execute("SELECT COUNT(*) FROM external_invoices WHERE tenant_id IS NULL").first["count"].to_i
    if orphaned > 0
      puts "⚠️  Deleting #{orphaned} orphaned external_invoices"
      execute "DELETE FROM external_invoices WHERE tenant_id IS NULL"
    end

    change_column_null :external_invoices, :tenant_id, false
    add_foreign_key :external_invoices, :tenants

    # Recreate the view
    recreate_xero_sync_contacts_view

    puts "✅ external_invoices tenant scoping complete (converted from string to bigint)"
  end

  private

  def recreate_xero_sync_contacts_view
    execute <<-SQL
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

        -- Invoice/Bill counts (filtered by THIS tenant)
        COALESCE(inv_stats.invoices_count, 0) AS invoices_count,
        COALESCE(inv_stats.bills_count, 0) AS bills_count,
        COALESCE(inv_stats.total_docs, 0) AS total_docs,
        inv_stats.last_invoice_sync_at AS invoices_synced_at,

        -- PDF sync stats (filtered by THIS tenant)
        COALESCE(pdf_stats.pdfs_synced, 0) AS pdfs_synced,
        CASE
          WHEN COALESCE(inv_stats.total_docs, 0) > 0
          THEN ROUND((COALESCE(pdf_stats.pdfs_synced, 0)::numeric / inv_stats.total_docs::numeric) * 100)
          ELSE NULL
        END AS pdf_sync_percent,
        pdf_stats.last_pdf_sync_at AS pdfs_synced_at,

        -- Blob health stats (filtered by THIS tenant)
        COALESCE(blob_health.blobs_with_hash, 0) AS blobs_valid,
        COALESCE(blob_health.blobs_without_hash, 0) AS blobs_invalid,
        CASE
          WHEN COALESCE(pdf_stats.pdfs_synced, 0) = 0 THEN NULL
          WHEN COALESCE(blob_health.blobs_without_hash, 0) = 0 THEN true
          ELSE false
        END AS blobs_healthy,

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

      -- Invoice/bill stats subquery (filtered by THIS tenant)
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE invoice_type = 'sales_invoice') AS invoices_count,
          COUNT(*) FILTER (WHERE invoice_type = 'bill') AS bills_count,
          COUNT(*) AS total_docs,
          MAX(last_synced_at) AS last_invoice_sync_at
        FROM external_invoices ei
        WHERE ei.contact_id = c.id
          AND ei.tenant_id = cel.tenant_id
      ) inv_stats ON true

      -- PDF stats subquery (filtered by THIS tenant)
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS pdfs_synced,
          MAX(wd.created_at) AS last_pdf_sync_at
        FROM warehouse_documents wd
        INNER JOIN external_invoices ei ON ei.id = wd.documentable_id
        WHERE wd.documentable_type = 'ExternalInvoice'
          AND wd.source_type = 'xero'
          AND ei.contact_id = c.id
          AND ei.tenant_id = cel.tenant_id
      ) pdf_stats ON true

      -- Blob health stats (checks if storage blobs have content_hash)
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE sb.content_hash IS NOT NULL) AS blobs_with_hash,
          COUNT(*) FILTER (WHERE sb.content_hash IS NULL) AS blobs_without_hash
        FROM warehouse_documents wd
        INNER JOIN external_invoices ei ON ei.id = wd.documentable_id
        LEFT JOIN storage_blobs sb ON sb.id = wd.storage_blob_id
        WHERE wd.documentable_type = 'ExternalInvoice'
          AND wd.source_type = 'xero'
          AND ei.contact_id = c.id
          AND ei.tenant_id = cel.tenant_id
      ) blob_health ON true

      -- Primary company join
      LEFT JOIN contacts pc ON pc.id = c.primary_company_id

      -- Only Xero links
      WHERE cel.source = 'xero';
    SQL
  end

  def down
    remove_foreign_key :external_invoices, :tenants
    remove_index :external_invoices, :tenant_id
    # Convert back to string
    execute "ALTER TABLE external_invoices ALTER COLUMN tenant_id TYPE varchar USING tenant_id::varchar"
  end
end
