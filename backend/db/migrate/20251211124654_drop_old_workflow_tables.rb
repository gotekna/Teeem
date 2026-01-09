class DropOldWorkflowTables < ActiveRecord::Migration[8.0]
  def up
    # Remove any foreign key constraints referencing old workflow tables first
    if foreign_key_exists?(:bpmn_process_instances, :workflow_instances)
      remove_foreign_key :bpmn_process_instances, :workflow_instances
    end

    # Drop old workflow tables - replaced by BPMN workflow engine
    drop_table :workflow_steps, force: :cascade if table_exists?(:workflow_steps)
    drop_table :workflow_instances, force: :cascade if table_exists?(:workflow_instances)
    drop_table :workflow_definitions, force: :cascade if table_exists?(:workflow_definitions)
  end

  def down
    # Re-create tables if needed (for rollback)
    create_table :workflow_definitions do |t|
      t.string :name, null: false
      t.text :description
      t.string :entity_type
      t.jsonb :steps_config, default: []
      t.boolean :active, default: true
      t.timestamps
    end

    create_table :workflow_instances do |t|
      t.references :workflow_definition, null: false, foreign_key: true
      t.string :entity_type, null: false
      t.bigint :entity_id, null: false
      t.string :status, default: 'pending'
      t.integer :current_step, default: 0
      t.jsonb :metadata, default: {}
      t.timestamps
    end

    create_table :workflow_steps do |t|
      t.references :workflow_instance, null: false, foreign_key: true
      t.integer :step_number, null: false
      t.string :step_type, null: false
      t.string :status, default: 'pending'
      t.references :assigned_to, foreign_key: { to_table: :users }
      t.text :notes
      t.datetime :completed_at
      t.jsonb :metadata, default: {}
      t.timestamps
    end
  end
end
