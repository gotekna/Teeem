# frozen_string_literal: true

# Phase 4: Rename sm_template_row_id to sm_schedule_master_id
# Part of the SmTemplateRow -> SmScheduleMaster SSoT rename
class RenameSmTemplateRowIdToSmScheduleMasterId < ActiveRecord::Migration[8.0]
  def change
    # Rename the column
    rename_column :sm_tasks, :sm_template_row_id, :sm_schedule_master_id

    # The index will be automatically renamed by Rails
    # from index_sm_tasks_on_sm_template_row_id
    # to index_sm_tasks_on_sm_schedule_master_id
  end
end
