# frozen_string_literal: true

# CustomPricing - Per-customer pricing overrides
#
# Allows TEEEM staff to set custom pricing for specific SaaS customers
# instead of using the default tiered percentage pricing.
#
# Pricing types:
#   - default: Use standard tiered pricing from SaasPricingService
#   - percentage: Custom percentage rate (overrides tiered %)
#   - flat_fee: Fixed monthly fee
#   - per_job: Fixed fee per job (charged when customer receives deposit)
#
class CustomPricing < ApplicationRecord
  belongs_to :contact

  # =============================================================================
  # Constants
  # =============================================================================
  PRICING_TYPES = %w[default percentage flat_fee per_job].freeze

  # =============================================================================
  # Validations
  # =============================================================================
  validates :contact_id, uniqueness: true
  validates :pricing_type, presence: true, inclusion: { in: PRICING_TYPES }

  # Validate appropriate field is set for pricing type
  validate :validate_pricing_fields

  # =============================================================================
  # Callbacks
  # =============================================================================
  before_validation :set_defaults, on: :create

  # =============================================================================
  # Scopes
  # =============================================================================
  scope :custom_rates, -> { where.not(pricing_type: "default") }

  # =============================================================================
  # Class Methods
  # =============================================================================

  # Get custom pricing for a contact, or nil if using default
  def self.for_contact(contact)
    find_by(contact: contact)
  end

  # Check if a contact has custom pricing
  def self.custom_pricing?(contact)
    exists?(contact: contact, pricing_type: PRICING_TYPES - ["default"])
  end

  # =============================================================================
  # Instance Methods
  # =============================================================================

  # Check if using default tiered pricing
  def default_pricing?
    pricing_type == "default"
  end

  # Check if using percentage pricing
  def percentage_pricing?
    pricing_type == "percentage"
  end

  # Check if using flat fee pricing
  def flat_fee_pricing?
    pricing_type == "flat_fee"
  end

  # Check if using per-job pricing
  def per_job_pricing?
    pricing_type == "per_job"
  end

  # Calculate fee for a given job value
  # Returns the fee amount (without GST)
  def calculate_fee(job_value)
    case pricing_type
    when "percentage"
      job_value * (custom_percentage / 100)
    when "flat_fee"
      monthly_fee
    when "per_job"
      per_job_fee
    else
      # Default - should use SaasPricingService
      nil
    end
  end

  # Calculate fee with GST
  def calculate_fee_with_gst(job_value)
    fee = calculate_fee(job_value)
    return nil unless fee

    if gst_included
      fee
    else
      fee * 1.1  # Add 10% GST
    end
  end

  # Human-readable description of the pricing
  def description
    case pricing_type
    when "default"
      "Default tiered pricing"
    when "percentage"
      "#{custom_percentage}% of job value#{gst_included ? ' (GST inc)' : ''}"
    when "flat_fee"
      "$#{monthly_fee.to_i}/month#{gst_included ? ' (GST inc)' : ''}"
    when "per_job"
      "$#{per_job_fee.to_i}/job#{gst_included ? ' (GST inc)' : ''}"
    end
  end

  private

  def set_defaults
    self.pricing_type ||= "default"
    self.gst_included ||= false
  end

  def validate_pricing_fields
    case pricing_type
    when "percentage"
      if custom_percentage.blank? || custom_percentage <= 0
        errors.add(:custom_percentage, "must be greater than 0 for percentage pricing")
      end
    when "flat_fee"
      if monthly_fee.blank? || monthly_fee <= 0
        errors.add(:monthly_fee, "must be greater than 0 for flat fee pricing")
      end
    when "per_job"
      if per_job_fee.blank? || per_job_fee <= 0
        errors.add(:per_job_fee, "must be greater than 0 for per job pricing")
      end
    end
  end
end
