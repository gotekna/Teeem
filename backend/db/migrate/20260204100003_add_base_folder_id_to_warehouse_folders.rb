# frozen_string_literal: true

# Migration: Add base_folder_id FK to warehouse_folders
#
# Part of the Database-Driven Warehouse Types & Base Folders feature.
# This adds a foreign key reference to the base_folders table.
# The existing warehouse_type and base_folder string columns are kept
# for backward compatibility during the migration period.
#
# After data migration is verified, a follow-up migration will remove:
# - warehouse_type (string)
# - base_folder (string)
#
class AddBaseFolderIdToWarehouseFolders < ActiveRecord::Migration[7.2]
  def change
    # Add FK reference to base_folders table
    add_reference :warehouse_folders, :base_folder, foreign_key: true, index: true

    # Note: The existing string columns (warehouse_type, base_folder) are kept
    # for backward compatibility. They will be removed in a follow-up migration
    # after data migration is verified.
  end
end
