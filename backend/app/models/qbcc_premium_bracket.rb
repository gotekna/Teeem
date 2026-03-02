# frozen_string_literal: true

# QbccPremiumBracket - Lookup table for QBCC Home Warranty Insurance premiums
#
# QLD statutory premium based on insurable value (contract inc GST, excluding QBCC itself).
# Table has brackets in $1,000 increments with base premium + rate per additional $1,000.
#
# Categories:
#   - new_home: New residential construction
#   - alterations: Renovations/alterations
#
# Usage:
#   QbccPremiumBracket.lookup_premium(436_336.00)  # => 2430.12
#
class QbccPremiumBracket < ApplicationRecord
  validates :category, presence: true
  validates :min_value, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :max_value, numericality: { greater_than: 0 }, allow_nil: true
  validates :premium, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :rate_per_thousand, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  scope :for_category, ->(cat) { where(category: cat).order(:min_value) }

  # Look up QBCC premium for a given insurable value
  #
  # Finds the bracket where min_value <= insurable_value < max_value (or max_value is nil for top bracket).
  # Interpolates within the bracket: base_premium + rate_per_thousand × (value - min_value) / 1000
  #
  # Returns 0.0 if no brackets configured or value below minimum.
  def self.lookup_premium(insurable_value, category: "new_home")
    return 0.0 if insurable_value.nil? || insurable_value <= 0

    brackets = for_category(category)
    return 0.0 if brackets.empty?

    # Find matching bracket
    bracket = brackets.where("min_value <= ?", insurable_value)
                      .where("max_value IS NULL OR max_value > ?", insurable_value)
                      .first

    # If value is below first bracket or above all brackets, use closest
    bracket ||= if insurable_value < brackets.first.min_value
                  return 0.0 # Below minimum threshold
                else
                  brackets.last # Above all brackets, use top bracket
                end

    base = bracket.premium || 0
    rate = bracket.rate_per_thousand || 0
    excess = [insurable_value - bracket.min_value, 0].max

    (base + rate * excess / 1000.0).round(2)
  end
end
