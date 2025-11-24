class PricebookItem < ApplicationRecord
  # Associations
  belongs_to :supplier, class_name: 'Contact', foreign_key: 'supplier_id', optional: true
  belongs_to :default_supplier, class_name: 'Contact', foreign_key: 'default_supplier_id', optional: true
  belongs_to :pricebook_category, foreign_key: 'category_id', optional: true
  has_many :price_histories, dependent: :destroy

  # Attribute for skipping price history callback
  attr_accessor :skip_price_history_callback

  # Validations
  validates :item_code, presence: true, uniqueness: true
  validates :item_name, presence: true
  validates :current_price, numericality: { allow_nil: true }  # Allow negative prices for rebates/credits
  validates :unit_of_measure, presence: true

  # Callbacks
  before_save :check_pricing_review_status
  before_save :update_price_timestamp, if: :will_save_change_to_current_price?
  after_update :track_price_change, if: :should_track_price_change?

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :needs_pricing, -> { where(needs_pricing_review: true) }
  scope :by_category, ->(category) { where(category: category) if category.present? }
  scope :by_supplier, ->(supplier_id) {
    return all if supplier_id.blank?

    # Search for items where the supplier is either:
    # 1. The default supplier (default_supplier_id)
    # 2. OR appears in the price history (price_histories.supplier_id)
    left_joins(:price_histories)
      .where('pricebook_items.default_supplier_id = :supplier_id OR price_histories.supplier_id = :supplier_id',
             supplier_id: supplier_id)
      .distinct
  }
  scope :price_range, ->(min_price, max_price) {
    query = all
    query = query.where("current_price >= ?", min_price) if min_price.present?
    query = query.where("current_price <= ?", max_price) if max_price.present?
    query
  }

  # Efficient risk level filtering using SQL conditions instead of loading all records
  scope :by_risk_level, ->(level) {
    return all if level.blank?

    # Calculate risk using SQL conditions based on price_freshness_status
    # This is a simplified version optimized for database queries
    case level
    when 'critical'
      # High risk: no price OR price > 6 months old
      where('current_price IS NULL OR current_price = 0 OR price_last_updated_at IS NULL OR price_last_updated_at < ?', 6.months.ago)
    when 'high'
      # Medium-high risk: price 3-6 months old AND has some volatility
      where('current_price IS NOT NULL AND current_price > 0')
        .where('price_last_updated_at >= ? AND price_last_updated_at < ?', 6.months.ago, 3.months.ago)
    when 'medium'
      # Medium risk: price < 3 months but missing supplier info
      where('current_price IS NOT NULL AND current_price > 0')
        .where('price_last_updated_at >= ?', 3.months.ago)
        .where('supplier_id IS NULL OR brand IS NULL OR category IS NULL')
    when 'low'
      # Low risk: recent price AND has supplier info
      where('current_price IS NOT NULL AND current_price > 0')
        .where('price_last_updated_at >= ?', 3.months.ago)
        .where('supplier_id IS NOT NULL')
    end
  }

  # Full-text search including supplier names
  scope :search, ->(query) {
    return all if query.blank?

    # Sanitize the query for ILIKE pattern matching
    sanitized_query = PricebookItem.sanitize_sql_like(query)

    # Search in both the tsvector column AND supplier name (contact full_name)
    # We do a simple ILIKE search on supplier name (joined) and tsquery on searchable_text
    # Note: Using distinct is important because left_joins can create duplicates if multiple suppliers match
    left_joins(:supplier)
      .where(
        "pricebook_items.searchable_text @@ plainto_tsquery('english', :query) OR contacts.full_name ILIKE :like_query",
        query: query,
        like_query: "%#{sanitized_query}%"
      )
      .distinct
  }

  # Class methods
  def self.categories
    where.not(category: nil).distinct.pluck(:category).sort
  end

  def self.units_of_measure
    distinct.pluck(:unit_of_measure).compact.sort
  end

  # Instance methods
  def display_price
    return "No price" if current_price.nil?
    "$#{'%.2f' % current_price}"
  end

  def price_with_unit
    return "#{display_price} per #{unit_of_measure}"
  end

  def has_supplier?
    supplier_id.present?
  end

  def supplier_name
    supplier&.name || "No supplier"
  end

  def latest_price_change
    price_histories.order(created_at: :desc).first
  end

  def price_trend(days: 90)
    histories = price_histories
      .where("created_at >= ?", days.days.ago)
      .order(created_at: :asc)

    return nil if histories.empty?

    first_price = histories.first.old_price || 0
    last_price = histories.last.new_price || current_price || 0

    return 0 if first_price.zero?

    ((last_price - first_price) / first_price * 100).round(2)
  end

  # Price Freshness Status
  def price_age_in_days
    return nil if price_last_updated_at.nil?
    (Time.current - price_last_updated_at).to_i / 1.day
  end

  def price_freshness_status
    return 'missing' if current_price.nil? || current_price.zero?
    return 'unknown' if price_last_updated_at.nil?

    days = price_age_in_days

    if days < 90  # Less than 3 months
      'fresh'
    elsif days < 180  # 3-6 months
      'needs_confirmation'
    else  # 6+ months
      'outdated'
    end
  end

  def price_freshness_label
    case price_freshness_status
    when 'fresh'
      'Fresh'
    when 'needs_confirmation'
      'Needs Confirmation'
    when 'outdated'
      'Outdated'
    when 'missing'
      'No Price'
    when 'unknown'
      'Unknown Age'
    end
  end

  def price_freshness_color
    case price_freshness_status
    when 'fresh'
      'green'
    when 'needs_confirmation'
      'orange'
    when 'outdated'
      'red'
    when 'missing'
      'red'
    when 'unknown'
      'gray'
    end
  end

  # Supplier Reliability Score (0-100)
  def supplier_reliability_score
    return 0 unless supplier

    score = 0

    # Rating contributes 40 points (0-5 rating * 8)
    score += (supplier.rating || 0) * 8

    # Response rate contributes 30 points
    score += (supplier.response_rate || 0) * 0.3

    # Response time contributes 30 points (inverse - faster is better)
    # Assume 48 hours is baseline, < 12 hours is excellent
    if supplier.avg_response_time
      time_score = [30 - (supplier.avg_response_time / 2.0), 0].max
      score += time_score
    end

    score.round
  end

  # Price Volatility (based on price history)
  def price_volatility
    return 'unknown' if price_histories.loaded? ? price_histories.size < 2 : price_histories.count < 2

    # Calculate coefficient of variation from last 6 months
    # Filter in memory to avoid N+1 queries when price_histories is eager loaded
    six_months_ago = 6.months.ago
    recent_prices = price_histories
      .select { |ph| ph.created_at >= six_months_ago }
      .map(&:new_price)
      .compact

    return 'stable' if recent_prices.size < 2

    mean = recent_prices.sum / recent_prices.size.to_f
    variance = recent_prices.map { |p| (p - mean) ** 2 }.sum / recent_prices.size
    std_dev = Math.sqrt(variance)

    # Coefficient of variation
    cv = mean.zero? ? 0 : (std_dev / mean * 100)

    if cv < 5
      'stable'
    elsif cv < 15
      'moderate'
    else
      'volatile'
    end
  end

  def price_volatility_score
    case price_volatility
    when 'stable'
      0  # No risk
    when 'moderate'
      25  # Some risk
    when 'volatile'
      50  # High risk
    else
      10  # Unknown = slight risk
    end
  end

  # Missing Information Risk
  def missing_info_score
    score = 0
    score += 30 unless supplier_id.present?
    score += 20 unless brand.present?
    score += 10 unless category.present?
    score
  end

  # Combined Risk Score (0-100, higher = more risk)
  def risk_score
    return 100 if current_price.nil? || current_price.zero?

    score = 0

    # Price freshness contributes 40 points
    case price_freshness_status
    when 'fresh'
      score += 0
    when 'needs_confirmation'
      score += 20
    when 'outdated', 'unknown'
      score += 40
    end

    # Supplier reliability contributes 20 points (inverse)
    reliability = supplier_reliability_score
    score += [20 - (reliability / 5.0), 0].max

    # Price volatility contributes 20 points
    score += price_volatility_score * 0.4

    # Missing info contributes 20 points
    score += missing_info_score * 0.33

    [score.round, 100].min
  end

  def risk_level
    score = risk_score

    if score < 25
      'low'
    elsif score < 50
      'medium'
    elsif score < 75
      'high'
    else
      'critical'
    end
  end

  def risk_level_label
    case risk_level
    when 'low'
      'Low Risk'
    when 'medium'
      'Medium Risk'
    when 'high'
      'High Risk'
    when 'critical'
      'Critical'
    end
  end

  def risk_level_color
    case risk_level
    when 'low'
      'green'
    when 'medium'
      'yellow'
    when 'high'
      'orange'
    when 'critical'
      'red'
    end
  end

  private

  def check_pricing_review_status
    # Flag items without prices for review
    if current_price.nil? || current_price.zero?
      self.needs_pricing_review = true
    elsif needs_pricing_review && current_price.present? && current_price.positive?
      # Unflag if price is now set
      self.needs_pricing_review = false
    end
  end

  def should_track_price_change?
    saved_change_to_current_price? && !skip_price_history_callback
  end

  def track_price_change
    old_price = saved_change_to_current_price[0]
    new_price = saved_change_to_current_price[1]

    price_histories.create!(
      old_price: old_price,
      new_price: new_price,
      change_reason: "manual_edit",
      supplier_id: supplier_id
    )
  end

  def update_price_timestamp
    self.price_last_updated_at = Time.current if current_price.present?
  end
end
