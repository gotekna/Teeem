class AddFilenamePatternsToDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    add_column :document_types, :filename_patterns, :jsonb, default: []
    add_index :document_types, :filename_patterns, using: :gin
  end
end
