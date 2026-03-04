# frozen_string_literal: true

# Fix: Root-level system tabs should have tab_group='main', not 'data'
#
# The sync_booleans_from_tab_type callback previously set tab_group='data' for
# ALL system tabs. But root-level system tabs (no parent) are main navigation
# tabs and need tab_group='main' to appear in the corporate/job/contact tab bar.
#
# This affects tabs like "Trust", "Overview", etc. that are root-level system
# tabs but were getting tab_group='data' instead of 'main'.
#
# The callback has been updated to set 'main' for root-level system tabs,
# but existing data needs to be fixed.
class FixRootSystemTabsToMainGroup < ActiveRecord::Migration[8.0]
  def up
    # Fix all root-level system tabs that have tab_group='data' → should be 'main'
    count = execute(<<-SQL.squish).cmd_tuples
      UPDATE warehouse_folders
      SET tab_group = 'main'
      WHERE parent_id IS NULL
        AND tab_type = 'system'
        AND tab_group = 'data'
    SQL

    puts "[FixRootSystemTabs] Updated #{count} root-level system tab(s) from 'data' to 'main'"
  end

  def down
    # Revert: set root-level system tabs back to 'data'
    execute(<<-SQL.squish)
      UPDATE warehouse_folders
      SET tab_group = 'data'
      WHERE parent_id IS NULL
        AND tab_type = 'system'
        AND tab_group = 'main'
    SQL
  end
end
