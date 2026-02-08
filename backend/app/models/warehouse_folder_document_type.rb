# frozen_string_literal: true

# WarehouseFolderDocumentType - SSoT for folder-to-document-type associations
#
# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║  SSoT: THE ONE source for document type templates per folder                   ║
# ║                                                                                ║
# ║  Template Resolution Chain:                                                    ║
# ║  1. warehouse_folder_document_types.ui_name_template (folder-specific)         ║
# ║  2. document_types.ui_name (document type default)                             ║
# ║  3. warehouse_folders.ui_name_template (folder-level fallback)                 ║
# ║                                                                                ║
# ║  Same chain for download_name_template.                                        ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝
#
class WarehouseFolderDocumentType < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :warehouse_folder
  belongs_to :document_type

  # SSoT: Link to WarehouseDocuments that use this template config
  # Enables bulk updates when templates change
  has_many :warehouse_documents, dependent: :nullify

  # Callbacks
  # SSoT: Sync warehouse_document.ui_name when templates change
  after_update :schedule_warehouse_document_sync, if: :template_changed?

  # Validations
  validates :warehouse_folder_id, uniqueness: { scope: [:tenant_id, :document_type_id] }

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
      warehouse_folder&.ui_name_template.presence
  end

  # Get the effective download name template for this folder+doc type combination
  # Fallback chain: join table → document type → folder
  # @return [String, nil] The template to use for download filenames
  def effective_download_name_template
    download_name_template.presence ||
      document_type&.download_name.presence ||
      warehouse_folder&.download_name_template.presence
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
      # Template fields
      ui_name_template: ui_name_template,
      download_name_template: download_name_template,
      # Effective templates (with fallback chain applied)
      effective_ui_name_template: effective_ui_name_template,
      effective_download_name_template: effective_download_name_template,
      has_template_overrides: has_template_overrides?,
      # Related object data
      document_type_name: document_type&.name,
      folder_name: warehouse_folder&.display_name || warehouse_folder&.name
    }
  end

  private

  # Check if either template changed
  def template_changed?
    saved_change_to_ui_name_template? || saved_change_to_download_name_template?
  end

  # Queue background job to update all linked warehouse documents
  def schedule_warehouse_document_sync
    return unless warehouse_documents.exists?

    # Queue job to update ui_name for all linked documents
    UpdateWarehouseDocumentNamesJob.perform_later(id)
  end
end
