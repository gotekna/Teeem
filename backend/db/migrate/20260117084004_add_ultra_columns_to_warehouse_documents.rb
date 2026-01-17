# frozen_string_literal: true

# Phase 6: Ultra Design - ONE Document Table for 5000 Clients
#
# This migration adds columns to make WarehouseDocument THE universal document table.
# After this, all document metadata can live in one table with flexible JSONB storage.
#
# Benefits at scale:
# - 1 table to maintain instead of 8
# - 1 multi-tenant migration instead of 8
# - Simple queries without JOINs
# - New document types = new source_type value (no migration)
#
class AddUltraColumnsToWarehouseDocuments < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!

  def change
    # Multi-tenant support (for 5000 clients)
    add_column :warehouse_documents, :tenant_id, :bigint, if_not_exists: true

    # Flexible metadata (replaces need for separate tables)
    # Example for email: { subject: "...", from_email: "...", received_at: "..." }
    # Example for job: { job_code: "J-001", document_type: "Plans" }
    add_column :warehouse_documents, :metadata, :jsonb, default: {}, if_not_exists: true

    # Parent document link (attachment→email, version→original)
    # Enables: email.attachments, doc.versions, doc.parent
    add_column :warehouse_documents, :parent_document_id, :bigint, if_not_exists: true

    # Optional link to domain object (Job, Contact, Company, etc.)
    # Different from documentable - this is for categorization/filtering
    add_column :warehouse_documents, :linkable_type, :string, if_not_exists: true
    add_column :warehouse_documents, :linkable_id, :bigint, if_not_exists: true

    # Version tracking
    add_column :warehouse_documents, :version_group_id, :uuid, if_not_exists: true
    add_column :warehouse_documents, :version_number, :integer, default: 1, if_not_exists: true
    add_column :warehouse_documents, :is_latest_version, :boolean, default: true, if_not_exists: true

    # Indexes for fast queries (CONCURRENTLY to avoid locking)
    add_index :warehouse_documents, :tenant_id,
              name: "idx_warehouse_docs_tenant",
              algorithm: :concurrently,
              if_not_exists: true

    add_index :warehouse_documents, :parent_document_id,
              name: "idx_warehouse_docs_parent",
              algorithm: :concurrently,
              if_not_exists: true

    add_index :warehouse_documents, :metadata,
              using: :gin,
              name: "idx_warehouse_docs_metadata",
              algorithm: :concurrently,
              if_not_exists: true

    add_index :warehouse_documents, [:linkable_type, :linkable_id],
              name: "idx_warehouse_docs_linkable",
              algorithm: :concurrently,
              if_not_exists: true

    add_index :warehouse_documents, [:version_group_id, :is_latest_version],
              name: "idx_warehouse_docs_version_group",
              algorithm: :concurrently,
              if_not_exists: true

    add_index :warehouse_documents, [:tenant_id, :source_type, :folder],
              name: "idx_warehouse_docs_tenant_scope_folder",
              algorithm: :concurrently,
              if_not_exists: true

    # Self-referential FK for parent_document_id
    add_foreign_key :warehouse_documents, :warehouse_documents,
                    column: :parent_document_id,
                    on_delete: :nullify,
                    validate: false
  end
end
