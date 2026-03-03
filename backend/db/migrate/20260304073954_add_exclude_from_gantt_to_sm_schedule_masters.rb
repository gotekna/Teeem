class AddExcludeFromGanttToSmScheduleMasters < ActiveRecord::Migration[7.2]
  def change
    add_column :sm_schedule_masters, :exclude_from_gantt, :boolean, default: false, null: false
  end
end
