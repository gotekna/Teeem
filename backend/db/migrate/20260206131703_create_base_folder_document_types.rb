# frozen_string_literal: true

# Migration: Create base_folder_document_types join table
#
# Part of "Eliminate warehouse_folders, Make base_folders Tenant-Specific" refactor.
# This replaces warehouse_folder_document_types with a direct link from base_folders
# to document_types.
#
# SSoT: base_folder_document_types is THE ONE source for folder-to-document-type associations.
#
# Template Resolution Chain:
#   1. base_folder_document_types.ui_name_template (folder-specific)
#   2. document_types.ui_name (document type default)
#   3. base_folders.ui_name_template (folder-level fallback)
#
class CreateBaseFolderDocumentTypes < ActiveRecord::Migration[7.2]
  def change
    create_table :base_folder_document_types do |t|
      t.references :base_folder, null: false, foreign_key: true
      t.references :document_type, null: false, foreign_key: true
      t.boolean :is_primary, default: false

      # Template overrides (folder+doc type specific)
      t.string :ui_name_template
      t.string :download_name_template

      t.timestamps
    end

    # Unique constraint: one link per folder+document_type
    add_index :base_folder_document_types,
              [:base_folder_id, :document_type_id],
              unique: true,
              name: 'idx_bfdt_unique'

    # Index for primary document type lookup
    add_index :base_folder_document_types,
              [:document_type_id, :is_primary],
              name: 'idx_bfdt_primary'

    # Partial indexes for template queries
    add_index :base_folder_document_types, :ui_name_template,
              name: 'idx_bfdt_ui_name_template',
              where: 'ui_name_template IS NOT NULL'
    add_index :base_folder_document_types, :download_name_template,
              name: 'idx_bfdt_download_name_template',
              where: 'download_name_template IS NOT NULL'
  end
end
