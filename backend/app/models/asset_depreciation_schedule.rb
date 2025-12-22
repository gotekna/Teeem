# World-Class Asset Register - Depreciation Schedule (year-by-year records)
class AssetDepreciationSchedule < ApplicationRecord
  belongs_to :asset
  belongs_to :finalized_by, class_name: "User", optional: true

  # Status values
  STATUSES = %w[draft calculated finalized].freeze

  # Validations
  validates :financial_year, presence: true, uniqueness: { scope: :asset_id }
  validates :period_start, :period_end, presence: true
  validates :days_held, presence: true, numericality: { greater_than: 0 }
  validates :days_in_year, presence: true, numericality: { greater_than: 0 }
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :for_year, ->(fy) { where(financial_year: fy) }
  scope :finalized, -> { where(status: "finalized") }
  scope :draft, -> { where(status: "draft") }
  scope :calculated, -> { where(status: "calculated") }
  scope :chronological, -> { order(period_start: :asc) }
  scope :reverse_chronological, -> { order(period_start: :desc) }

  # Finalize a schedule (lock it for audit)
  def finalize!(user)
    return false if status == "finalized"

    update!(
      status: "finalized",
      finalized_at: Time.current,
      finalized_by: user
    )
    true
  end

  # Can this schedule be edited?
  def editable?
    status.in?(%w[draft calculated])
  end

  # Book depreciation as percentage of purchase price
  def book_depreciation_percentage
    return 0 if asset.purchase_price.to_f.zero?
    ((book_depreciation / asset.purchase_price) * 100).round(2)
  end

  # Tax depreciation as percentage of purchase price
  def tax_depreciation_percentage
    return 0 if asset.purchase_price.to_f.zero?
    ((tax_depreciation / asset.purchase_price) * 100).round(2)
  end

  # Display-friendly financial year
  def display_financial_year
    financial_year # Already in format "FY2025"
  end

  # Parse financial year string to date range
  def self.parse_financial_year(fy_string)
    # Parse "FY2025" to get July 1, 2024 - June 30, 2025
    year = fy_string.gsub(/FY/, "").to_i
    {
      start: Date.new(year - 1, 7, 1),
      end: Date.new(year, 6, 30)
    }
  end

  # Get financial year string for a given date (Australian FY)
  def self.financial_year_for_date(date)
    # If July or later, it's the next calendar year's FY
    fy_year = date.month >= 7 ? date.year + 1 : date.year
    "FY#{fy_year}"
  end

  # Current financial year
  def self.current_financial_year
    financial_year_for_date(Date.current)
  end
end
