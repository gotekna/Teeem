# frozen_string_literal: true

# SSoT: Links DocumentTypes to StorageLocations
# This replaces the old document_type_folders join table
# Model renamed: EntityTabDocumentType → StorageLocationDocumentType (Jan 2026)
class StorageLocationDocumentType < ApplicationRecord
  # Table name kept as entity_tab_document_types for backward compatibility
  self.table_name = 'entity_tab_document_types'
  belongs_to :storage_location, foreign_key: :entity_tab_id
  belongs_to :document_type

  # Validations
  validates :entity_tab_id, uniqueness: { scope: :document_type_id }
end
