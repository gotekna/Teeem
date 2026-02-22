# frozen_string_literal: true

# Add tender_id to sm_tasks so tender section syncs from SmScheduleMaster template
# to job-level tasks. This enables the Tender Builder to read tender assignments
# directly from SmTask instead of traversing up to SmScheduleMaster.
#
# SSoT: SmScheduleMaster.tender_id is the template source, SmTask.tender_id is the
# job-level copy. The SmScheduleMasterSyncService auto-detects common columns,
# so tender_id will automatically be included in syncs once this column exists.
#
# Note: sync_schema! may have already auto-added this column. Migration is idempotent.
#
# Backfill: Populates tender_id on existing sm_tasks from their linked sm_schedule_masters.
class AddTenderIdToSmTasks < ActiveRecord::Migration[8.0]
  def up
    unless column_exists?(:sm_tasks, :tender_id)
      add_column :sm_tasks, :tender_id, :integer
    end

    unless index_exists?(:sm_tasks, :tender_id)
      add_index :sm_tasks, :tender_id
    end

    # Backfill tender_id from linked sm_schedule_masters
    execute <<-SQL.squish
      UPDATE sm_tasks
      SET tender_id = sm_schedule_masters.tender_id
      FROM sm_schedule_masters
      WHERE sm_tasks.sm_schedule_master_id = sm_schedule_masters.id
        AND sm_schedule_masters.tender_id IS NOT NULL
        AND sm_tasks.tender_id IS NULL
    SQL
  end

  def down
    remove_index :sm_tasks, :tender_id, if_exists: true
    remove_column :sm_tasks, :tender_id, if_exists: true
  end
end
