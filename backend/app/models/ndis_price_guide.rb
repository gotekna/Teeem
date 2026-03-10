class NdisPriceGuide < ApplicationRecord
  validates :design_category, :resident_count, :daily_rate, :effective_from, presence: true
  validates :design_category, inclusion: { in: Property::SDA_CATEGORIES }
  validates :daily_rate, numericality: { greater_than: 0 }
  validates :resident_count, numericality: { only_integer: true, greater_than: 0 }

  scope :current, -> { where("effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)", Date.current, Date.current) }
  scope :for_category, ->(cat) { where(design_category: cat) }
  scope :for_financial_year, ->(fy) { where(financial_year: fy) }

  # Find the applicable rate for a given category, resident count and date
  def self.rate_for(design_category:, resident_count:, date: Date.current)
    where(design_category: design_category, resident_count: resident_count)
      .where("effective_from <= ?", date)
      .where("effective_to IS NULL OR effective_to >= ?", date)
      .order(effective_from: :desc)
      .first
  end

  # All rates active at a given date
  def self.active_at(date = Date.current)
    where("effective_from <= ?", date)
      .where("effective_to IS NULL OR effective_to >= ?", date)
      .order(:design_category, :resident_count)
  end

  def active?
    effective_from <= Date.current &&
      (effective_to.nil? || effective_to >= Date.current)
  end

  def daily_rate_with_gst
    (daily_rate * 1.1).round(2)
  end
end
