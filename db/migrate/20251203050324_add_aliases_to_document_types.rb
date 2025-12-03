class AddAliasesToDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    # Aliases are alternative names that should map to this document type
    # Stored as JSON array, e.g., ["Activity Statement", "AS", "Activity Stmt"]
    add_column :document_types, :aliases, :jsonb, default: []

    # Display name is the canonical/preferred name shown in UI
    # If not set, falls back to 'name' field
    add_column :document_types, :display_name, :string

    add_index :document_types, :aliases, using: :gin
  end
end
