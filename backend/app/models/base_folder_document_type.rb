# frozen_string_literal: true

# BaseFolderDocumentType - SSoT for folder-to-document-type associations
#
# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║  SSoT: THE ONE source for document type templates per folder                   ║
# ║                                                                                ║
# ║  This replaces WarehouseFolderDocumentType (Feb 2026)                          ║
# ║                                                                                ║
# ║  Template Resolution Chain:                                                    ║
# ║  1. base_folder_document_types.ui_name_template (folder-specific)              ║
# ║  2. document_types.ui_name (document type default)                             ║
# ║  3. base_folders.ui_name_template (folder-level fallback)                      ║
# ║                                                                                ║
# ║  Same chain for download_name_template.                                        ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝
#
class BaseFolderDocumentType < ApplicationRecord
  belongs_to :base_folder
  belongs_to :document_type

  # Validations
  validates :base_folder_id, uniqueness: { scope: :document_type_id }

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: Template Resolution Methods
  # These methods implement the fallback chain for document naming templates
  # ════════════════════════════════════════════════════════════════════════════════

  # Get the effective UI name template for this folder+doc type combination
  # Fallback chain: join table → document type → folder
  # @return [String, nil] The template to use for UI display names
  def effective_ui_name_template
    ui_name_template.presence ||
      document_type&.ui_name.presence ||
      base_folder&.ui_name_template.presence
  end

  # Get the effective download name template for this folder+doc type combination
  # Fallback chain: join table → document type → folder
  # @return [String, nil] The template to use for download filenames
  def effective_download_name_template
    download_name_template.presence ||
      document_type&.download_name.presence ||
      base_folder&.download_name_template.presence
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
      base_folder_id: base_folder_id,
      document_type_id: document_type_id,
      is_primary: is_primary,
      # Template fields
      ui_name_template: ui_name_template,
      download_name_template: download_name_template,
      # Effective templates (with fallback chain applied)
      effective_ui_name_template: effective_ui_name_template,
      effective_download_name_template: effective_download_name_template,
      has_template_overrides: has_template_overrides?,
      # Related object data
      document_type_name: document_type&.name,
      folder_name: base_folder&.display_name || base_folder&.name
    }
  end
end
