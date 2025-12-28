# SaaS Billing Record
# Tracks monthly/annual billing for SaaS customers
#
# Created monthly by billing job, links to GL invoice when invoiced
#
class SaasBillingRecord < ApplicationRecord
  # Associations
  belongs_to :contact  # The SaaS customer
  belongs_to :gl_invoice, class_name: "Gl::Invoice", optional: true

  has_many :referral_commissions, dependent: :destroy

  # Validations
  validates :billing_period_start, presence: true
  validates :billing_period_end, presence: true
  validates :status, presence: true, inclusion: { in: %w[pending invoiced paid] }
  validate :period_end_after_start

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :invoiced, -> { where(status: "invoiced") }
  scope :paid, -> { where(status: "paid") }
  scope :for_period, ->(start_date, end_date) {
    where("billing_period_start >= ? AND billing_period_end <= ?", start_date, end_date)
  }
  scope :recent, -> { order(billing_period_end: :desc) }

  # Callbacks
  before_create :calculate_fee

  # Calculate fee based on customer's turnover
  def calculate_fee
    return if contact.blank?

    turnover = turnover_reported || contact.annual_turnover || 0
    result = SaasPricingService.calculate(turnover)

    self.turnover_reported = turnover
    self.fee_calculated = result[:cost]
    self.effective_rate = result[:effective_rate]
    self.tier_breakdown = result[:tiers]
  end

  # Recalculate fee (for updates)
  def recalculate_fee!
    calculate_fee
    save!
  end

  # Mark as invoiced and link to GL invoice
  def mark_invoiced!(invoice)
    update!(
      status: "invoiced",
      gl_invoice: invoice
    )
  end

  # Mark as paid
  def mark_paid!
    update!(status: "paid")
  end

  # Create referral commissions for this billing record
  def create_commissions!
    ReferralCommissionService.calculate_for_billing_record(self)
  end

  # Revenue distribution for this billing record
  def distribution
    SaasPricingService.calculate_distribution(
      fee_calculated,
      has_l1_referrer: contact.support_contact.present?,
      has_l2_referrer: contact.upline_contact.present?
    )
  end

  # Monthly equivalent (if this is an annual record)
  def monthly_equivalent
    days_in_period = (billing_period_end - billing_period_start).to_i + 1
    (fee_calculated / days_in_period * 30).round(2)
  end

  private

  def period_end_after_start
    return if billing_period_start.blank? || billing_period_end.blank?

    if billing_period_end < billing_period_start
      errors.add(:billing_period_end, "must be after billing period start")
    end
  end
end
