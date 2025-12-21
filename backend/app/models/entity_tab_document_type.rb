# Join table linking EntityTab to DocumentType
# This allows document types to be categorized under tabs
class EntityTabDocumentType < ApplicationRecord
  belongs_to :entity_tab
  belongs_to :document_type

  validates :entity_tab_id, uniqueness: { scope: :document_type_id }

  # Scopes
  scope :primary, -> { where(is_primary: true) }

  # Get the primary tab for a document type
  def self.primary_tab_for(document_type_id)
    primary.find_by(document_type_id: document_type_id)&.entity_tab
  end
end
