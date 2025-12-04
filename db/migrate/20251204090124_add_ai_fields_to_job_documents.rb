# frozen_string_literal: true

class AddAiFieldsToJobDocuments < ActiveRecord::Migration[8.0]
  def change
    # AI analysis results
    add_column :job_documents, :ai_suggested_type_id, :bigint
    add_column :job_documents, :ai_proposed_name, :string
    add_column :job_documents, :ai_confidence, :decimal, precision: 5, scale: 2
    add_column :job_documents, :ai_reasoning, :text
    add_column :job_documents, :ai_analyzed_at, :datetime

    # Rename approval workflow
    add_column :job_documents, :rename_status, :string, default: 'pending'
    add_column :job_documents, :rename_approved_at, :datetime
    add_column :job_documents, :rename_approved_by_id, :bigint
    add_column :job_documents, :original_file_name, :string

    # Indexes for efficient queries
    add_index :job_documents, :ai_suggested_type_id
    add_index :job_documents, :rename_status
    add_index :job_documents, :ai_analyzed_at

    # Foreign key to document_types
    add_foreign_key :job_documents, :document_types, column: :ai_suggested_type_id, on_delete: :nullify
    add_foreign_key :job_documents, :users, column: :rename_approved_by_id, on_delete: :nullify
  end
end
