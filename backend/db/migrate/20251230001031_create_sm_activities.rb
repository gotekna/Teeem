class CreateSmActivities < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_activities do |t|
      t.references :job, null: false, foreign_key: true
      t.references :user, null: true, foreign_key: true
      t.references :resource, null: true, foreign_key: { to_table: :sm_resources }
      t.bigint :sm_task_id, null: true
      t.bigint :construction_id, null: true
      t.string :activity_type, null: false
      t.references :trackable, polymorphic: true, null: true
      t.text :metadata

      t.timestamps
    end

    add_index :sm_activities, :sm_task_id
    add_index :sm_activities, :construction_id
    add_index :sm_activities, :activity_type
    add_index :sm_activities, :created_at
    add_foreign_key :sm_activities, :sm_tasks, column: :sm_task_id, on_delete: :nullify
  end
end
