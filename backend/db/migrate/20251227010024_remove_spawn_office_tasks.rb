class RemoveSpawnOfficeTasks < ActiveRecord::Migration[8.0]
  def change
    remove_column :sm_schedule_master, :spawn_office_tasks, :jsonb
    remove_column :sm_tasks, :spawn_office_tasks, :jsonb
  end
end
