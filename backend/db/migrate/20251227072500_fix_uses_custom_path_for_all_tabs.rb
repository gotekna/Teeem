class FixUsesCustomPathForAllTabs < ActiveRecord::Migration[8.0]
  def up
    # SSoT Fix: If sharepoint_folder_path is set, has_sharepoint_folder MUST be true
    # This fixes tabs that have paths but the folder flag was not set
    execute <<-SQL
      UPDATE entity_tabs
      SET has_sharepoint_folder = true, uses_custom_path = true
      WHERE sharepoint_folder_path IS NOT NULL
        AND sharepoint_folder_path != ''
        AND has_sharepoint_folder = false
    SQL

    # Also mark remaining tabs with paths as custom (for tabs already with has_sharepoint_folder=true)
    execute <<-SQL
      UPDATE entity_tabs
      SET uses_custom_path = true
      WHERE has_sharepoint_folder = true
        AND sharepoint_folder_path IS NOT NULL
        AND sharepoint_folder_path != ''
        AND uses_custom_path = false
    SQL
  end

  def down
    # No rollback needed - data correction only
  end
end
