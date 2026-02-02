# frozen_string_literal: true

class BillPayment < ApplicationRecord
  # ⚠️ CRITICAL SECURITY FIX (Feb 2026): Multi-tenancy scoping
  # FRC: BillPayment was leaking data across tenants
  # Root cause: Legacy indirect relationship (bill_payment → bill_inbox → tenant)
  # Fix: Direct tenant_id column + acts_as_tenant for automatic scoping
  acts_as_tenant :tenant

  # Associations
  belongs_to :tenant
  belongs_to :bill_payment_batch
  belongs_to :bill_inbox
  belongs_to :purchase_order, optional: true

  # Delegations
  delegate :corporate, to: :bill_payment_batch
  delegate :bank_account, to: :bill_payment_batch

  # Validations
  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :payee_bsb, format: { with: /\A\d{6}\z/, message: "must be 6 digits" }, allow_blank: true
  validates :status, presence: true, inclusion: { in: %w[pending approved paid failed reversed] }
  validates :payment_reference, length: { maximum: 18 }

  # Callbacks
  before_validation :set_defaults, on: :create
  before_validation :normalize_bsb
  after_save :update_po_payment_tracking, if: :saved_change_to_status?

  # Status constants
  STATUSES = %w[pending approved paid failed reversed].freeze

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :approved, -> { where(status: "approved") }
  scope :paid, -> { where(status: "paid") }
  scope :failed, -> { where(status: "failed") }

  # Instance methods
  def can_be_removed?
    bill_payment_batch.can_add_items? && status.in?(%w[pending approved])
  end

  def sync_to_xero!
    return unless bill_inbox.xero_invoice_id.present?

    # Create payment in Xero against the bill
    # Implementation via XeroApiClient
    XeroBillPaymentSyncJob.perform_later(id)
  end

  def formatted_amount
    "$#{sprintf("%.2f", amount.to_f)}"
  end

  def formatted_bsb
    return nil unless payee_bsb.present?

    "#{payee_bsb[0..2]}-#{payee_bsb[3..5]}"
  end

  def masked_account
    return nil unless payee_account_number.present?

    "****#{payee_account_number.to_s.last(4)}"
  end

  def status_display
    status.humanize.titleize
  end

  def status_color
    case status
    when "pending" then "gray"
    when "approved" then "blue"
    when "paid" then "green"
    when "failed", "reversed" then "red"
    else "gray"
    end
  end

  # Indicator for ABA file (determines tax treatment)
  def indicator
    # Default to self-balanced (space)
    # Could be extended based on payment type
    " "
  end

  private

  def set_defaults
    self.status ||= "pending"
  end

  def normalize_bsb
    self.payee_bsb = payee_bsb.to_s.gsub(/[^0-9]/, "") if payee_bsb.present?
  end

  def update_po_payment_tracking
    return unless purchase_order && status == "paid"

    # Calculate total paid via AP for this PO
    total_paid = BillPayment
      .joins(:bill_inbox)
      .where(bill_inboxes: { matched_purchase_order_id: purchase_order.id })
      .where(status: "paid")
      .sum(:amount)

    purchase_order.update!(
      total_paid_via_ap: total_paid,
      remaining_to_pay: purchase_order.total - total_paid
    )
  end
end
