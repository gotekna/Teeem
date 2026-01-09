class RemoveRedundantDocTabFields < ActiveRecord::Migration[8.0]
  def change
    # Remove redundant doc tab fields from template (sm_schedule_master)
    # documentation_category_ids is the SSoT - these are derivable/redundant
    remove_column :sm_schedule_master, :show_in_docs_tab, :boolean
    remove_column :sm_schedule_master, :start_entity_tab_ids, :integer, array: true
    remove_column :sm_schedule_master, :complete_entity_tab_ids, :integer, array: true

    # Remove from job tasks (sm_tasks)
    remove_column :sm_tasks, :show_in_docs_tab, :boolean
  end
end
