# frozen_string_literal: true

# Data Migration: Populate ui_name_template and download_name_template on warehouse_folder_document_types
#
# SSoT Consolidation (Feb 2026):
# This migration copies existing templates from document_types to the join table.
#
# Strategy:
# - For PRIMARY links (is_primary: true): Copy templates from document_type
#   This preserves the current behavior where the primary folder uses the doc type's templates
# - For SECONDARY links (is_primary: false): Leave templates NULL
#   Secondary folders will inherit from document_type defaults (fallback chain)
#
# This approach:
# 1. Maintains backward compatibility (existing behavior unchanged)
# 2. Allows future folder-specific overrides
# 3. Doesn't duplicate data unnecessarily (only primary links get explicit templates)
#
class PopulateWarehouseFolderDocumentTypeTemplates < ActiveRecord::Migration[7.0]
  def up
    # Copy templates from document_types to warehouse_folder_document_types for PRIMARY links
    # This preserves the current behavior where primary folders use the document type's templates
    execute <<~SQL
      UPDATE warehouse_folder_document_types wfdt
      SET
        ui_name_template = dt.ui_name,
        download_name_template = dt.download_name
      FROM document_types dt
      WHERE wfdt.document_type_id = dt.id
        AND wfdt.is_primary = true
        AND (dt.ui_name IS NOT NULL OR dt.download_name IS NOT NULL)
    SQL

    updated_count = execute("SELECT COUNT(*) FROM warehouse_folder_document_types WHERE ui_name_template IS NOT NULL OR download_name_template IS NOT NULL").first['count']
    say "Populated templates for #{updated_count} primary document type links"
  end

  def down
    # Clear all template overrides (revert to document_type defaults)
    execute <<~SQL
      UPDATE warehouse_folder_document_types
      SET
        ui_name_template = NULL,
        download_name_template = NULL
    SQL

    say "Cleared all template overrides from warehouse_folder_document_types"
  end
end
