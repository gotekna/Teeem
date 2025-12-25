# frozen_string_literal: true

class StripePayment < ApplicationRecord
  # Associations
  belongs_to :payment_link, optional: true
  belongs_to :invoice, class_name: "ExternalInvoice"
  belongs_to :contact

  # Constants
  STATUSES = %w[pending processing succeeded failed refunded partially_refunded cancelled].freeze
  PAYMENT_METHODS = %w[card bank_transfer].freeze

  # Validations
  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :currency, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  # Callbacks
  before_validation :set_defaults, on: :create
  after_save :sync_invoice_payment, if: :succeeded?

  # Scopes
  scope :successful, -> { where(status: "succeeded") }
  scope :pending, -> { where(status: %w[pending processing]) }
  scope :failed, -> { where(status: "failed") }
  scope :refunded, -> { where(status: %w[refunded partially_refunded]) }
  scope :recent, -> { order(created_at: :desc) }
  scope :for_invoice, ->(invoice_id) { where(invoice_id: invoice_id) }
  scope :today, -> { where("paid_at >= ?", Date.current.beginning_of_day) }

  # Class Methods

  # Create a pending payment
  def self.create_pending!(invoice:, contact:, amount:, payment_link: nil, payment_intent_id: nil, metadata: {})
    create!(
      invoice: invoice,
      contact: contact,
      payment_link: payment_link,
      amount: amount,
      currency: invoice.currency_code || "AUD",
      status: "pending",
      stripe_payment_intent_id: payment_intent_id,
      metadata: metadata
    )
  end

  # Instance Methods

  def pending?
    status == "pending"
  end

  def processing?
    status == "processing"
  end

  def succeeded?
    status == "succeeded"
  end

  def failed?
    status == "failed"
  end

  def refunded?
    status.in?(%w[refunded partially_refunded])
  end

  # Mark as processing (payment started)
  def mark_processing!
    update!(status: "processing")
  end

  # Mark as succeeded (payment completed)
  def mark_succeeded!(stripe_data = {})
    transaction do
      self.status = "succeeded"
      self.paid_at = Time.current
      self.stripe_charge_id = stripe_data[:charge_id]
      self.stripe_receipt_url = stripe_data[:receipt_url]
      self.card_brand = stripe_data[:card_brand]
      self.card_last4 = stripe_data[:card_last4]
      self.payment_method = stripe_data[:payment_method] || "card"
      self.stripe_fee = stripe_data[:fee]
      self.net_amount = amount - (stripe_fee || 0)
      self.stripe_metadata = stripe_data
      save!

      # Mark payment link as paid
      payment_link&.mark_paid!(payment_intent_id: stripe_payment_intent_id)
    end
  end

  # Mark as failed
  def mark_failed!(reason = nil)
    update!(
      status: "failed",
      failure_reason: reason
    )
  end

  # Process a refund
  def refund!(amount_to_refund: nil, reason: nil)
    amount_to_refund ||= amount

    return false unless succeeded?
    return false if amount_to_refund > amount - (refunded_amount || 0)

    transaction do
      new_refunded = (refunded_amount || 0) + amount_to_refund
      new_status = new_refunded >= amount ? "refunded" : "partially_refunded"

      update!(
        status: new_status,
        refunded_amount: new_refunded,
        refunded_at: Time.current
      )

      # Create refund in Stripe
      if stripe_payment_intent_id.present?
        StripePaymentService.new.refund_payment(
          payment_intent_id: stripe_payment_intent_id,
          amount: amount_to_refund,
          reason: reason
        )
      end

      true
    end
  end

  # Display helpers
  def display_status
    case status
    when "succeeded" then "Paid"
    when "pending" then "Pending"
    when "processing" then "Processing"
    when "failed" then "Failed"
    when "refunded" then "Refunded"
    when "partially_refunded" then "Partially Refunded"
    else status.humanize
    end
  end

  def card_display
    return nil unless card_brand && card_last4
    "#{card_brand.capitalize} •••• #{card_last4}"
  end

  private

  def set_defaults
    self.status ||= "pending"
    self.currency ||= "AUD"
  end

  # Sync payment to the invoice
  def sync_invoice_payment
    return unless invoice

    # Update invoice payment amounts
    total_paid = StripePayment.successful.for_invoice(invoice.id).sum(:amount)
    invoice.update!(
      amount_paid: total_paid,
      amount_due: invoice.total - total_paid,
      status: total_paid >= invoice.total ? "paid" : "partial"
    )

    # If fully paid, record the date
    if total_paid >= invoice.total && invoice.fully_paid_date.nil?
      invoice.update!(fully_paid_date: Time.current)
    end
  end
end
