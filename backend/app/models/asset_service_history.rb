class AssetServiceHistory < ApplicationRecord
  # Associations
  belongs_to :asset
  belongs_to :user, optional: true

  # SSoT: Links to deduplicated file storage (Jan 2026)
  belongs_to :invoice_blob, class_name: "StorageBlob", optional: true
  belongs_to :document_blob, class_name: "StorageBlob", optional: true

  # ActiveStorage has_one_attached :invoice/:document was REMOVED (Jan 2026) - it violated SSoT.

  # Validations
  validates :service_date, presence: true
  validates :service_type, inclusion: { in: %w[regular_service repair inspection registration warranty_work other] }, allow_blank: true
  validates :cost, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  # Scopes
  scope :recent, -> { order(service_date: :desc) }
  scope :by_type, ->(type) { where(service_type: type) }
  scope :by_year, ->(year) { where("EXTRACT(YEAR FROM service_date) = ?", year) }

  # Callbacks
  after_create :create_activity
  after_create :update_asset_last_service

  # Instance methods
  def display_name
    "#{service_type.to_s.titleize} - #{service_date.strftime('%d/%m/%Y')}"
  end

  def formatted_service_type
    service_type.to_s.titleize.gsub("_", " ")
  end

  def days_since_service
    return nil unless service_date.present?
    (Date.today - service_date).to_i
  end

  # ========================================
  # StorageBlob File Access (SSoT)
  # ========================================

  def has_invoice?
    invoice_blob_id.present?
  end

  def invoice_url(expires_in: 3600)
    return nil unless invoice_blob

    invoice_blob.presigned_url(expires_in: expires_in)
  end

  def attach_invoice(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    invoice_blob&.decrement_reference! if invoice_blob_id.present?
    self.invoice_blob = blob
    blob.increment_reference!
  end

  def has_document?
    document_blob_id.present?
  end

  def document_url(expires_in: 3600)
    return nil unless document_blob

    document_blob.presigned_url(expires_in: expires_in)
  end

  def attach_document(content, filename:, content_type: nil)
    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    document_blob&.decrement_reference! if document_blob_id.present?
    self.document_blob = blob
    blob.increment_reference!
  end

  private

  def create_activity
    asset.company.corporate_activities.create!(
      activity_type: "asset_service_recorded",
      description: "Service recorded for #{asset.display_name}: #{formatted_service_type}",
      metadata: {
        asset_id: asset.id,
        service_type: service_type,
        service_date: service_date,
        cost: cost,
        service_provider: service_provider
      },
      performed_by: user || Current.user || User.first,
      occurred_at: Time.current
    )
  end

  def update_asset_last_service
    # Update asset metadata with last service info
    asset.metadata ||= {}
    asset.metadata["last_service_date"] = service_date
    asset.metadata["last_service_type"] = service_type
    asset.save
  end
end
