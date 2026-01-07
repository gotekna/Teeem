class CreateTaskViewers < ActiveRecord::Migration[8.0]
  def change
    create_table :task_viewers do |t|
      t.references :user, null: false, foreign_key: true
      t.references :sm_task, null: false, foreign_key: true

      t.timestamps
    end

    add_index :task_viewers, [:user_id, :sm_task_id], unique: true
  end
end
