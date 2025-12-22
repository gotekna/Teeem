# SSoT: Links DocumentTypes to EntityTabs
# This replaces the old document_type_folders join table
class EntityTabDocumentType < ApplicationRecord
  belongs_to :entity_tab
  belongs_to :document_type

  # Validations
  validates :entity_tab_id, uniqueness: { scope: :document_type_id }
end
