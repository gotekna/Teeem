# frozen_string_literal: true

# Phase 1: Materialized Paths at Scale
#
# Adds folder_path (materialized), warehouse_folder_id FK, and path_template_version
# to warehouse_documents for fast path-based tree queries.
#
# Also adds template_version to warehouse_folders for staleness detection,
# and creates warehouse_folder_counts for cached folder counts.
#
# This migration is safe to run on production - all new columns are nullable
# and backfilled asynchronously via BackfillWarehousePathsJob.
#
class AddMaterializedPathsToWarehouse < ActiveRecord::Migration[7.2]
  def change
    # ═══════════════════════════════════════════════════════════════════════
    # 1. Add materialized path columns to warehouse_documents
    # ═══════════════════════════════════════════════════════════════════════

    # folder_path: The fully-expanded, materialized folder path
    # e.g., "Job/In Progress/Renovation/J-001 Smith Residence/Photo"
    # NULL until backfilled - computed_folder_path still works as fallback
    add_column :warehouse_documents, :folder_path, :string

    # warehouse_folder_id: FK to the template folder this document belongs to
    # Enables fast joins for folder-level queries and template versioning
    add_column :warehouse_documents, :warehouse_folder_id, :bigint

    # path_template_version: Tracks which version of the template was used
    # When warehouse_folder.template_version > this, the path is stale
    add_column :warehouse_documents, :path_template_version, :integer, default: 0

    # Indexes for path-based tree queries
    # Primary index: tenant + folder_path for tree rendering
    add_index :warehouse_documents, [:tenant_id, :folder_path],
              name: "idx_wd_tenant_folder_path"

    # Scoped views: linkable + folder_path for Job/Contact/Corporate warehouse tabs
    add_index :warehouse_documents, [:linkable_type, :linkable_id, :folder_path],
              name: "idx_wd_linkable_folder_path"

    # FK index for warehouse_folder_id
    add_index :warehouse_documents, :warehouse_folder_id,
              name: "idx_wd_warehouse_folder"

    # FK constraint
    add_foreign_key :warehouse_documents, :warehouse_folders,
                    column: :warehouse_folder_id,
                    on_delete: :nullify,
                    validate: false

    # ═══════════════════════════════════════════════════════════════════════
    # 2. Add template_version to warehouse_folders
    # ═══════════════════════════════════════════════════════════════════════

    # template_version: Incremented when folder structure changes
    # Documents with path_template_version < this are stale
    add_column :warehouse_folders, :template_version, :integer, default: 1, null: false

    # ═══════════════════════════════════════════════════════════════════════
    # 3. Create warehouse_folder_counts for cached tree counts
    # ═══════════════════════════════════════════════════════════════════════

    create_table :warehouse_folder_counts do |t|
      t.bigint :tenant_id, null: false
      t.string :folder_path_prefix, null: false  # e.g., "Job/In Progress"
      t.integer :depth, null: false               # e.g., 2
      t.integer :document_count, default: 0
      t.datetime :stale_at                        # null = fresh

      t.timestamps
    end

    add_index :warehouse_folder_counts,
              [:tenant_id, :depth, :folder_path_prefix],
              unique: true,
              name: "idx_wfc_tenant_depth_path"

    add_index :warehouse_folder_counts,
              [:tenant_id, :stale_at],
              name: "idx_wfc_tenant_stale",
              where: "stale_at IS NOT NULL"

    add_foreign_key :warehouse_folder_counts, :tenants,
                    on_delete: :cascade,
                    validate: false
  end
end
