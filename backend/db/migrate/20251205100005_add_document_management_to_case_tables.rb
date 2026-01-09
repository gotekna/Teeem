class AddDocumentManagementToCaseTables < ActiveRecord::Migration[8.0]
  def change
    # 1. Add content_hash to company_documents (SSoT for all documents)
    add_column :company_documents, :content_hash, :string
    add_index :company_documents, :content_hash

    # 2. Extend case_emails join table
    add_column :case_emails, :short_code, :string
    add_column :case_emails, :display_name, :string
    add_column :case_emails, :has_unanswered_questions, :boolean, default: false

    # 3. Extend case_documents join table
    add_column :case_documents, :short_code, :string
    add_column :case_documents, :source_type, :string
    add_column :case_documents, :original_location, :string
    add_column :case_documents, :action_taken, :string
    add_index :case_documents, :short_code

    # 4. Extend cases table
    add_column :cases, :filing_folder_paths, :jsonb, default: []
    add_column :cases, :source_folder_paths, :jsonb, default: []
    add_column :cases, :file_action, :string, default: 'copy'
    add_column :cases, :document_processing_status, :string, default: 'pending'
    add_column :cases, :unanswered_questions_count, :integer, default: 0
  end
end
