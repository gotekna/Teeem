class AddUsesCustomPathToEntityTabs < ActiveRecord::Migration[8.0]
  def up
    add_column :entity_tabs, :uses_custom_path, :boolean, default: false, null: false

    # Auto-detect existing custom paths:
    # Tabs with sharepoint_folder_path containing placeholders are likely custom overrides
    execute <<-SQL
      UPDATE entity_tabs
      SET uses_custom_path = true
      WHERE sharepoint_folder_path IS NOT NULL
        AND sharepoint_folder_path != ''
        AND sharepoint_folder_path LIKE '%{{%'
    SQL
  end

  def down
    remove_column :entity_tabs, :uses_custom_path
  end
end
