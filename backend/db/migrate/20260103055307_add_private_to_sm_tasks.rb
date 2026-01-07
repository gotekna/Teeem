class AddPrivateToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :is_private, :boolean, default: false
    add_index :sm_tasks, :is_private
  end
end
