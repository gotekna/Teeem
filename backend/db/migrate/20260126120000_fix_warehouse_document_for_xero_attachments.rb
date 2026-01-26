# frozen_string_literal: true

# Migration: Fix WarehouseDocument schema for Xero attachments
#
# Problem: The unique constraint on documentable prevents multiple documents
# (PDF + attachments) from linking to the same ExternalInvoice.
#
# Solution:
# 1. Remove unique constraint on documentable (keep regular index)
# 2. Make documentable columns nullable (attachments use parent_document_id instead)
# 3. Add index on parent_document_id + metadata for attachment lookups
#
# SSoT Architecture:
# - Primary PDF: documentable = ExternalInvoice
# - Attachments: documentable = nil, parent_document_id = primary PDF's id
#
class FixWarehouseDocumentForXeroAttachments < ActiveRecord::Migration[8.0]
  def up
    # 1. Remove the unique constraint on documentable
    # (keep the regular non-unique index for query performance)
    if index_exists?(:warehouse_documents, [:documentable_type, :documentable_id], name: "idx_warehouse_docs_documentable_unique")
      remove_index :warehouse_documents, name: "idx_warehouse_docs_documentable_unique"
    end

    # 2. Make documentable columns nullable
    # Attachments use parent_document_id instead of documentable
    change_column_null :warehouse_documents, :documentable_type, true
    change_column_null :warehouse_documents, :documentable_id, true

    # 3. Add compound index for attachment lookups
    # (parent_document_id, source_type) for finding all Xero attachments under a PDF
    unless index_exists?(:warehouse_documents, [:parent_document_id, :source_type], name: "idx_warehouse_docs_parent_source")
      add_index :warehouse_documents, [:parent_document_id, :source_type],
                name: "idx_warehouse_docs_parent_source",
                where: "parent_document_id IS NOT NULL"
    end

    # 4. Add partial unique constraint for documents with documentable
    # This ensures one WarehouseDocument per source record (for non-attachments)
    unless index_exists?(:warehouse_documents, [:documentable_type, :documentable_id], name: "idx_warehouse_docs_documentable_unique_partial")
      add_index :warehouse_documents, [:documentable_type, :documentable_id],
                name: "idx_warehouse_docs_documentable_unique_partial",
                unique: true,
                where: "documentable_id IS NOT NULL"
    end
  end

  def down
    # Remove partial unique index
    if index_exists?(:warehouse_documents, name: "idx_warehouse_docs_documentable_unique_partial")
      remove_index :warehouse_documents, name: "idx_warehouse_docs_documentable_unique_partial"
    end

    # Remove parent+source index
    if index_exists?(:warehouse_documents, name: "idx_warehouse_docs_parent_source")
      remove_index :warehouse_documents, name: "idx_warehouse_docs_parent_source"
    end

    # Restore NOT NULL constraints
    # Note: This will fail if there are NULL values
    change_column_null :warehouse_documents, :documentable_type, false
    change_column_null :warehouse_documents, :documentable_id, false

    # Restore unique constraint
    add_index :warehouse_documents, [:documentable_type, :documentable_id],
              name: "idx_warehouse_docs_documentable_unique",
              unique: true
  end
end
