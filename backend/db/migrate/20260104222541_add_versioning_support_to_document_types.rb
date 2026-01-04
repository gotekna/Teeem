class AddVersioningSupportToDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :document_types, :supports_versioning, :boolean, default: false, null: false
    add_index :document_types, :supports_versioning
  end
end
