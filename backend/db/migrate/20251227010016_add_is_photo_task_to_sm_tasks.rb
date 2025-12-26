class AddIsPhotoTaskToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :is_photo_task, :boolean, default: false, null: false
  end
end
