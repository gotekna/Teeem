# Referral Commission
# Tracks commissions earned by referrers for each billing period
#
# Commission Levels:
# - L1 (20%): Direct referrer (support_contact)
# - L2 (10%): Referrer's referrer (upline_contact)
#
# Eligibility Requirements:
# - Training completed and not expired
# - L1: $10k total network fees threshold
# - L2: $50k total network fees threshold
#
class ReferralCommission < ApplicationRecord
  # Associations
  belongs_to :referrer_contact, class_name: "Contact"  # Who earns the commission
  belongs_to :customer_contact, class_name: "Contact"  # The paying customer
  belongs_to :saas_billing_record

  # Validations
  validates :commission_level, presence: true, inclusion: { in: %w[l1 l2] }
  validates :customer_fee, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :commission_rate, presence: true, numericality: { greater_than: 0, less_than_or_equal_to: 1 }
  validates :commission_amount, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :status, presence: true, inclusion: { in: %w[pending eligible paid forfeited] }

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :eligible, -> { where(status: "eligible") }
  scope :paid, -> { where(status: "paid") }
  scope :forfeited, -> { where(status: "forfeited") }
  scope :l1_commissions, -> { where(commission_level: "l1") }
  scope :l2_commissions, -> { where(commission_level: "l2") }
  scope :for_referrer, ->(contact_id) { where(referrer_contact_id: contact_id) }
  scope :unpaid, -> { where(status: %w[pending eligible]) }
  scope :recent, -> { order(created_at: :desc) }

  # Callbacks
  after_create :update_referrer_totals
  after_update :update_referrer_totals, if: :saved_change_to_status?

  # Check if commission can be paid out
  def payable?
    status == "eligible"
  end

  # Mark as paid
  def mark_paid!
    return unless payable?

    update!(
      status: "paid",
      paid_at: Time.current
    )
  end

  # Re-evaluate eligibility (called when referrer's training or threshold changes)
  def reevaluate_eligibility!
    return if status.in?(%w[paid forfeited])

    new_status, reason = ReferralCommissionService.determine_eligibility(referrer_contact, commission_level)
    update!(status: new_status, ineligible_reason: reason)
  end

  # Human-readable commission level
  def level_display
    case commission_level
    when "l1" then "Level 1 (20%)"
    when "l2" then "Level 2 (10%)"
    else commission_level
    end
  end

  # Human-readable status with reason
  def status_display
    case status
    when "pending"
      ineligible_reason.present? ? "Pending (#{ineligible_reason.humanize})" : "Pending"
    when "eligible"
      "Eligible for Payment"
    when "paid"
      "Paid on #{paid_at&.strftime('%d/%m/%Y')}"
    when "forfeited"
      "Forfeited"
    else
      status.humanize
    end
  end

  private

  def update_referrer_totals
    # Update referrer's cached totals
    earned = referrer_contact.referral_commissions.sum(:commission_amount)
    paid = referrer_contact.referral_commissions.paid.sum(:commission_amount)

    referrer_contact.update_columns(
      total_commissions_earned: earned,
      total_commissions_paid: paid
    )
  end
end
