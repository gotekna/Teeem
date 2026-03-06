class SdaAgreement < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :tenancy, optional: true
  belongs_to :contact
  belongs_to :document_blob, class_name: "StorageBlob", optional: true
  belongs_to :created_by_user, class_name: "User", optional: true

  AGREEMENT_TYPES = %w[sda_accommodation service_agreement sil_agreement].freeze
  STATUSES = %w[draft sent signed active expired terminated].freeze

  validates :agreement_type, presence: true, inclusion: { in: AGREEMENT_TYPES }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :start_date, presence: true
  validate :end_date_after_start_date

  scope :active, -> { where(status: "active") }
  scope :expiring_soon, ->(days = 30) { active.where("end_date <= ?", days.days.from_now) }
  scope :by_type, ->(type) { where(agreement_type: type) }

  def active?
    status == "active"
  end

  def expired?
    return false unless end_date
    end_date < Date.current
  end

  def days_until_expiry
    return nil unless end_date
    (end_date - Date.current).to_i
  end

  def needs_renewal?(days: 30)
    return false unless active?
    return false unless end_date
    days_until_expiry <= days
  end

  private

  def end_date_after_start_date
    return unless start_date && end_date
    errors.add(:end_date, "must be after start date") if end_date <= start_date
  end
end
