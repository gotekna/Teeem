# frozen_string_literal: true

# SSoT: Links DocumentTypes to WarehouseFolders with per-folder template overrides
#
# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║  SSoT Consolidation (Feb 2026)                                                 ║
# ║                                                                                ║
# ║  This join table is now THE ONE source for document type templates per folder  ║
# ║                                                                                ║
# ║  Template Resolution Chain:                                                    ║
# ║  1. warehouse_folder_document_types.ui_name_template (folder-specific)         ║
# ║  2. document_types.ui_name (document type default)                             ║
# ║  3. warehouse_folders.ui_name (folder-level fallback)                          ║
# ║                                                                                ║
# ║  Same chain for download_name_template.                                        ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝
#
# This replaces the old document_type_folders join table
# Model renamed: EntityTabDocumentType → StorageLocationDocumentType → WarehouseFolderDocumentType (Jan 2026)
# Column renamed: entity_tab_id → storage_location_id → warehouse_folder_id (Jan 2026)
#
class WarehouseFolderDocumentType < ApplicationRecord
  # Table renamed: entity_tab_document_types → warehouse_folder_document_types (Jan 2026)
  self.table_name = 'warehouse_folder_document_types'
  belongs_to :warehouse_folder
  belongs_to :document_type

  # Validations
  validates :warehouse_folder_id, uniqueness: { scope: :document_type_id }

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: Template Resolution Methods (Feb 2026)
  # These methods implement the fallback chain for document naming templates
  # ════════════════════════════════════════════════════════════════════════════════

  # Get the effective UI name template for this folder+doc type combination
  # Fallback chain: join table → document type → folder
  # @return [String, nil] The template to use for UI display names
  def effective_ui_name_template
    ui_name_template.presence ||
      document_type&.ui_name.presence ||
      warehouse_folder&.ui_name.presence
  end

  # Get the effective download name template for this folder+doc type combination
  # Fallback chain: join table → document type → folder
  # @return [String, nil] The template to use for download filenames
  def effective_download_name_template
    download_name_template.presence ||
      document_type&.download_name.presence ||
      warehouse_folder&.download_name.presence
  end

  # Check if this link has folder-specific template overrides
  # @return [Boolean] True if either template is overridden at the folder level
  def has_template_overrides?
    ui_name_template.present? || download_name_template.present?
  end

  # JSON serialization for API
  def as_json(options = {})
    {
      id: id,
      warehouse_folder_id: warehouse_folder_id,
      document_type_id: document_type_id,
      is_primary: is_primary,
      # Template fields (SSoT: Feb 2026)
      ui_name_template: ui_name_template,
      download_name_template: download_name_template,
      # Effective templates (with fallback chain applied)
      effective_ui_name_template: effective_ui_name_template,
      effective_download_name_template: effective_download_name_template,
      has_template_overrides: has_template_overrides?,
      # Related object data
      document_type_name: document_type&.name,
      folder_name: warehouse_folder&.display_name
    }
  end
end
