class AddVersioningToJobDocuments < ActiveRecord::Migration[8.0]
  def change
    add_reference :job_documents, :parent_document, foreign_key: { to_table: :job_documents }, null: true
    add_column :job_documents, :version_status, :string, default: 'draft', null: false
    add_column :job_documents, :version_number, :integer, default: 1, null: false
    add_column :job_documents, :signed_at, :datetime, null: true
    add_reference :job_documents, :signed_by, foreign_key: { to_table: :users }, null: true

    add_index :job_documents, :version_status
    add_index :job_documents, [:document_type_id, :version_status]
  end
end
