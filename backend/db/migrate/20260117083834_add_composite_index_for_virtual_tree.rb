# frozen_string_literal: true

# Phase 5: Add composite index for virtual tree queries
#
# This index optimizes the virtual_tree endpoint which queries:
#   WHERE source_type = ? AND folder LIKE ?
#
# At 5M+ documents, this composite index provides sub-50ms queries.
#
class AddCompositeIndexForVirtualTree < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!

  def change
    # Composite index for virtual folder tree queries
    # CONCURRENTLY to avoid locking in production
    add_index :warehouse_documents,
              [:source_type, :folder],
              name: "idx_warehouse_docs_scope_folder",
              algorithm: :concurrently,
              if_not_exists: true

    # Index for migration job queries (find unmigrated documents)
    add_index :warehouse_documents,
              [:storage_blob_id, :source_type],
              name: "idx_warehouse_docs_blob_source",
              algorithm: :concurrently,
              if_not_exists: true
  end
end
