# frozen_string_literal: true

# Performance fix: Add composite indexes to resolve slow queries identified
# by Performance Observatory on 2026-03-05.
#
# Root causes (FRC analysis):
#   1. contacts: Missing (tenant_id, is_active) → full table scan on every index request
#   2. external_invoices: Missing (tenant_id, status) → .active scope scans all rows
#   3. synced_emails: Missing compound index for pending_storage_upload scope
#   4. warehouse_documents: Missing (tenant_id, source_type, documentable_type) for Xero PDF sync
#   5. contact_relationships: Missing (source_contact_id, is_active) for relationships endpoint
#
class AddPerformanceCompositeIndexes < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    # 1. Contacts: tenant_id + is_active (fixes P95 11.7s on /api/v1/contacts)
    #    Every contacts index query filters by tenant + is_active but no composite index exists.
    add_index :contacts, [:tenant_id, :is_active],
              algorithm: :concurrently,
              name: "idx_contacts_tenant_is_active"

    # 2. External Invoices: tenant_id + status (fixes 972 slow queries, avg 1,691ms)
    #    The .active scope (WHERE status NOT IN ('voided','deleted')) is used by 8+ endpoints.
    add_index :external_invoices, [:tenant_id, :status],
              algorithm: :concurrently,
              name: "idx_ext_inv_tenant_status"

    # 3. Synced Emails: tenant_id + content_unavailable + has_attachments
    #    Fixes pending_storage_upload scope (67 queries, avg 2,239ms each).
    #    The scope filters on content_unavailable=false plus storage_path/outlook_id checks.
    add_index :synced_emails, [:tenant_id, :content_unavailable],
              algorithm: :concurrently,
              name: "idx_synced_emails_tenant_content_unavail"

    # 4. Warehouse Documents: tenant_id + source_type + documentable_type
    #    Fixes Xero PDF sync COUNT queries (1,442 slow queries, avg 548ms).
    #    The pdf_sync_status endpoint filters by source_type='xero' + documentable_type='ExternalInvoice'.
    add_index :warehouse_documents, [:tenant_id, :source_type, :documentable_type],
              algorithm: :concurrently,
              name: "idx_warehouse_docs_tenant_source_doctype"

    # 5. Contact Relationships: source_contact_id + is_active
    #    Fixes relationships endpoint (P95 5.4s on /api/v1/contacts/:id/relationships).
    #    Outgoing relationships filter by source_contact_id + is_active.
    add_index :contact_relationships, [:source_contact_id, :is_active],
              algorithm: :concurrently,
              name: "idx_contact_rels_source_active"

    # 6. Contact Relationships: related_contact_id + is_active
    #    Same fix for incoming relationships lookups.
    add_index :contact_relationships, [:related_contact_id, :is_active],
              algorithm: :concurrently,
              name: "idx_contact_rels_related_active"
  end
end
