class CreateDocumentTypeFolders < ActiveRecord::Migration[8.0]
  def change
    create_table :document_type_folders do |t|
      t.references :document_type, null: false, foreign_key: true
      t.references :document_folder, null: false, foreign_key: true
      t.boolean :is_primary, default: false, null: false

      t.timestamps
    end

    # Unique constraint to prevent duplicate assignments
    add_index :document_type_folders, [ :document_type_id, :document_folder_id ], unique: true, name: "idx_doc_type_folders_unique"
  end
end
