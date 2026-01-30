# frozen_string_literal: true

# SSoT: Links DocumentTypes to WarehouseFolders
# This replaces the old document_type_folders join table
# Model renamed: EntityTabDocumentType → StorageLocationDocumentType → WarehouseFolderDocumentType (Jan 2026)
# Column renamed: entity_tab_id → storage_location_id → warehouse_folder_id (Jan 2026)
class WarehouseFolderDocumentType < ApplicationRecord
  # Table renamed: entity_tab_document_types → warehouse_folder_document_types (Jan 2026)
  self.table_name = 'warehouse_folder_document_types'
  belongs_to :warehouse_folder
  belongs_to :document_type

  # Validations
  validates :warehouse_folder_id, uniqueness: { scope: :document_type_id }
end
