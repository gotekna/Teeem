# frozen_string_literal: true

# Create UserDocument table for user-related document storage
#
# SSoT: UserDocument uses StorableDocument concern to integrate with
# the storage system. Supports multiple categories:
# - photos: /Users/Photos/{{UserName}}/filename
# - contracts: /Users/Contracts/{{UserName}}/filename
# - my_docs: /Users/MyDocs/{{UserName}}/filename
#
class CreateUserDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :user_documents do |t|
      t.references :user, null: false, foreign_key: true
      t.references :document_type, foreign_key: true

      t.string :file_name, null: false
      t.string :file_extension, limit: 10
      t.integer :file_size
      t.string :content_type
      t.string :category, limit: 20  # 'photos', 'contracts', 'my_docs'
      t.string :folder              # Sub-folder within category

      # Storage columns (same pattern as other document models)
      t.string :storage_path
      t.string :storage_item_id
      t.string :storage_provider, limit: 20

      # Migration tracking
      t.string :migration_status, limit: 20
      t.text :migration_error
      t.datetime :migration_started_at
      t.datetime :migration_completed_at

      t.timestamps
    end

    add_index :user_documents, [:user_id, :category]
    add_index :user_documents, :storage_provider
    add_index :user_documents, :migration_status
    add_index :user_documents, :category
  end
end
