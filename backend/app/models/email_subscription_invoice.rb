# frozen_string_literal: true

# EmailSubscriptionInvoice - Billing record for email subscription
#
# Tracks billing for each subscription period, linking to Stripe invoices
# and optionally creating GL::Invoice records for internal accounting.
#
# Usage:
#   invoice = EmailSubscriptionInvoice.create!(
#     email_subscription: subscription,
#     billing_period_start: Date.current.beginning_of_month,
#     billing_period_end: Date.current.end_of_month,
#     retail_amount: 30.00,
#     wholesale_amount: 15.00
#   )
#
class EmailSubscriptionInvoice < ApplicationRecord
  belongs_to :email_subscription
  belongs_to :gl_invoice, class_name: "Gl::Invoice", optional: true

  # Constants
  STATUSES = %w[pending invoiced paid failed refunded].freeze

  # Validations
  validates :billing_period_start, :billing_period_end, presence: true
  validates :status, inclusion: { in: STATUSES }
  validate :period_dates_valid

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :paid, -> { where(status: "paid") }
  scope :failed, -> { where(status: "failed") }
  scope :recent, -> { order(created_at: :desc) }
  scope :for_period, ->(start_date, end_date) {
    where(billing_period_start: start_date, billing_period_end: end_date)
  }

  # Callbacks
  before_validation :set_defaults, on: :create

  # Margin calculations
  def margin_amount
    return 0 unless retail_amount && wholesale_amount
    retail_amount - wholesale_amount
  end

  def margin_percentage
    return 0 if retail_amount.blank? || retail_amount.zero?
    (margin_amount / retail_amount * 100).round(2)
  end

  # Status helpers
  def paid?
    status == "paid"
  end

  def failed?
    status == "failed"
  end

  # Create GL invoice for internal accounting
  # SSoT: Use configured billing company from settings, not hardcoded name (Jan 2026)
  def create_gl_invoice!
    return gl_invoice if gl_invoice.present?

    # Look up billing company from CorporateCompanySetting or find by company name
    company_name = CorporateCompanySetting.instance.company_name
    billing_company = CorporateCompany.find_by("name ILIKE ?", "%#{company_name}%") ||
                      CorporateCompany.first
    raise "Billing company not found - please configure in Settings" unless billing_company

    contact = email_subscription.contact
    period_label = billing_period_start.strftime("%B %Y")

    invoice = Gl::Invoice.create!(
      corporate_company: billing_company,
      contact: contact,
      invoice_type: "sales_invoice",
      status: "draft",
      invoice_date: billing_period_end,
      due_date: billing_period_end + 14.days,
      reference: "EMAIL-#{billing_period_start.strftime('%Y%m')}-#{email_subscription.id}",
      description: "Email Hosting - #{period_label}",
      created_in_teeem: true,
      lines_attributes: build_invoice_lines
    )

    update!(status: "invoiced", gl_invoice: invoice)
    invoice
  end

  # Period description
  def period_description
    "#{billing_period_start.strftime('%d %b')} - #{billing_period_end.strftime('%d %b %Y')}"
  end

  private

  def set_defaults
    self.status ||= "pending"
  end

  def period_dates_valid
    return unless billing_period_start && billing_period_end

    if billing_period_end < billing_period_start
      errors.add(:billing_period_end, "must be after start date")
    end
  end

  def build_invoice_lines
    subscription = email_subscription
    [
      {
        description: "Email Hosting - #{subscription.domain} (#{subscription.mailbox_count} mailboxes)",
        quantity: 1,
        unit_amount: retail_amount,
        account_code: "400" # Revenue account
      }
    ]
  end
end
