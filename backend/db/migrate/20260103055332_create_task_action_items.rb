class CreateTaskActionItems < ActiveRecord::Migration[8.0]
  def change
    create_table :task_action_items do |t|
      t.references :sm_task, foreign_key: true, null: false
      t.string :text, null: false
      t.boolean :checked, default: false
      t.integer :position, default: 0
      t.references :checked_by, foreign_key: { to_table: :users }
      t.datetime :checked_at
      t.timestamps
    end
    add_index :task_action_items, [:sm_task_id, :position]
  end
end
