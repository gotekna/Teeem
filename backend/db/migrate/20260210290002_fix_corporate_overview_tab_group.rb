# frozen_string_literal: true

# Fix: Corporate overview parent tab_group should be 'main', not 'data'
#
# The sync_booleans_from_tab_type callback auto-derives tab_group='data' for
# system tabs, but the frontend corporate page expects tab_group='main' to
# identify the Overview parent and render its sub-tab navigation (Info,
# Corporate, Directors, Shareholdings, etc.).
#
# Without this, computedOverviewTabs is always empty and sub-tab nav never renders.
class FixCorporateOverviewTabGroup < ActiveRecord::Migration[8.0]
  def up
    # Update overview parent tabs for corporate warehouse_type across all tenants
    execute(<<-SQL.squish)
      UPDATE warehouse_folders
      SET tab_group = 'main'
      WHERE tab_key = 'overview'
        AND parent_id IS NULL
        AND warehouse_type_id IN (SELECT id FROM warehouse_types WHERE code = 'corporate')
        AND tab_group != 'main'
    SQL

    count = execute("SELECT COUNT(*) as cnt FROM warehouse_folders WHERE tab_key = 'overview' AND parent_id IS NULL AND warehouse_type_id IN (SELECT id FROM warehouse_types WHERE code = 'corporate') AND tab_group = 'main'").first["cnt"]
    puts "[FixOverviewTabGroup] Updated #{count} corporate overview tab(s) to tab_group='main'"
  end

  def down
    execute(<<-SQL.squish)
      UPDATE warehouse_folders
      SET tab_group = 'data'
      WHERE tab_key = 'overview'
        AND parent_id IS NULL
        AND warehouse_type_id IN (SELECT id FROM warehouse_types WHERE code = 'corporate')
        AND tab_group = 'main'
    SQL
  end
end
