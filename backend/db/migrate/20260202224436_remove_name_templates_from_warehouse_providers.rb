# frozen_string_literal: true

# SSoT Consolidation: Remove duplicate naming template columns from warehouse_providers
#
# These columns are now redundant - naming templates are stored per-tab in warehouse_folders:
#   - warehouse_folders.download_name (replaces download_name_templates)
#   - warehouse_folders.ui_name (replaces ui_name_templates)
#
class RemoveNameTemplatesFromWarehouseProviders < ActiveRecord::Migration[8.0]
  def up
    remove_column :warehouse_providers, :download_name_templates
    remove_column :warehouse_providers, :ui_name_templates
  end

  def down
    add_column :warehouse_providers, :download_name_templates, :jsonb, default: {}, null: false
    add_column :warehouse_providers, :ui_name_templates, :jsonb, default: {}
  end
end
