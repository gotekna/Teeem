class DocumentTypeFolder < ApplicationRecord
  belongs_to :document_type
  belongs_to :document_folder

  validates :document_type_id, uniqueness: { scope: :document_folder_id, message: "is already assigned to this folder" }

  scope :primary, -> { where(is_primary: true) }

  # Ensure only one primary folder per document type
  before_save :ensure_single_primary

  private

  def ensure_single_primary
    return unless is_primary_changed? && is_primary?

    DocumentTypeFolder.where(document_type_id: document_type_id, is_primary: true)
                      .where.not(id: id)
                      .update_all(is_primary: false)
  end
end
