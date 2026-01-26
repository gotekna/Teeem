# frozen_string_literal: true

# SSoT: Links DocumentTypes to StorageLocations
# This replaces the old document_type_folders join table
class StorageLocationDocumentType < ApplicationRecord
  belongs_to :storage_location
  belongs_to :document_type

  # Validations
  validates :storage_location_id, uniqueness: { scope: :document_type_id }
end
