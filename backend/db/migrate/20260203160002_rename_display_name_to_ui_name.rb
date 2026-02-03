# frozen_string_literal: true

# Migration: Rename display_name to ui_name
#
# This migration renames the display_name column to ui_name in both
# WarehouseDocument and DocumentType tables for consistency with the
# "Document UI Name" label in the UI.
#
# WarehouseFolder already has ui_name, so this creates consistency across
# all three document-related models.
#
# Breaking API change: Frontend and backend must deploy together.
# Shared database: staging/beta/production share same DB, so deploy to all environments together.
class RenameDisplayNameToUiName < ActiveRecord::Migration[8.0]
  def change
    # Rename column in warehouse_documents
    rename_column :warehouse_documents, :display_name, :ui_name

    # Rename column in document_types
    rename_column :document_types, :display_name, :ui_name

    # Note: The index on warehouse_documents.display_name will be automatically
    # renamed to index_warehouse_documents_on_ui_name by Rails
  end
end
