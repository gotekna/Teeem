class NdisClaim < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property
  belongs_to :tenancy
  belongs_to :contact, optional: true  # SDA participant

  STATUSES = %w[draft submitted processing approved rejected paid resubmitted].freeze

  validates :claim_period_start, :claim_period_end, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :total_amount, numericality: { greater_than: 0 }, allow_nil: true
  validate :end_after_start

  scope :for_period, ->(start_date, end_date) { where(claim_period_start: start_date, claim_period_end: end_date) }
  scope :by_status, ->(status) { where(status: status) }
  scope :draft, -> { by_status("draft") }
  scope :submitted, -> { by_status("submitted") }
  scope :approved, -> { by_status("approved") }
  scope :paid, -> { by_status("paid") }

  def submit!
    update!(status: "submitted", submitted_at: Time.current)
  end

  def approve!
    update!(status: "approved", approved_at: Time.current)
  end

  def reject!(reason, code = nil)
    update!(status: "rejected", rejection_reason: reason, rejection_code: code)
  end

  def mark_paid!(amount)
    update!(status: "paid", paid_at: Time.current, paid_amount: amount)
  end

  private

  def end_after_start
    return unless claim_period_start && claim_period_end
    errors.add(:claim_period_end, "must be after start") if claim_period_end <= claim_period_start
  end
end
