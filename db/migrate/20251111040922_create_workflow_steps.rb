class CreateWorkflowSteps < ActiveRecord::Migration[8.0]
  def change
    create_table :workflow_steps do |t|
      t.references :workflow_instance, null: false, foreign_key: true
      t.string :step_name, null: false
      t.string :status, null: false, default: 'pending'
      t.references :assigned_to, polymorphic: true
      t.datetime :started_at
      t.datetime :completed_at
      t.jsonb :data, default: {}
      t.text :comment

      t.timestamps
    end

    add_index :workflow_steps, :status
    add_index :workflow_steps, [ :assigned_to_type, :assigned_to_id ]
  end
end
