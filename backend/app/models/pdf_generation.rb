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

  validates :generator_type, presence: true
  validates :status, inclusion: { in: %w[pending processing completed failed] }

  scope :recent, -> { where("created_at > ?", 24.hours.ago) }

  GENERATOR_TYPES = %w[
    tekna_document
    invoice
    bank_report
    contract_overlay
  ].freeze

  def completed?
    status == "completed"
  end

  def failed?
    status == "failed"
  end

  def pending_or_processing?
    status.in?(%w[pending processing])
  end

  def download_url(expires_in: 3600)
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
