# frozen_string_literal: true

# Tracks async PDF generation requests.
# Created when user requests PDF, updated by GeneratePdfJob when complete.
#
# Statuses: pending → processing → completed | failed
#
class PdfGeneration < ApplicationRecord
  belongs_to :user, optional: true
  belongs_to :tenant, optional: true
  belongs_to :storage_blob, optional: true

  # Constants
  STATUSES = %w[pending processing completed failed].freeze
  GENERATOR_TYPES = %w[
    teeem_document
    invoice
    bank_report
    contract_overlay
    director_change
    financial_report
    form43_certificate
    tender_document
  ].freeze

  validates :generator_type, presence: true
  validates :status, inclusion: { in: STATUSES }

  scope :recent, -> { where("created_at > ?", 24.hours.ago) }

  def completed?
    status == "completed"
  end

  def failed?
    status == "failed"
  end

  def pending_or_processing?
    status.in?(%w[pending processing])
  end

  def download_url(expires_in: DocumentStorageConstants::PRESIGNED_URL_EXPIRY_DEFAULT)
    return nil unless completed? && storage_blob&.storage_path.present?

    provider = DocumentProviders.for_tenant(tenant)
    provider.download_url(
      storage_blob.storage_path,
      expires_in: expires_in,
      filename: result_filename,
      disposition: :attachment
    )
  rescue StandardError => e
    Rails.logger.error "[PdfGeneration] download_url error: #{e.message}"
    nil
  end
end
