# frozen_string_literal: true

# Rename confusing storage terminology to consistent "warehouse" naming
#
# StorageConfiguration:
#   - templates → warehouse_folder_templates
#   - scope_root_folders → warehouse_root_folders
#   - virtual_scopes → virtual_warehouses
#   - scope_options (DELETE) → exclude_sm_tasks (boolean)
#
# EntityTab:
#   - scope → warehouse_type
#   - has_storage_folder → warehouse_enabled
#   - storage_folder_path → warehouse_folder
#   - storage_path_type → warehouse_type_override
#
class RenameStorageToWarehouseTerminology < ActiveRecord::Migration[8.0]
  def change
    # ================================
    # StorageConfiguration
    # ================================
    rename_column :storage_configurations, :templates, :warehouse_folder_templates
    rename_column :storage_configurations, :scope_root_folders, :warehouse_root_folders
    rename_column :storage_configurations, :virtual_scopes, :virtual_warehouses

    # Replace scope_options JSONB with simple exclude_sm_tasks boolean
    # Migrate data: scope_options.task.exclude_sm_linked → exclude_sm_tasks
    reversible do |dir|
      dir.up do
        # Add the new boolean column
        add_column :storage_configurations, :exclude_sm_tasks, :boolean, default: false, null: false

        # Migrate data from scope_options if present
        execute <<-SQL.squish
          UPDATE storage_configurations
          SET exclude_sm_tasks = (scope_options->'task'->>'exclude_sm_linked')::boolean
          WHERE scope_options->'task'->>'exclude_sm_linked' IS NOT NULL
        SQL

        # Remove the old scope_options column
        remove_column :storage_configurations, :scope_options
      end

      dir.down do
        # Re-add scope_options column
        add_column :storage_configurations, :scope_options, :jsonb, default: {}, null: false

        # Migrate data back
        execute <<-SQL.squish
          UPDATE storage_configurations
          SET scope_options = jsonb_build_object('task', jsonb_build_object('exclude_sm_linked', exclude_sm_tasks))
          WHERE exclude_sm_tasks = true
        SQL

        # Remove the boolean column
        remove_column :storage_configurations, :exclude_sm_tasks
      end
    end

    # ================================
    # EntityTab
    # ================================
    rename_column :entity_tabs, :scope, :warehouse_type
    rename_column :entity_tabs, :has_storage_folder, :warehouse_enabled
    rename_column :entity_tabs, :storage_folder_path, :warehouse_folder
    rename_column :entity_tabs, :storage_path_type, :warehouse_type_override

    # Update indexes that reference the renamed columns
    # First remove old indexes (check by name since column was renamed)
    remove_index :entity_tabs, name: "index_entity_tabs_on_scope" if index_name_exists?(:entity_tabs, "index_entity_tabs_on_scope")
    remove_index :entity_tabs, name: "index_entity_tabs_on_scope_and_enabled" if index_name_exists?(:entity_tabs, "index_entity_tabs_on_scope_and_enabled")
    remove_index :entity_tabs, name: "index_entity_tabs_on_scope_and_tab_group" if index_name_exists?(:entity_tabs, "index_entity_tabs_on_scope_and_tab_group")
    # Don't remove idx_entity_tabs_unique_key - it will be recreated with same name

    # Add new indexes with updated column names (only if they don't exist)
    unless index_name_exists?(:entity_tabs, "index_entity_tabs_on_warehouse_type")
      add_index :entity_tabs, :warehouse_type, name: "index_entity_tabs_on_warehouse_type"
    end
    unless index_name_exists?(:entity_tabs, "index_entity_tabs_on_warehouse_type_and_enabled")
      add_index :entity_tabs, [:warehouse_type, :enabled], name: "index_entity_tabs_on_warehouse_type_and_enabled"
    end
    unless index_name_exists?(:entity_tabs, "index_entity_tabs_on_warehouse_type_and_tab_group")
      add_index :entity_tabs, [:warehouse_type, :tab_group], name: "index_entity_tabs_on_warehouse_type_and_tab_group"
    end
    # Recreate unique key index only if it doesn't exist (may have been auto-renamed)
    unless index_name_exists?(:entity_tabs, "idx_entity_tabs_unique_key")
      add_index :entity_tabs, [:warehouse_type, :tab_key, :job_id, :parent_id], unique: true, name: "idx_entity_tabs_unique_key"
    end
  end
end
