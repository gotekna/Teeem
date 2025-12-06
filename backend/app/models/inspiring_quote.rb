class InspiringQuote < ApplicationRecord
  # Validations
  validates :quote, presence: true
  validates :is_active, inclusion: { in: [ true, false ] }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(display_order: :asc, created_at: :desc) }

  # Class methods
  def self.random_active
    active.order("RANDOM()").first
  end

  def self.daily_quote
    # Get a consistent quote for the day based on day of year
    active_quotes = active.ordered.to_a
    return nil if active_quotes.empty?

    day_of_year = Time.current.yday
    active_quotes[day_of_year % active_quotes.length]
  end
end
