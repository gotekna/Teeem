# World-Class Asset Register - ATO Effective Life Rate
# Rates from ATO Tax Ruling TR 2023/1
class AtoEffectiveLifeRate < ApplicationRecord
  belongs_to :ato_effective_life_category

  # Validations
  validates :description, presence: true
  validates :effective_life_years, presence: true, numericality: { greater_than: 0 }
  validates :effective_from, presence: true
  validates :division_43_rate, numericality: { in: [2.5, 4.0] }, if: :is_division_43?

  # Scopes
  scope :current, -> { where(effective_until: nil).or(where("effective_until >= ?", Date.current)) }
  scope :for_date, ->(date) {
    where("effective_from <= ? AND (effective_until IS NULL OR effective_until >= ?)", date, date)
  }
  scope :division_43, -> { where(is_division_43: true) }
  scope :not_division_43, -> { where(is_division_43: false) }

  # Callbacks
  before_save :calculate_rates

  # Search for matching assets
  def self.search(query)
    where("description ILIKE ?", "%#{query}%").current.limit(20)
  end

  # Get straight-line depreciation rate
  def straight_line_rate_percent
    straight_line_rate || (100.0 / effective_life_years).round(2)
  end

  # Get diminishing value depreciation rate (200% method)
  def diminishing_value_rate_percent
    diminishing_value_rate || (200.0 / effective_life_years).round(2)
  end

  # Display-friendly effective life
  def display_effective_life
    if effective_life_years == effective_life_years.to_i
      "#{effective_life_years.to_i} years"
    else
      "#{effective_life_years} years"
    end
  end

  private

  def calculate_rates
    return unless effective_life_years.present? && effective_life_years > 0

    self.straight_line_rate ||= (100.0 / effective_life_years).round(4)
    self.diminishing_value_rate ||= (200.0 / effective_life_years).round(4)
  end
end
