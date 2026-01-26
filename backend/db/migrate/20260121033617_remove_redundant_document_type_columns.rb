# SSoT Cleanup: Remove redundant columns from document_types
# These columns have been superseded by EntityTab associations:
# - tabs (jsonb) → entity_tab_document_types join table
# - primary_tab (string) → computed via primary_entity_tab.display_name
# - category (string) → unused, returns nil (callers use "General" fallback)
# - name_format (string) → superseded by file_name column
#
# Phase 1: Safe to remove (definitely unused/redundant)
# Phase 2 (future): scope, folder, target_folder (derived from primary_entity_tab)
#
# Note: Materialized views mv_document_summary and mv_document_completeness depend
# on these columns but reference company_documents table which doesn't exist.
# We drop the broken views and don't recreate them since they're non-functional.
class RemoveRedundantDocumentTypeColumns < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Drop materialized views that depend on primary_tab/category
    # These views were broken anyway (reference non-existent company_documents table)
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_document_completeness CASCADE"
    execute "DROP MATERIALIZED VIEW IF EXISTS mv_document_summary CASCADE"

    # Step 2: Remove indexes
    remove_index :document_types, :category, if_exists: true
    remove_index :document_types, :primary_tab, if_exists: true

    # Step 3: Remove columns
    remove_column :document_types, :tabs, :jsonb
    remove_column :document_types, :primary_tab, :string
    remove_column :document_types, :category, :string
    remove_column :document_types, :name_format, :string

    # Note: Materialized views are NOT recreated because they referenced
    # company_documents which doesn't exist. They can be recreated in a
    # future migration if the underlying data source is determined.
  end

  def down
    # Add columns back
    add_column :document_types, :tabs, :jsonb, default: []
    add_column :document_types, :primary_tab, :string
    add_column :document_types, :category, :string
    add_column :document_types, :name_format, :string

    # Add indexes back
    add_index :document_types, :category
    add_index :document_types, :primary_tab

    # Note: Materialized views are NOT recreated in rollback because the
    # original views referenced company_documents which doesn't exist.
    # If you need these views, create a new migration with correct table names.
  end
end
