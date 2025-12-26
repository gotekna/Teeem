class AddPhotoEntityTabIdToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :photo_entity_tab_id, :bigint
    add_index :sm_tasks, :photo_entity_tab_id
  end
end
