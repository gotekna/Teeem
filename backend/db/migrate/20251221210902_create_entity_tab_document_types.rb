# Join table linking EntityTab to DocumentType
# This replaces document_type_folders and allows document types to be linked to tabs
class CreateEntityTabDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    create_table :entity_tab_document_types do |t|
      t.references :entity_tab, null: false, foreign_key: true
      t.references :document_type, null: false, foreign_key: true
      t.boolean :is_primary, default: false  # True if this is the primary tab for this doc type

      t.timestamps
    end

    # Ensure a document type can only be linked to a tab once
    add_index :entity_tab_document_types, [:entity_tab_id, :document_type_id],
              unique: true, name: 'idx_entity_tab_doc_types_unique'

    # Index for finding primary tab
    add_index :entity_tab_document_types, [:document_type_id, :is_primary],
              name: 'idx_entity_tab_doc_types_primary'
  end
end
