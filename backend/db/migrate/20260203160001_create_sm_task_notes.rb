class CreateSmTaskNotes < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_task_notes do |t|
      t.references :sm_task, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.text :content, null: false

      t.timestamps
    end

    # Index for fetching notes by task ordered by created_at desc
    add_index :sm_task_notes, [:sm_task_id, :created_at], order: { created_at: :desc }
  end
end
