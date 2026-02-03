# frozen_string_literal: true

# Fix: Asset Document Storage Under Specific Assets
#
# Problem: Asset-related folders (Service, Readings, Expenses) appeared as separate root folders
# in File Warehouse. They need to be stored under specific assets:
#   Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}/[DocType]
#
# This migration also fixes task_responses path template.
#
class FixAssetWarehouseFolderPaths < ActiveRecord::Migration[7.1]
  def up
    # Fix asset_expenses path - should be under specific asset
    execute <<~SQL
      UPDATE warehouse_folders
      SET warehouse_folder = 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}/Expenses',
          root_folder = 'Corporate'
      WHERE warehouse_type = 'asset_expenses'
    SQL

    # Fix asset_service path - should be under specific asset
    execute <<~SQL
      UPDATE warehouse_folders
      SET warehouse_folder = 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}/Service',
          root_folder = 'Corporate'
      WHERE warehouse_type = 'asset_service'
    SQL

    # Fix asset_readings path - should be under specific asset
    execute <<~SQL
      UPDATE warehouse_folders
      SET warehouse_folder = 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}/Readings',
          root_folder = 'Corporate'
      WHERE warehouse_type = 'asset_readings'
    SQL

    # Fix task_responses path - should include TaskName
    execute <<~SQL
      UPDATE warehouse_folders
      SET warehouse_folder = 'Tasks/{{TaskId}}/{{TaskName}}/Responses',
          root_folder = 'Tasks'
      WHERE warehouse_type = 'task_responses'
    SQL

    # Also create asset warehouse_type entries if they don't exist
    # These define the main "Assets" folder under Corporate
    unless WarehouseFolder.exists?(warehouse_type: 'asset', tab_key: 'overview')
      execute <<~SQL
        INSERT INTO warehouse_folders (
          warehouse_type, tab_key, display_name, tab_group, order_position,
          enabled, is_system_tab, warehouse_enabled, warehouse_folder, root_folder,
          created_at, updated_at
        ) VALUES (
          'asset', 'overview', 'Overview', 'overview', 0,
          true, true, true, 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}', 'Corporate',
          NOW(), NOW()
        )
      SQL
    end

    Rails.logger.info "[Migration] Fixed asset warehouse folder paths to include {{AssetName}} token"
  end

  def down
    # Revert to previous paths (without {{AssetName}})
    execute <<~SQL
      UPDATE warehouse_folders
      SET warehouse_folder = 'Expenses',
          root_folder = 'Expenses'
      WHERE warehouse_type = 'asset_expenses'
    SQL

    execute <<~SQL
      UPDATE warehouse_folders
      SET warehouse_folder = 'Service',
          root_folder = 'Service'
      WHERE warehouse_type = 'asset_service'
    SQL

    execute <<~SQL
      UPDATE warehouse_folders
      SET warehouse_folder = 'Readings',
          root_folder = 'Readings'
      WHERE warehouse_type = 'asset_readings'
    SQL

    execute <<~SQL
      UPDATE warehouse_folders
      SET warehouse_folder = 'Responses',
          root_folder = 'Responses'
      WHERE warehouse_type = 'task_responses'
    SQL

    # Remove asset overview if we created it
    execute <<~SQL
      DELETE FROM warehouse_folders
      WHERE warehouse_type = 'asset' AND tab_key = 'overview'
    SQL
  end
end
