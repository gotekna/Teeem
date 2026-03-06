class SdaClaim < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :tenancy, optional: true
  belongs_to :contact, optional: true
  belongs_to :submitted_by_user, class_name: "User", optional: true

  CLAIM_TYPES = %w[sda_payment participant_rent other].freeze
  STATUSES = %w[draft submitted processing paid rejected appealed].freeze
  PERIOD_TYPES = %w[monthly quarterly].freeze

  validates :claim_type, presence: true, inclusion: { in: CLAIM_TYPES }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :period_type, inclusion: { in: PERIOD_TYPES, allow_nil: true }
  validates :period_start, :period_end, presence: true
  validates :claimed_amount, numericality: { greater_than: 0 }, allow_nil: true
  validate :end_after_start

  scope :pending, -> { where(status: %w[draft submitted processing]) }
  scope :paid, -> { where(status: "paid") }
  scope :for_period, ->(start_date, end_date) { where("period_start >= ? AND period_end <= ?", start_date, end_date) }

  def calculate_variance
    return nil unless claimed_amount && paid_amount
    (claimed_amount - paid_amount).round(2)
  end

  def paid?
    status == "paid"
  end

  def outstanding_amount
    return 0 if paid?
    return claimed_amount || 0 unless paid_amount
    [(claimed_amount || 0) - paid_amount, 0].max.round(2)
  end

  private

  def end_after_start
    return unless period_start && period_end
    errors.add(:period_end, "must be after start") if period_end <= period_start
  end
end
