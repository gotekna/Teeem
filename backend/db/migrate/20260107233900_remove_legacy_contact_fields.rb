# frozen_string_literal: true

# Migration to remove legacy contact fields after SSoT migration
#
# PREREQUISITE: All contact data must be in SSoT tables:
#   - contact_emails (replaces :email column)
#   - contact_phones (replaces :mobile_phone, :office_phone, :fax_phone columns)
#
# The Contact model now has method overrides that read from SSoT tables:
#   def email → primary_email (from contact_emails)
#   def mobile_phone → primary_mobile (from contact_phones)
#   def office_phone → primary_office_phone (from contact_phones)
#   def fax_phone → primary_fax (from contact_phones)
#
# Run `rails db:migrate` only after verifying:
#   1. All contacts have their data in SSoT tables
#   2. All critical paths tested (search, Xero sync, SMS, etc.)
#
class RemoveLegacyContactFields < ActiveRecord::Migration[8.0]
  def up
    # Safety check: Ensure no contacts have legacy data without SSoT records
    orphaned_emails = execute(<<~SQL).first["count"].to_i
      SELECT COUNT(*) as count FROM contacts c
      WHERE c.email IS NOT NULL
      AND c.email != ''
      AND NOT EXISTS (
        SELECT 1 FROM contact_emails ce
        WHERE ce.contact_id = c.id
      )
    SQL

    # Check each phone type independently (avoid OR/AND precedence issues)
    orphaned_mobile = execute(<<~SQL).first["count"].to_i
      SELECT COUNT(*) as count FROM contacts c
      WHERE c.mobile_phone IS NOT NULL AND c.mobile_phone != ''
      AND NOT EXISTS (SELECT 1 FROM contact_phones cp WHERE cp.contact_id = c.id AND cp.phone_type = 'mobile')
    SQL

    orphaned_office = execute(<<~SQL).first["count"].to_i
      SELECT COUNT(*) as count FROM contacts c
      WHERE c.office_phone IS NOT NULL AND c.office_phone != ''
      AND NOT EXISTS (SELECT 1 FROM contact_phones cp WHERE cp.contact_id = c.id AND cp.phone_type = 'office')
    SQL

    orphaned_fax = execute(<<~SQL).first["count"].to_i
      SELECT COUNT(*) as count FROM contacts c
      WHERE c.fax_phone IS NOT NULL AND c.fax_phone != ''
      AND NOT EXISTS (SELECT 1 FROM contact_phones cp WHERE cp.contact_id = c.id AND cp.phone_type = 'fax')
    SQL

    orphaned_phones = orphaned_mobile + orphaned_office + orphaned_fax

    if orphaned_emails > 0 || orphaned_phones > 0
      raise "Migration blocked: #{orphaned_emails} emails, #{orphaned_mobile} mobiles, " \
            "#{orphaned_office} office phones, #{orphaned_fax} fax only in legacy columns. " \
            "Run data migration first."
    end

    # Drop dependent view first (will be recreated with SSoT reference)
    execute("DROP VIEW IF EXISTS xero_sync_contacts_view CASCADE")

    # Remove legacy columns
    remove_column :contacts, :email, :string
    remove_column :contacts, :mobile_phone, :string
    remove_column :contacts, :office_phone, :string
    remove_column :contacts, :fax_phone, :string

    # Remove any indexes on legacy columns (if they exist)
    remove_index :contacts, :email, if_exists: true
    remove_index :contacts, :mobile_phone, if_exists: true

    # Recreate the view with SSoT email reference
    execute(<<~SQL)
      CREATE OR REPLACE VIEW xero_sync_contacts_view AS
      SELECT cel.id,
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
          COALESCE(
              CASE
                  WHEN c.display_name IS NOT NULL AND cel.external_name IS NOT NULL THEN similarity(lower(c.display_name::text), lower(cel.external_name::text))
                  ELSE NULL::real
              END, 0::real) AS match_confidence,
          c.id AS contact_id,
          c.display_name,
          -- SSoT: Get primary email from contact_emails table
          (SELECT ce.email FROM contact_emails ce WHERE ce.contact_id = c.id ORDER BY ce.is_primary DESC NULLS LAST, ce.position ASC NULLS LAST, ce.id ASC LIMIT 1) AS email,
          c.entity_type,
          c.is_team_contact,
          c.primary_company_id,
          c.created_at,
          c.updated_at,
          COALESCE(link_count.xero_link_count, 1::bigint) AS xero_link_count,
          true AS synced,
              CASE
                  WHEN cel.sync_error IS NOT NULL AND cel.sync_error::text <> ''::text THEN true
                  ELSE false
              END AS has_error,
              CASE
                  WHEN c.roles ~~ '%customer%'::text AND c.roles ~~ '%supplier%'::text THEN 'Both'::text
                  WHEN c.roles ~~ '%customer%'::text THEN 'Customer'::text
                  WHEN c.roles ~~ '%supplier%'::text THEN 'Supplier'::text
                  ELSE NULL::text
              END AS contact_role,
          COALESCE(c.roles ~~ '%customer%'::text, false) AS is_customer,
          COALESCE(c.roles ~~ '%supplier%'::text, false) AS is_supplier,
          COALESCE(inv_stats.invoices_count, 0::bigint) AS invoices_count,
          COALESCE(inv_stats.bills_count, 0::bigint) AS bills_count,
          COALESCE(inv_stats.total_docs, 0::bigint) AS total_docs,
          inv_stats.last_invoice_sync_at AS invoices_synced_at,
          COALESCE(pdf_stats.pdfs_synced, 0::bigint) AS pdfs_synced,
              CASE
                  WHEN COALESCE(inv_stats.total_docs, 0::bigint) > 0 THEN round(COALESCE(pdf_stats.pdfs_synced, 0::bigint)::numeric / inv_stats.total_docs::numeric * 100::numeric)
                  ELSE NULL::numeric
              END AS pdf_sync_percent,
          pdf_stats.last_pdf_sync_at AS pdfs_synced_at,
          pc.display_name AS primary_company_name
         FROM contact_external_links cel
           LEFT JOIN contacts c ON c.id = cel.contact_id AND (c.is_active = true OR c.is_active IS NULL)
           LEFT JOIN LATERAL ( SELECT count(*) AS xero_link_count
                 FROM contact_external_links cel2
                WHERE cel2.contact_id = c.id AND cel2.source::text = 'xero'::text) link_count ON true
           LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE ei.invoice_type::text = 'sales_invoice'::text) AS invoices_count,
                  count(*) FILTER (WHERE ei.invoice_type::text = 'bill'::text) AS bills_count,
                  count(*) AS total_docs,
                  max(ei.last_synced_at) AS last_invoice_sync_at
                 FROM external_invoices ei
                WHERE ei.contact_id = c.id) inv_stats ON true
           LEFT JOIN LATERAL ( SELECT count(*) AS pdfs_synced,
                  max(ccd.created_at) AS last_pdf_sync_at
                 FROM corporate_company_documents ccd
                   JOIN external_invoices ei ON ei.id = ccd.documentable_id
                WHERE ccd.documentable_type::text = 'ExternalInvoice'::text AND ccd.source::text = 'xero'::text AND ccd.external_id::text ~~ 'xero:%:pdf'::text AND ei.contact_id = c.id) pdf_stats ON true
           LEFT JOIN contacts pc ON pc.id = c.primary_company_id
        WHERE cel.source::text = 'xero'::text
      UNION ALL
       SELECT - row_number() OVER (ORDER BY unlinked.xero_contact_name)::integer AS id,
          NULL::integer AS xero_link_id,
          unlinked.external_contact_id AS xero_id,
          unlinked.xero_contact_name AS xero_name,
          unlinked.xero_tenant_id,
          xc.tenant_name AS xero_tenant_name,
          false AS sync_enabled,
          NULL::character varying AS sync_error,
          NULL::timestamp without time zone AS contact_synced_at,
          NULL::character varying AS xero_contact_status,
          true AS needs_review,
          NULL::character varying AS match_type,
          0::numeric AS match_confidence,
          NULL::integer AS contact_id,
          NULL::character varying AS display_name,
          NULL::character varying AS email,
          NULL::character varying AS entity_type,
          false AS is_team_contact,
          NULL::integer AS primary_company_id,
          unlinked.first_seen AS created_at,
          unlinked.last_seen AS updated_at,
          0 AS xero_link_count,
          false AS synced,
          false AS has_error,
          NULL::text AS contact_role,
          false AS is_customer,
          false AS is_supplier,
          unlinked.invoices_count,
          unlinked.bills_count,
          unlinked.total_docs,
          unlinked.last_seen AS invoices_synced_at,
          0 AS pdfs_synced,
          NULL::numeric AS pdf_sync_percent,
          NULL::timestamp without time zone AS pdfs_synced_at,
          NULL::character varying AS primary_company_name
         FROM ( SELECT external_invoices.contact_name AS xero_contact_name,
                  external_invoices.external_contact_id,
                  external_invoices.tenant_id AS xero_tenant_id,
                  count(*) FILTER (WHERE external_invoices.invoice_type::text = 'sales_invoice'::text) AS invoices_count,
                  count(*) FILTER (WHERE external_invoices.invoice_type::text = 'bill'::text) AS bills_count,
                  count(*) AS total_docs,
                  min(external_invoices.created_at) AS first_seen,
                  max(external_invoices.last_synced_at) AS last_seen
                 FROM external_invoices
                WHERE external_invoices.contact_id IS NULL AND external_invoices.contact_name IS NOT NULL AND external_invoices.contact_name::text <> ''::text AND external_invoices.contact_name::text <> 'No Contact'::text AND NOT (external_invoices.external_contact_id::text IN ( SELECT DISTINCT contact_external_links.external_contact_id
                         FROM contact_external_links
                        WHERE contact_external_links.source::text = 'xero'::text AND contact_external_links.external_contact_id IS NOT NULL))
                GROUP BY external_invoices.contact_name, external_invoices.external_contact_id, external_invoices.tenant_id) unlinked
           LEFT JOIN xero_credentials xc ON xc.tenant_id::text = unlinked.xero_tenant_id::text
      UNION ALL
       SELECT - (100000 + row_number() OVER (ORDER BY missing_link.xero_contact_name))::integer AS id,
          NULL::integer AS xero_link_id,
          missing_link.external_contact_id AS xero_id,
          missing_link.xero_contact_name AS xero_name,
          missing_link.xero_tenant_id,
          xc2.tenant_name AS xero_tenant_name,
          false AS sync_enabled,
          NULL::character varying AS sync_error,
          NULL::timestamp without time zone AS contact_synced_at,
          NULL::character varying AS xero_contact_status,
          true AS needs_review,
          'invoice_only'::character varying AS match_type,
          0::numeric AS match_confidence,
          NULL::integer AS contact_id,
          NULL::character varying AS display_name,
          NULL::character varying AS email,
          NULL::character varying AS entity_type,
          false AS is_team_contact,
          NULL::integer AS primary_company_id,
          missing_link.first_seen AS created_at,
          missing_link.last_seen AS updated_at,
          0 AS xero_link_count,
          false AS synced,
          false AS has_error,
          NULL::text AS contact_role,
          false AS is_customer,
          false AS is_supplier,
          missing_link.invoices_count,
          missing_link.bills_count,
          missing_link.total_docs,
          missing_link.last_seen AS invoices_synced_at,
          0 AS pdfs_synced,
          NULL::numeric AS pdf_sync_percent,
          NULL::timestamp without time zone AS pdfs_synced_at,
          NULL::character varying AS primary_company_name
         FROM ( SELECT external_invoices.contact_name AS xero_contact_name,
                  external_invoices.external_contact_id,
                  external_invoices.tenant_id AS xero_tenant_id,
                  count(*) FILTER (WHERE external_invoices.invoice_type::text = 'sales_invoice'::text) AS invoices_count,
                  count(*) FILTER (WHERE external_invoices.invoice_type::text = 'bill'::text) AS bills_count,
                  count(*) AS total_docs,
                  min(external_invoices.created_at) AS first_seen,
                  max(external_invoices.last_synced_at) AS last_seen
                 FROM external_invoices
                WHERE external_invoices.external_contact_id IS NOT NULL AND external_invoices.contact_name IS NOT NULL AND external_invoices.contact_name::text <> ''::text AND external_invoices.contact_name::text <> 'No Contact'::text AND NOT (external_invoices.external_contact_id::text IN ( SELECT DISTINCT contact_external_links.external_contact_id
                         FROM contact_external_links
                        WHERE contact_external_links.source::text = 'xero'::text AND contact_external_links.external_contact_id IS NOT NULL))
                GROUP BY external_invoices.contact_name, external_invoices.external_contact_id, external_invoices.tenant_id) missing_link
           LEFT JOIN xero_credentials xc2 ON xc2.tenant_id::text = missing_link.xero_tenant_id::text
    SQL
  end

  def down
    # Re-add legacy columns
    add_column :contacts, :email, :string
    add_column :contacts, :mobile_phone, :string
    add_column :contacts, :office_phone, :string
    add_column :contacts, :fax_phone, :string

    # Optionally re-add indexes
    add_index :contacts, :email

    # Repopulate from SSoT tables
    execute(<<~SQL)
      UPDATE contacts c
      SET email = (
        SELECT ce.email FROM contact_emails ce
        WHERE ce.contact_id = c.id
        ORDER BY ce.is_primary DESC NULLS LAST, ce.position ASC NULLS LAST, ce.id ASC
        LIMIT 1
      )
    SQL

    execute(<<~SQL)
      UPDATE contacts c
      SET mobile_phone = (
        SELECT cp.phone_number FROM contact_phones cp
        WHERE cp.contact_id = c.id AND cp.phone_type = 'mobile'
        ORDER BY cp.is_primary DESC NULLS LAST, cp.position ASC NULLS LAST, cp.id ASC
        LIMIT 1
      )
    SQL

    execute(<<~SQL)
      UPDATE contacts c
      SET office_phone = (
        SELECT cp.phone_number FROM contact_phones cp
        WHERE cp.contact_id = c.id AND cp.phone_type = 'office'
        ORDER BY cp.is_primary DESC NULLS LAST, cp.position ASC NULLS LAST, cp.id ASC
        LIMIT 1
      )
    SQL

    execute(<<~SQL)
      UPDATE contacts c
      SET fax_phone = (
        SELECT cp.phone_number FROM contact_phones cp
        WHERE cp.contact_id = c.id AND cp.phone_type = 'fax'
        ORDER BY cp.is_primary DESC NULLS LAST, cp.position ASC NULLS LAST, cp.id ASC
        LIMIT 1
      )
    SQL
  end
end
