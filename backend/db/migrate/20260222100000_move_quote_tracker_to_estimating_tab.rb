# Move Quote Tracker sub-tab from PreCon to Estimating
#
# The Quote Tracker was originally placed under PreCon but belongs under Estimating.
# Updates parent_id for all tenants (each tenant has its own warehouse folder tree).
#
# Estimating tab has tab_key='jobs' (root-level, parent_id IS NULL).
class MoveQuoteTrackerToEstimatingTab < ActiveRecord::Migration[7.2]
  def up
    # For each quote-tracker, find the Estimating tab in the same tenant and update parent_id
    execute(<<-SQL.squish)
      UPDATE warehouse_folders qt
      SET parent_id = est.id, updated_at = NOW()
      FROM warehouse_folders est
      WHERE qt.tab_key = 'quote-tracker'
        AND est.tab_key = 'jobs'
        AND est.parent_id IS NULL
        AND est.tenant_id = qt.tenant_id
    SQL

    puts "[MoveQuoteTracker] Moved all quote-tracker tabs to Estimating parent"
  end

  def down
    # Move back: for each quote-tracker, find PreCon in the same tenant
    execute(<<-SQL.squish)
      UPDATE warehouse_folders qt
      SET parent_id = pc.id, updated_at = NOW()
      FROM warehouse_folders pc
      WHERE qt.tab_key = 'quote-tracker'
        AND pc.tab_key = 'precon'
        AND pc.parent_id IS NULL
        AND pc.tenant_id = qt.tenant_id
    SQL

    puts "[MoveQuoteTracker] Moved all quote-tracker tabs back to PreCon parent"
  end
end
