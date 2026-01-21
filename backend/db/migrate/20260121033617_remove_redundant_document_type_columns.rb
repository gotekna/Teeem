# SSoT Cleanup: Remove redundant columns from document_types
# These columns have been superseded by EntityTab associations:
# - tabs (jsonb) → entity_tab_document_types join table
# - primary_tab (string) → computed via primary_entity_tab.display_name
# - category (string) → unused, returns nil (callers use "General" fallback)
# - name_format (string) → superseded by file_name column
#
# Phase 1: Safe to remove (definitely unused/redundant)
# Phase 2 (future): scope, folder, target_folder (derived from primary_entity_tab)
class RemoveRedundantDocumentTypeColumns < ActiveRecord::Migration[8.0]
  def change
    # Remove indexes first (before dropping columns)
    remove_index :document_types, :category, if_exists: true
    remove_index :document_types, :primary_tab, if_exists: true

    # Phase 1: Remove definitely unused columns
    # Note: DocumentType model has computed methods for primary_tab and category
    # to maintain backward compatibility with code that reads these values
    remove_column :document_types, :tabs, :jsonb, default: []
    remove_column :document_types, :primary_tab, :string
    remove_column :document_types, :category, :string
    remove_column :document_types, :name_format, :string
  end
end
