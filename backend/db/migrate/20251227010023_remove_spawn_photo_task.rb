class RemoveSpawnPhotoTask < ActiveRecord::Migration[8.0]
  def change
    # Remove spawn_photo_task - photos handled elsewhere
    remove_column :sm_schedule_master, :spawn_photo_task, :boolean
    remove_column :sm_tasks, :spawn_photo_task, :boolean
  end
end
