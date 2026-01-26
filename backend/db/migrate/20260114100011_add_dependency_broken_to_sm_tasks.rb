class AddDependencyBrokenToSmTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :sm_tasks, :dependency_broken, :boolean, default: false
    add_column :sm_tasks, :predecessor_ids_backup, :jsonb, default: []
    add_column :sm_tasks, :dependency_broken_at, :datetime
    add_column :sm_tasks, :dependency_broken_by_id, :bigint

    add_index :sm_tasks, :dependency_broken, where: "(dependency_broken = true)"
    add_index :sm_tasks, :dependency_broken_by_id
  end
end
