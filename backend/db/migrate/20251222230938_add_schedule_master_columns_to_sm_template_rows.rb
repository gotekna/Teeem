class AddScheduleMasterColumnsToSmTemplateRows < ActiveRecord::Migration[8.0]
  def change
    # Manual If Required - false means task only added manually
    add_column :sm_template_rows, :auto_include, :boolean, default: true

    # Multiple - can add same task multiple times with auto-numbering
    add_column :sm_template_rows, :allow_duplicates, :boolean, default: false

    # AI Select - AI auto-selection for task
    add_column :sm_template_rows, :ai_select, :boolean, default: false

    # Attach Plan - which plan types to attach (multi-select from PlanType)
    add_column :sm_template_rows, :plan_type_ids, :jsonb, default: []

    # Document EntityTabs - docs sent on START
    add_column :sm_template_rows, :start_entity_tab_ids, :jsonb, default: []

    # Document EntityTabs - docs received on COMPLETE
    add_column :sm_template_rows, :complete_entity_tab_ids, :jsonb, default: []

    # Photo storage EntityTab
    add_column :sm_template_rows, :photo_entity_tab_id, :bigint

    # Link to PO - parent task for PO hierarchy
    add_column :sm_template_rows, :linked_po_task_id, :integer

    # Add index for linked_po_task_id lookups
    add_index :sm_template_rows, :linked_po_task_id
  end
end
