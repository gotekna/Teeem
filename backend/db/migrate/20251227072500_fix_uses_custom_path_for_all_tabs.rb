class FixUsesCustomPathForAllTabs < ActiveRecord::Migration[8.0]
  def up
    # Any tab with a non-empty sharepoint_folder_path is using a custom path
    # The previous migration only detected paths with {{ placeholders
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
