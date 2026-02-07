# SSoT: Site is now a parent-only tab (no doc types on it)
# Photos moved to Photo → Site child. Convert Site to SYS navigation tab.
class ConvertSiteParentToSystem < ActiveRecord::Migration[8.0]
  def up
    execute <<~SQL
      UPDATE warehouse_folders
      SET tab_type = 'system',
          tab_group = 'data',
          is_photo_category = false
      WHERE tab_key = 'site'
        AND warehouse_type_id = 1
        AND parent_id IS NULL
    SQL
  end

  def down
    execute <<~SQL
      UPDATE warehouse_folders
      SET tab_type = 'photo',
          tab_group = 'documents',
          is_photo_category = true
      WHERE tab_key = 'site'
        AND warehouse_type_id = 1
        AND parent_id IS NULL
    SQL
  end
end
