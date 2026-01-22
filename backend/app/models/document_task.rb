class DocumentTask < ApplicationRecord
  include WarehouseDocumentable
  warehouse_type :compliance

  belongs_to :job
  has_many :purchase_order_documents, dependent: :destroy
  has_many :purchase_orders, through: :purchase_order_documents

  # SSoT: Link to deduplicated file storage (Jan 2026)
  belongs_to :storage_blob, optional: true

  # ActiveStorage has_one_attached :document was REMOVED (Jan 2026) - it violated SSoT.

  validates :name, presence: true
  validates :category, presence: true
  validates :job_id, presence: true

  scope :for_category, ->(category) { where(category: category) }
  scope :required, -> { where(required: true) }
  scope :with_documents, -> { where(has_document: true) }
  scope :validated, -> { where(is_validated: true) }

  # ========================================
  # StorageBlob File Access (SSoT)
  # ========================================

  def has_file?
    storage_blob_id.present?
  end

  def document_url(expires_in: 3600)
    return nil unless storage_blob

    storage_blob.presigned_url(expires_in: expires_in, filename: name)
  end

  def download_file
    return nil unless storage_blob

    storage_blob.download
  end

  def attach_file(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    storage_blob&.decrement_reference! if storage_blob_id.present?
    self.storage_blob = blob
    blob.increment_reference!
    self.has_document = true
  end
end
