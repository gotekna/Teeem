# frozen_string_literal: true

# SSoT Consolidation: Remove warehouse_folders column from warehouse_providers
#
# This column is now redundant - all folder paths are stored directly
# in the warehouse_folders table (warehouse_folder column per tab).
#
# Before: warehouse_providers.warehouse_folders had base templates
# After: warehouse_folders.warehouse_folder has complete path per tab
#
class RemoveWarehouseFoldersFromWarehouseProviders < ActiveRecord::Migration[8.0]
  def up
    remove_column :warehouse_providers, :warehouse_folders
  end

  def down
    add_column :warehouse_providers, :warehouse_folders, :jsonb, default: {}, null: false
  end
end
