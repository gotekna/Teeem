class AddWorkflowFieldsAndDocumentTypeLinksToScheduleMaster < ActiveRecord::Migration[8.0]
  def change
    # Add workflow fields to sm_schedule_masters
    add_column :sm_schedule_masters, :start_workflow_enabled, :boolean, default: false
    add_reference :sm_schedule_masters, :start_workflow, foreign_key: { to_table: :bpmn_processes }
    add_column :sm_schedule_masters, :complete_workflow_enabled, :boolean, default: false
    add_reference :sm_schedule_masters, :complete_workflow, foreign_key: { to_table: :bpmn_processes }

    # Add workflow fields to sm_tasks
    add_column :sm_tasks, :start_workflow_enabled, :boolean, default: false
    add_reference :sm_tasks, :start_workflow, foreign_key: { to_table: :bpmn_processes }
    add_column :sm_tasks, :complete_workflow_enabled, :boolean, default: false
    add_reference :sm_tasks, :complete_workflow, foreign_key: { to_table: :bpmn_processes }
    add_column :sm_tasks, :start_workflow_fired, :boolean, default: false

    # Create join table for SmScheduleMaster <-> DocumentType
    create_table :sm_schedule_master_document_types do |t|
      t.references :sm_schedule_master, null: false, foreign_key: true
      t.references :document_type, null: false, foreign_key: true
      t.integer :lag_days, default: 0
      t.string :assigned_role
      t.timestamps
    end

    add_index :sm_schedule_master_document_types,
              [ :sm_schedule_master_id, :document_type_id ],
              unique: true,
              name: "idx_sm_master_doc_type_unique"

    # Create join table for SmTask <-> DocumentType
    create_table :sm_task_document_types do |t|
      t.references :sm_task, null: false, foreign_key: true
      t.references :document_type, null: false, foreign_key: true
      t.integer :lag_days, default: 0
      t.string :assigned_role
      t.timestamps
    end

    add_index :sm_task_document_types,
              [ :sm_task_id, :document_type_id ],
              unique: true,
              name: "idx_sm_task_doc_type_unique"

    # Remove deprecated documentation_category_ids columns
    remove_column :sm_schedule_masters, :documentation_category_ids, :integer, array: true, default: []
    remove_column :sm_tasks, :documentation_category_ids, :integer, array: true, default: []
  end
end
