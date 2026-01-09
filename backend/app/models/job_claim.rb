# frozen_string_literal: true

# JobClaim represents a progress claim / sales invoice (ACCREC from Xero)
# These are invoices sent TO clients for work completed on the job
class JobClaim < ApplicationRecord
  # Associations
  belongs_to :job
  belongs_to :contact, optional: true

  # Enums
  enum :status, {
    draft: "draft",
    submitted: "submitted",
    authorised: "authorised",
    paid: "paid",
    voided: "voided"
  }, default: :draft

  # Validations
  validates :job_id, presence: true
  validates :invoice_number, presence: true
  validates :amount, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :xero_invoice_id, uniqueness: true, allow_nil: true

  # Callbacks
  before_save :calculate_amount_due

  # Scopes
  scope :recent, -> { order(date: :desc, created_at: :desc) }
  scope :unpaid, -> { where.not(status: "paid") }
  scope :by_job, ->(job_id) { where(job_id: job_id) if job_id.present? }

  # Instance Methods
  def paid?
    status == "paid"
  end

  def payment_percentage
    return 0 if amount.nil? || amount.zero?
    return 100 if paid?
    return 0 if amount_paid.nil?

    ((amount_paid / amount) * 100).round(2)
  end

  def outstanding_amount
    return 0 if paid?
    (amount || 0) - (amount_paid || 0)
  end

  private

  def calculate_amount_due
    self.amount_due = outstanding_amount
  end
end
