# frozen_string_literal: true

# Migration: Drop warehouse_folders and related tables
#
# Part of "Eliminate warehouse_folders, Make base_folders Tenant-Specific" refactor.
#
# This is the FINAL migration - drops the old tables after data has been migrated.
#
# BIG BANG approach: No fallbacks. Old tables are completely removed.
#
# Tables dropped:
# - warehouse_folder_document_types (join table)
# - warehouse_folders (main table)
#
class DropWarehouseFolders < ActiveRecord::Migration[7.2]
  def up
    Rails.logger.info "[Migration] Dropping warehouse_folders tables..."

    # Remove foreign keys first
    remove_foreign_key :warehouse_folder_document_types, :document_types if foreign_key_exists?(:warehouse_folder_document_types, :document_types)
    remove_foreign_key :warehouse_folder_document_types, :warehouse_folders if foreign_key_exists?(:warehouse_folder_document_types, :warehouse_folders)
    remove_foreign_key :warehouse_folders, :base_folders if foreign_key_exists?(:warehouse_folders, :base_folders)
    remove_foreign_key :warehouse_folders, :jobs if foreign_key_exists?(:warehouse_folders, :jobs)
    remove_foreign_key :warehouse_folders, :tenants if foreign_key_exists?(:warehouse_folders, :tenants)
    remove_foreign_key :warehouse_folders, :warehouse_folders, column: :parent_id if foreign_key_exists?(:warehouse_folders, :warehouse_folders)

    # Drop tables
    drop_table :warehouse_folder_document_types if table_exists?(:warehouse_folder_document_types)
    drop_table :warehouse_folders if table_exists?(:warehouse_folders)

    Rails.logger.info "[Migration] Dropped warehouse_folders tables"
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "Cannot restore dropped warehouse_folders tables. Use backup to restore if needed."
  end
end
