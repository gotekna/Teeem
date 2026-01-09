class CreateTaskFollowers < ActiveRecord::Migration[8.0]
  def change
    create_table :task_followers do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :sm_task, null: false, foreign_key: { on_delete: :cascade }
      t.datetime :followed_at, null: false, default: -> { "CURRENT_TIMESTAMP" }

      t.timestamps
    end

    # Ensure a user can only follow a task once
    add_index :task_followers, [:user_id, :sm_task_id], unique: true
  end
end
