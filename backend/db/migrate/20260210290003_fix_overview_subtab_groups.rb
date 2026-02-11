# frozen_string_literal: true

# Fix: Corporate overview sub-tab children should have tab_group='overview'
#
# The sync_booleans_from_tab_type callback auto-set tab_group='data' for system
# tabs, but overview sub-tabs (info, corporate, directors, etc.) need
# tab_group='overview' so the frontend can identify them as sub-tabs of Overview.
#
# Also updates directors entity_filters to include Charity and Superfund.
class FixOverviewSubtabGroups < ActiveRecord::Migration[8.0]
  def up
    # Update all children of corporate overview parent tabs to tab_group='overview'
    updated = execute(<<-SQL.squish)
      UPDATE warehouse_folders
      SET tab_group = 'overview'
      WHERE parent_id IN (
        SELECT wf.id FROM warehouse_folders wf
        INNER JOIN warehouse_types wt ON wf.warehouse_type_id = wt.id
        WHERE wt.code = 'corporate'
          AND wf.tab_key = 'overview'
          AND wf.parent_id IS NULL
      )
      AND tab_group != 'overview'
    SQL

    # Update directors entity_filters to include Charity and Superfund
    execute(<<-SQL.squish)
      UPDATE warehouse_folders
      SET entity_filters = ARRAY['Company', 'Charity', 'Superfund']::varchar[]
      WHERE tab_key = 'directors'
        AND parent_id IN (
          SELECT wf.id FROM warehouse_folders wf
          INNER JOIN warehouse_types wt ON wf.warehouse_type_id = wt.id
          WHERE wt.code = 'corporate'
            AND wf.tab_key = 'overview'
            AND wf.parent_id IS NULL
        )
        AND NOT (entity_filters @> ARRAY['Charity']::varchar[])
    SQL

    puts "[FixOverviewSubtabGroups] Updated overview sub-tab groups to 'overview' and directors entity_filters"
  end

  def down
    execute(<<-SQL.squish)
      UPDATE warehouse_folders
      SET tab_group = 'data'
      WHERE parent_id IN (
        SELECT wf.id FROM warehouse_folders wf
        INNER JOIN warehouse_types wt ON wf.warehouse_type_id = wt.id
        WHERE wt.code = 'corporate'
          AND wf.tab_key = 'overview'
          AND wf.parent_id IS NULL
      )
      AND tab_group = 'overview'
    SQL
  end
end
