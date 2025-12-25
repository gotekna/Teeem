# frozen_string_literal: true

class PaymentLink < ApplicationRecord
  # Associations
  belongs_to :invoice, class_name: "ExternalInvoice"
  belongs_to :contact
  belongs_to :created_by, polymorphic: true, optional: true
  has_many :payments, dependent: :nullify

  # Constants
  STATUSES = %w[active expired paid cancelled].freeze

  # Validations
  validates :token, presence: true, uniqueness: true
  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :currency, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  # Callbacks
  before_validation :generate_token, on: :create
  before_validation :set_defaults, on: :create

  # Scopes
  scope :active, -> { where(status: "active").where("expires_at IS NULL OR expires_at > ?", Time.current) }
  scope :expired, -> { where("status = 'expired' OR (status = 'active' AND expires_at <= ?)", Time.current) }
  scope :paid, -> { where(status: "paid") }
  scope :recent, -> { order(created_at: :desc) }

  # Class Methods

  # Create a payment link for an invoice
  def self.create_for_invoice!(invoice, created_by: nil, expires_in: 30.days)
    create!(
      invoice: invoice,
      contact: invoice.contact,
      amount: invoice.amount_due,
      currency: invoice.currency_code || "AUD",
      expires_at: expires_in ? Time.current + expires_in : nil,
      created_by: created_by
    )
  end

  # Find by token (for public access)
  def self.find_by_token!(token)
    link = find_by!(token: token)
    link.check_expiration!
    link
  end

  # Instance Methods

  # Check if link is valid for payment
  def valid_for_payment?
    active? && !expired? && invoice.amount_due.positive?
  end

  def active?
    status == "active"
  end

  def expired?
    return true if status == "expired"
    expires_at.present? && expires_at <= Time.current
  end

  def paid?
    status == "paid"
  end

  def cancelled?
    status == "cancelled"
  end

  # Update expiration status
  def check_expiration!
    return unless active? && expires_at.present? && expires_at <= Time.current
    update!(status: "expired")
  end

  # Mark as paid
  def mark_paid!(payment_intent_id: nil)
    update!(
      status: "paid",
      paid_at: Time.current,
      stripe_payment_intent_id: payment_intent_id
    )
  end

  # Record a view
  def record_view!
    increment!(:view_count)
    update_column(:last_viewed_at, Time.current)
  end

  # Cancel the link
  def cancel!
    update!(status: "cancelled")
  end

  # Get the public payment URL
  def payment_url
    # This will be configured based on environment
    base_url = Rails.application.config.payment_portal_url || "https://pay.teeem.com"
    "#{base_url}/pay/#{token}"
  end

  # Refresh amount from invoice (in case invoice amount changed)
  def refresh_amount!
    return false unless active?
    update!(amount: invoice.amount_due)
  end

  private

  def generate_token
    return if token.present?
    self.token = SecureRandom.urlsafe_base64(32)
  end

  def set_defaults
    self.status ||= "active"
    self.currency ||= "AUD"
  end
end
