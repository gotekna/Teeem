# SSoT: Consolidate is_system_tab into is_system (Feb 2026)
# is_system is THE ONE boolean for "system-generated, can't delete"
# is_system_tab was a duplicate concept - merge it and remove
class ConsolidateIsSystemTabIntoIsSystem < ActiveRecord::Migration[8.0]
  def up
    # Merge: any folder with is_system_tab=true should also be is_system=true
    execute <<~SQL
      UPDATE warehouse_folders
      SET is_system = true
      WHERE is_system_tab = true AND is_system = false
    SQL

    remove_column :warehouse_folders, :is_system_tab
  end

  def down
    add_column :warehouse_folders, :is_system_tab, :boolean, default: false

    # Best-effort reverse: copy is_system back to is_system_tab
    execute <<~SQL
      UPDATE warehouse_folders
      SET is_system_tab = is_system
    SQL
  end
end
