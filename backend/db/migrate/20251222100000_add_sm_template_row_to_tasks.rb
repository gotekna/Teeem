# frozen_string_literal: true

# Migration to add sm_template_row_id to tasks table
# This is part of the SSoT consolidation from ScheduleTemplateRow to SmTemplateRow
#
# The old template_row_id pointed to schedule_template_rows (deprecated)
# The new sm_template_row_id points to sm_template_rows (THE SSoT)
#
class AddSmTemplateRowToTasks < ActiveRecord::Migration[8.0]
  def change
    add_reference :tasks, :sm_template_row, null: true, foreign_key: true

    # Add index for efficient lookups
    add_index :tasks, :sm_template_row_id, name: "index_tasks_on_sm_template_row_id", if_not_exists: true
  end
end
