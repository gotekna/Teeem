# frozen_string_literal: true

# FRC: Sync comparison shows "1408 → 1408" as updates because:
# - sm_schedule_masters.header_gantt is INTEGER (correct)
# - sm_tasks.header_gantt is STRING (wrong)
# - Ruby: 1408 != "1408" → true, so comparison detects "change"
#
# This migration aligns sm_tasks.header_gantt to match sm_schedule_masters.
class FixSmTasksHeaderGanttColumnType < ActiveRecord::Migration[8.0]
  def up
    # Convert existing string values to integers
    # Values are stored as "1408", "626", etc. - just need to cast
    execute <<-SQL
      ALTER TABLE sm_tasks
      ALTER COLUMN header_gantt TYPE integer
      USING NULLIF(header_gantt, '')::integer;
    SQL

    Rails.logger.info "[Migration] Changed sm_tasks.header_gantt from string to integer"
  end

  def down
    execute <<-SQL
      ALTER TABLE sm_tasks
      ALTER COLUMN header_gantt TYPE varchar
      USING header_gantt::varchar;
    SQL
  end
end
