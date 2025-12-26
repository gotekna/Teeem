class RemovePhotoEntityAndPlanTypeFields < ActiveRecord::Migration[8.0]
  def change
    # Remove from template (sm_schedule_master)
    # These are redundant - documentation_category_ids handles doc linking
    remove_column :sm_schedule_master, :plan_type_ids, :integer, array: true
    remove_column :sm_schedule_master, :photo_entity_tab_id, :bigint

    # Remove from job tasks (sm_tasks)
    remove_column :sm_tasks, :photo_entity_tab_id, :bigint
  end
end
