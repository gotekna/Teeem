class Payment < ApplicationRecord
  # Associations
  belongs_to :purchase_order
  belongs_to :created_by, class_name: "User", optional: true

  # Validations
  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :payment_date, presence: true
  validates :payment_method, inclusion: {
    in: %w[bank_transfer check credit_card cash eft other],
    message: "%{value} is not a valid payment method"
  }, allow_nil: true

  # Callbacks
  after_save :update_purchase_order_payment_status
  after_destroy :update_purchase_order_payment_status

  # Scopes
  scope :recent, -> { order(payment_date: :desc) }
  scope :by_purchase_order, ->(po_id) { where(purchase_order_id: po_id) if po_id.present? }
  scope :synced_to_xero, -> { where.not(xero_payment_id: nil) }
  scope :not_synced_to_xero, -> { where(xero_payment_id: nil) }
  scope :with_sync_errors, -> { where.not(xero_sync_error: nil) }

  # Instance methods
  def synced_to_xero?
    xero_payment_id.present? && xero_synced_at.present?
  end

  def sync_error?
    xero_sync_error.present?
  end

  def mark_synced!(xero_id)
    update!(
      xero_payment_id: xero_id,
      xero_synced_at: Time.current,
      xero_sync_error: nil
    )
  end

  def mark_sync_failed!(error_message)
    update!(
      xero_sync_error: error_message
    )
  end

  private

  def update_purchase_order_payment_status
    # Recalculate PO payment status based on total payments
    total_payments = purchase_order.payments.sum(:amount)
    po_total = purchase_order.total || 0

    if total_payments.zero?
      purchase_order.update(payment_status: "pending")
    elsif total_payments >= po_total
      purchase_order.update(
        payment_status: "complete",
        xero_amount_paid: total_payments,
        xero_complete: true
      )
    else
      purchase_order.update(
        payment_status: "part_payment",
        xero_amount_paid: total_payments,
        xero_complete: false
      )
    end
  end
end
