# frozen_string_literal: true

class StripeConfiguration < ApplicationRecord
  # Associations
  belongs_to :organization, optional: true

  # Encryption
  encrypts :webhook_secret_encrypted

  # Validations
  validates :organization_id, uniqueness: true, allow_nil: true

  # Scopes
  scope :enabled, -> { where(enabled: true) }

  # Class Methods

  # Get the current active configuration
  def self.current
    enabled.first || new
  end

  # Check if Stripe is configured
  def self.configured?
    enabled.exists?
  end

  # Instance Methods

  def configured?
    enabled? && stripe_api_key_present?
  end

  # Check if API key is set in environment
  def stripe_api_key_present?
    ENV["STRIPE_SECRET_KEY"].present?
  end

  # Payment methods enabled
  def card_payments_enabled?
    payment_methods_enabled["card"] == true
  end

  def bank_transfer_enabled?
    payment_methods_enabled["bank_transfer"] == true
  end

  # Calculate surcharge amount
  def calculate_surcharge(amount)
    return 0 unless surcharge_percentage.positive?
    (amount * surcharge_percentage / 100).round(2)
  end

  # Total amount with surcharge
  def total_with_surcharge(amount)
    amount + calculate_surcharge(amount)
  end

  # Check minimum payment
  def meets_minimum?(amount)
    amount >= (minimum_payment || 0)
  end
end
