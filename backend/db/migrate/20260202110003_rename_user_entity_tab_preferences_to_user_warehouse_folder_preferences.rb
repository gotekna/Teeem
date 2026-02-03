# frozen_string_literal: true

# SSoT Rename: EntityTab → WarehouseFolder (Feb 2026)
# Part of the codebase cleanup to use WarehouseFolder consistently
class RenameUserEntityTabPreferencesToUserWarehouseFolderPreferences < ActiveRecord::Migration[8.0]
  def change
    rename_table :user_entity_tab_preferences, :user_warehouse_folder_preferences
  end
end
