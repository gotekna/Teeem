# frozen_string_literal: true

# Migration: Add ui_name_template and download_name_template to warehouse_folder_document_types
#
# SSoT Consolidation (Feb 2026):
# Previously, document naming templates (ui_name, download_name) were stored on document_types.
# This meant ALL instances of a document type used the same templates.
#
# Problem: The same document type in different folders might need different naming templates.
# e.g., "Invoice" in "Job/Financial" vs "Corporate/Xero" folders.
#
# Solution: Move templates to the JOIN TABLE (warehouse_folder_document_types).
# This allows per-folder template overrides while keeping document_types as the default.
#
# Fallback chain:
# 1. warehouse_folder_document_types.ui_name_template (folder-specific override)
# 2. document_types.ui_name (document type default)
# 3. WarehouseFolder.ui_name (folder-level default)
#
class AddTemplatesToWarehouseFolderDocumentTypes < ActiveRecord::Migration[7.0]
  def change
    # Add template columns to the join table
    # These allow folder-specific overrides for document naming
    add_column :warehouse_folder_document_types, :ui_name_template, :string
    add_column :warehouse_folder_document_types, :download_name_template, :string

    # Add index for faster lookups when filtering by template presence
    add_index :warehouse_folder_document_types, :ui_name_template,
              name: 'idx_wfdt_ui_name_template',
              where: 'ui_name_template IS NOT NULL'

    add_index :warehouse_folder_document_types, :download_name_template,
              name: 'idx_wfdt_download_name_template',
              where: 'download_name_template IS NOT NULL'
  end
end
