# frozen_string_literal: true

# Add 'Charity' to entity_filters for key corporate overview sub-tabs
#
# Info, Corporate, and Directors sub-tabs should be visible for Charity entities.
# Without this, Charity entities only see the Directors sub-tab, and once they
# navigate there, they can't get back to the Info content.
class AddCharityToOverviewSubtabs < ActiveRecord::Migration[8.0]
  def up
    # Add 'Charity' to info and corporate sub-tabs that currently have
    # ['Company', 'Trust', 'Superfund'] but are missing 'Charity'
    %w[info corporate].each do |key|
      execute(<<-SQL.squish)
        UPDATE warehouse_folders
        SET entity_filters = array_append(entity_filters, 'Charity')
        WHERE tab_key = '#{key}'
          AND parent_id IN (
            SELECT wf.id FROM warehouse_folders wf
            INNER JOIN warehouse_types wt ON wf.warehouse_type_id = wt.id
            WHERE wt.code = 'corporate'
              AND wf.tab_key = 'overview'
              AND wf.parent_id IS NULL
          )
          AND NOT (entity_filters @> ARRAY['Charity']::varchar[])
      SQL
    end

    puts "[AddCharityToSubtabs] Added 'Charity' to info and corporate overview sub-tabs"
  end

  def down
    %w[info corporate].each do |key|
      execute(<<-SQL.squish)
        UPDATE warehouse_folders
        SET entity_filters = array_remove(entity_filters, 'Charity')
        WHERE tab_key = '#{key}'
          AND parent_id IN (
            SELECT wf.id FROM warehouse_folders wf
            INNER JOIN warehouse_types wt ON wf.warehouse_type_id = wt.id
            WHERE wt.code = 'corporate'
              AND wf.tab_key = 'overview'
              AND wf.parent_id IS NULL
          )
      SQL
    end
  end
end
