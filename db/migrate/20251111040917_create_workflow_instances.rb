class CreateWorkflowInstances < ActiveRecord::Migration[8.0]
  def change
    create_table :workflow_instances do |t|
      t.references :workflow_definition, null: false, foreign_key: true
      t.references :subject, polymorphic: true, null: false
      t.string :status, null: false, default: 'pending'
      t.string :current_step
      t.datetime :started_at
      t.datetime :completed_at
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :workflow_instances, :status
    add_index :workflow_instances, [ :subject_type, :subject_id ]
  end
end
