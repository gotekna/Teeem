class CreateDocumentDuplicateReviews < ActiveRecord::Migration[8.0]
  def change
    create_table :document_duplicate_reviews do |t|
      t.references :case, null: false, foreign_key: true
      t.references :existing_document, null: false, foreign_key: { to_table: :company_documents }
      t.references :new_document, foreign_key: { to_table: :company_documents }

      t.string :new_file_path
      t.string :new_file_hash
      t.string :new_file_name
      t.bigint :new_file_size
      t.string :source_type

      t.string :status, default: 'pending'
      t.string :resolution
      t.bigint :resolved_by_id
      t.datetime :resolved_at

      t.timestamps
    end

    add_index :document_duplicate_reviews, [ :case_id, :status ]
    add_foreign_key :document_duplicate_reviews, :users, column: :resolved_by_id
  end
end
