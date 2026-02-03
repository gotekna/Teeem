# frozen_string_literal: true

# SSoT Consolidation: Populate warehouse_folder with COMPLETE path templates
#
# BEFORE: warehouse_folder column is nil/empty, path derived from:
#   - warehouse_providers.warehouse_folders[warehouse_type] (base template)
#   - display_name (substituted into {{TabName}})
#
# AFTER: warehouse_folder column stores COMPLETE path template per tab
#   - Each tab has its full path stored
#   - No derivation needed from warehouse_providers
#   - warehouse_folders table is THE ONE SSoT
#
class PopulateWarehouseFolderFullPaths < ActiveRecord::Migration[8.0]
  def up
    # Get base templates from master tenant's warehouse_provider
    master_provider = WarehouseProvider.find_by(tenant_id: 2)
    base_templates = master_provider&.warehouse_folders || WarehouseProvider::DEFAULT_WAREHOUSE_FOLDERS

    updated = 0
    skipped = 0

    WarehouseFolder.find_each do |tab|
      # Skip if already has a custom warehouse_folder set
      if tab.warehouse_folder.present?
        skipped += 1
        next
      end

      # Get base template for this warehouse_type
      base_template = base_templates[tab.warehouse_type]
      next unless base_template.present?

      # Build full path by substituting {{TabName}} with display_name
      full_path = base_template.gsub('{{TabName}}', tab.display_name.to_s)

      # Store the complete path
      tab.update_column(:warehouse_folder, full_path)
      updated += 1
    end

    say "Updated #{updated} tabs with full warehouse_folder paths (#{skipped} already had custom paths)"
  end

  def down
    # Clear all warehouse_folder values (revert to derived mode)
    WarehouseFolder.where.not(warehouse_folder: nil).update_all(warehouse_folder: nil)
  end
end
