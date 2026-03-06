class SdaSilProvider < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :contact
  belongs_to :agreement_blob, class_name: "StorageBlob", optional: true

  STATUSES = %w[active inactive pending].freeze
  SERVICE_TYPES = %w[sil in_home_support respite].freeze

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :service_type, presence: true, inclusion: { in: SERVICE_TYPES }

  scope :active, -> { where(status: "active") }
  scope :by_service_type, ->(type) { where(service_type: type) }

  def active?
    status == "active"
  end

  def agreement_expired?
    return false unless agreement_end_date
    agreement_end_date < Date.current
  end
end
