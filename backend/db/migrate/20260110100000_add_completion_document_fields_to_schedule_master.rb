# frozen_string_literal: true

class AddCompletionDocumentFieldsToScheduleMaster < ActiveRecord::Migration[7.1]
  def change
    # Add completion document requirement fields to sm_schedule_masters (template)
    add_column :sm_schedule_masters, :requires_document_to_complete, :boolean, default: false
    add_reference :sm_schedule_masters, :completion_document_type, foreign_key: { to_table: :document_types }, null: true

    # Add completion document requirement fields to sm_tasks (job instances)
    add_column :sm_tasks, :requires_document_to_complete, :boolean, default: false
    add_reference :sm_tasks, :completion_document_type, foreign_key: { to_table: :document_types }, null: true
  end
end
