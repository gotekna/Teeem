class SdaDesignAssessment < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :certificate_blob, class_name: "StorageBlob", optional: true

  STATUSES = %w[pending compliant non_compliant conditional].freeze
  DESIGN_STANDARD_VERSIONS = %w[2024 2021 2019].freeze

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :design_standard_version, inclusion: { in: DESIGN_STANDARD_VERSIONS }, allow_nil: true

  scope :compliant, -> { where(status: "compliant") }
  scope :non_compliant, -> { where(status: "non_compliant") }
  scope :pending, -> { where(status: "pending") }

  def compliance_rate
    return nil unless total_items_assessed&.positive?
    ((compliant_items.to_f / total_items_assessed) * 100).round(1)
  end

  def modifications_needed?
    non_compliant_items.to_i > 0
  end

  def modification_overdue?
    return false unless modification_deadline
    modification_deadline < Date.current && status != "compliant"
  end
end
