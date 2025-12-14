class CreateBpmnWorkflowSystem < ActiveRecord::Migration[8.0]
  def change
    # 1. BPMN Process Definitions
    create_table :bpmn_processes do |t|
      t.references :workflow_definition, foreign_key: true, null: true
      t.string :name, null: false
      t.text :description
      t.integer :version, default: 1
      t.text :bpmn_xml
      t.jsonb :canvas_data, default: {}
      t.boolean :is_published, default: false
      t.datetime :published_at

      t.timestamps
    end

    add_index :bpmn_processes, :is_published
    add_index :bpmn_processes, :name

    # 2. BPMN Nodes (tasks, gateways, events)
    create_table :bpmn_nodes do |t|
      t.references :bpmn_process, null: false, foreign_key: { on_delete: :cascade }
      t.string :node_type, null: false
      t.string :node_key, null: false
      t.string :name
      t.text :description
      t.float :position_x, default: 0
      t.float :position_y, default: 0
      t.jsonb :config, default: {}

      t.timestamps
    end

    add_index :bpmn_nodes, [ :bpmn_process_id, :node_key ], unique: true
    add_index :bpmn_nodes, :node_type

    # 3. BPMN Edges (sequence flows)
    create_table :bpmn_edges do |t|
      t.references :bpmn_process, null: false, foreign_key: { on_delete: :cascade }
      t.string :edge_key, null: false
      t.references :source_node, null: false, foreign_key: { to_table: :bpmn_nodes, on_delete: :cascade }
      t.references :target_node, null: false, foreign_key: { to_table: :bpmn_nodes, on_delete: :cascade }
      t.string :name
      t.text :condition_expression
      t.boolean :is_default, default: false
      t.jsonb :style, default: {}

      t.timestamps
    end

    add_index :bpmn_edges, [ :bpmn_process_id, :edge_key ], unique: true
    # Note: source_node_id and target_node_id indexes created automatically by t.references

    # 4. BPMN Process Instances (running workflows)
    create_table :bpmn_process_instances do |t|
      t.references :bpmn_process, null: false, foreign_key: true
      t.references :workflow_instance, foreign_key: true, null: true
      t.string :subject_type, null: false
      t.bigint :subject_id, null: false
      t.string :status, default: "active"
      t.datetime :started_at
      t.datetime :completed_at
      t.jsonb :variables, default: {}
      t.text :error_message

      t.timestamps
    end

    add_index :bpmn_process_instances, [ :subject_type, :subject_id ]
    add_index :bpmn_process_instances, :status

    # 5. BPMN Tokens (execution state for parallel branches)
    create_table :bpmn_tokens do |t|
      t.references :bpmn_process_instance, null: false, foreign_key: { on_delete: :cascade }
      t.references :current_node, null: false, foreign_key: { to_table: :bpmn_nodes }
      t.references :parent_token, foreign_key: { to_table: :bpmn_tokens }, null: true
      t.string :status, default: "active"
      t.datetime :arrived_at
      t.datetime :completed_at
      t.jsonb :data, default: {}

      t.timestamps
    end

    add_index :bpmn_tokens, :status

    # 6. BPMN Task Instances (work items)
    create_table :bpmn_task_instances do |t|
      t.references :bpmn_token, null: false, foreign_key: { on_delete: :cascade }
      t.references :bpmn_node, null: false, foreign_key: true
      t.string :task_type, null: false
      t.string :status, default: "pending"
      t.string :assigned_to_type
      t.bigint :assigned_to_id
      t.datetime :due_date
      t.datetime :started_at
      t.datetime :completed_at
      t.jsonb :form_data, default: {}
      t.jsonb :execution_result, default: {}
      t.text :error_message
      t.integer :retry_count, default: 0

      t.timestamps
    end

    add_index :bpmn_task_instances, :status
    add_index :bpmn_task_instances, [ :assigned_to_type, :assigned_to_id ]

    # 7. BPMN Triggers
    create_table :bpmn_triggers do |t|
      t.references :bpmn_process, null: false, foreign_key: { on_delete: :cascade }
      t.string :trigger_type, null: false
      t.string :name, null: false
      t.boolean :is_active, default: true
      t.jsonb :config, default: {}

      t.timestamps
    end

    add_index :bpmn_triggers, [ :bpmn_process_id, :trigger_type ]
    add_index :bpmn_triggers, :is_active
  end
end
