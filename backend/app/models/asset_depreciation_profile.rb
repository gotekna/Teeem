# World-Class Asset Register - Depreciation Profile (per-asset settings)
# SSoT for depreciation method, effective life, and rates
class AssetDepreciationProfile < ApplicationRecord
  belongs_to :asset

  # Depreciation methods
  BOOK_METHODS = %w[straight_line diminishing_value].freeze
  TAX_METHODS = %w[straight_line diminishing_value low_value_pool instant_writeoff division_43].freeze

  # Validations
  validates :depreciable_cost, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :depreciation_start_date, presence: true
  validates :book_method, inclusion: { in: BOOK_METHODS }
  validates :tax_method, inclusion: { in: TAX_METHODS }
  validates :residual_value, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :effective_life_years, numericality: { greater_than: 0 }, allow_nil: true
  validates :division_43_rate, inclusion: { in: [2.5, 4.0], message: "must be 2.5 or 4.0" }, if: :is_division_43?

  # Callbacks
  before_save :calculate_depreciation_rates
  before_save :set_division_43_rate

  # Scopes
  scope :straight_line, -> { where(book_method: "straight_line") }
  scope :diminishing_value, -> { where(tax_method: "diminishing_value") }
  scope :in_pool, -> { where(in_low_value_pool: true) }
  scope :division_43, -> { where(is_division_43: true) }

  # Calculate current Written Down Value
  def current_book_wdv
    latest_schedule = asset.depreciation_schedules.order(period_end: :desc).first
    latest_schedule&.book_closing_wdv || depreciable_cost
  end

  def current_tax_wdv
    latest_schedule = asset.depreciation_schedules.order(period_end: :desc).first
    latest_schedule&.tax_closing_wdv || depreciable_cost
  end

  # Calculate depreciation for a year (pro-rata for part years)
  def calculate_yearly_depreciation(type, opening_wdv, days_held = 365, days_in_year = 365)
    method = type == :book ? book_method : tax_method
    rate = type == :book ? book_rate : tax_rate
    residual = residual_value || 0

    yearly_amount = case method
    when "straight_line"
      (depreciable_cost - residual) / (effective_life_years || 10)
    when "diminishing_value"
      opening_wdv * (rate / 100.0)
    when "instant_writeoff"
      return instant_writeoff_applied ? 0 : depreciable_cost
    when "low_value_pool"
      # First year: 18.75%, Subsequent years: 37.5%
      pool_rate = in_low_value_pool && pool_entry_date && pool_entry_date < 1.year.ago ? 37.5 : 18.75
      opening_wdv * (pool_rate / 100.0)
    when "division_43"
      depreciable_cost * ((division_43_rate || 2.5) / 100.0)
    else
      0
    end

    # Pro-rata for part years
    pro_rata_amount = yearly_amount * (days_held.to_f / days_in_year)

    # Never depreciate below residual value
    max_depreciation = [opening_wdv - residual, 0].max
    [pro_rata_amount, max_depreciation].min.round(2)
  end

  # Depreciable amount (cost minus residual)
  def depreciable_amount
    depreciable_cost - (residual_value || 0)
  end

  # Total depreciation to date
  def total_book_depreciation
    asset.depreciation_schedules.sum(:book_depreciation)
  end

  def total_tax_depreciation
    asset.depreciation_schedules.sum(:tax_depreciation)
  end

  private

  def calculate_depreciation_rates
    return unless effective_life_years.present? && effective_life_years > 0

    # Straight-line rate = 100% / life
    self.book_rate ||= (100.0 / effective_life_years).round(4)

    # Diminishing value rate = 200% / life (ATO formula for assets after May 2006)
    self.tax_rate ||= (200.0 / effective_life_years).round(4)
  end

  def set_division_43_rate
    return unless is_division_43? && division_43_rate.nil?

    # Buildings commenced before 27 Feb 1992 get 4%, after get 2.5%
    construction_date = asset.construction_date
    self.division_43_rate = if construction_date && construction_date < Date.new(1992, 2, 27)
                              4.0
    else
                              2.5
    end
  end
end
