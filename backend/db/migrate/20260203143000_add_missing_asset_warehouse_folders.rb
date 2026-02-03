# frozen_string_literal: true

# Fix: Add missing warehouse_folders for asset document types
#
# The previous migration only updated existing rows but didn't create them.
# Staging/Production are missing: asset_expenses, asset_service, asset_readings, task_responses
#
class AddMissingAssetWarehouseFolders < ActiveRecord::Migration[7.1]
  def up
    # Insert asset_expenses if not exists
    unless WarehouseFolder.exists?(warehouse_type: 'asset_expenses')
      execute <<~SQL
        INSERT INTO warehouse_folders (
          warehouse_type, tab_key, display_name, tab_group, order_position,
          enabled, is_system_tab, warehouse_enabled, warehouse_folder, root_folder,
          created_at, updated_at
        ) VALUES (
          'asset_expenses', 'expenses', 'Asset Expenses', 'corporate', 10,
          true, true, true, 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}/Expenses', 'Corporate',
          NOW(), NOW()
        )
      SQL
      Rails.logger.info "[Migration] Created asset_expenses warehouse folder"
    end

    # Insert asset_service if not exists
    unless WarehouseFolder.exists?(warehouse_type: 'asset_service')
      execute <<~SQL
        INSERT INTO warehouse_folders (
          warehouse_type, tab_key, display_name, tab_group, order_position,
          enabled, is_system_tab, warehouse_enabled, warehouse_folder, root_folder,
          created_at, updated_at
        ) VALUES (
          'asset_service', 'service', 'Asset Service', 'corporate', 11,
          true, true, true, 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}/Service', 'Corporate',
          NOW(), NOW()
        )
      SQL
      Rails.logger.info "[Migration] Created asset_service warehouse folder"
    end

    # Insert asset_readings if not exists
    unless WarehouseFolder.exists?(warehouse_type: 'asset_readings')
      execute <<~SQL
        INSERT INTO warehouse_folders (
          warehouse_type, tab_key, display_name, tab_group, order_position,
          enabled, is_system_tab, warehouse_enabled, warehouse_folder, root_folder,
          created_at, updated_at
        ) VALUES (
          'asset_readings', 'readings', 'Asset Readings', 'corporate', 12,
          true, true, true, 'Corporate/{{CompanyGroup}}/{{CompanyCode}}/Assets/{{AssetName}}/Readings', 'Corporate',
          NOW(), NOW()
        )
      SQL
      Rails.logger.info "[Migration] Created asset_readings warehouse folder"
    end

    # Insert task_responses if not exists
    unless WarehouseFolder.exists?(warehouse_type: 'task_responses')
      execute <<~SQL
        INSERT INTO warehouse_folders (
          warehouse_type, tab_key, display_name, tab_group, order_position,
          enabled, is_system_tab, warehouse_enabled, warehouse_folder, root_folder,
          created_at, updated_at
        ) VALUES (
          'task_responses', 'responses', 'Task Responses', 'tasks', 3,
          true, true, true, 'Tasks/{{TaskId}}/{{TaskName}}/Responses', 'Tasks',
          NOW(), NOW()
        )
      SQL
      Rails.logger.info "[Migration] Created task_responses warehouse folder"
    end

    Rails.logger.info "[Migration] Asset warehouse folders check complete"
  end

  def down
    # Remove the folders we created (only if they match our exact config)
    execute <<~SQL
      DELETE FROM warehouse_folders
      WHERE warehouse_type IN ('asset_expenses', 'asset_service', 'asset_readings', 'task_responses')
    SQL
  end
end
