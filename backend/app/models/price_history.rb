class PriceHistory < ApplicationRecord
  # Associations
  # Note: PricebookItem uses table_name = 'pricebook', not 'pricebook_items'
  belongs_to :pricebook_item, class_name: "PricebookItem"
  belongs_to :supplier, class_name: "Contact", foreign_key: "supplier_id", optional: true

  # SSoT: Update contact's cached supplier flag when price history changes
  after_commit :refresh_supplier_cached_flag, on: [:create, :destroy]
  after_commit :refresh_supplier_cached_flag_on_supplier_change, on: :update, if: :saved_change_to_supplier_id?

  # Validations
  validates :pricebook_item_id, presence: true
  validates :new_price, numericality: { allow_nil: true }  # Allow negative prices for rebates/credits
  validates :old_price, numericality: { allow_nil: true }  # Allow negative prices for rebates/credits
  validates :lga, inclusion: {
    in: [
      "Toowoomba Regional Council",
      "Lockyer Valley Regional Council",
      "City of Gold Coast",
      "Brisbane City Council",
      "Sunshine Coast Regional Council",
      "Redland City Council",
      "Scenic Rim Regional Council"
    ],
    allow_nil: true
  }

  # Prevent duplicate entries (custom validation for better error messages)
  validate :prevent_duplicate_price_history, on: :create

  private

  def prevent_duplicate_price_history
    # The unique database constraint will prevent duplicates
    # This validation just provides a friendlier error message
    duplicate = PriceHistory.where(
      pricebook_item_id: pricebook_item_id,
      supplier_id: supplier_id,
      new_price: new_price
    ).where("created_at >= ?", 5.seconds.ago).exists?

    if duplicate
      errors.add(:base, "A price history entry with these values was just created. Please wait a moment before updating again.")
    end
  end

  public

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :for_item, ->(item_id) { where(pricebook_item_id: item_id) }
  scope :significant_changes, ->(threshold = 20) {
    where("ABS((new_price - old_price) / NULLIF(old_price, 0) * 100) >= ?", threshold)
  }

  # Instance methods
  def price_change_amount
    return nil if old_price.nil? || new_price.nil?
    new_price - old_price
  end

  def price_change_percentage
    return nil if old_price.nil? || old_price.zero? || new_price.nil?
    ((new_price - old_price) / old_price * 100).round(2)
  end

  def price_increased?
    price_change_amount.to_f > 0
  end

  def price_decreased?
    price_change_amount.to_f < 0
  end

  def significant_change?(threshold = 20)
    return false if price_change_percentage.nil?
    price_change_percentage.abs >= threshold
  end

  def display_change
    return "N/A" if price_change_amount.nil?

    amount = price_change_amount
    percentage = price_change_percentage

    direction = amount.positive? ? "+" : ""
    "#{direction}$#{'%.2f' % amount} (#{direction}#{percentage}%)"
  end

  def change_type
    return "no_change" if price_change_amount.to_f.zero?
    price_increased? ? "increase" : "decrease"
  end

  def formatted_old_price
    return "No price" if old_price.nil?
    "$#{'%.2f' % old_price}"
  end

  def formatted_new_price
    return "No price" if new_price.nil?
    "$#{'%.2f' % new_price}"
  end

  def supplier_name
    supplier&.name || "Unknown"
  end

  private

  # SSoT: Refresh contact's is_supplier_cached flag
  def refresh_supplier_cached_flag
    return unless supplier_id.present?
    supplier&.refresh_supplier_flag!
  rescue StandardError => e
    Rails.logger.error("PriceHistory##{id}: Failed to refresh supplier flag - #{e.message}")
  end

  # SSoT: Handle supplier_id change - refresh both old and new supplier
  def refresh_supplier_cached_flag_on_supplier_change
    old_supplier_id, new_supplier_id = saved_change_to_supplier_id

    # Refresh old supplier (may no longer be a supplier)
    if old_supplier_id.present?
      Contact.find_by(id: old_supplier_id)&.refresh_supplier_flag!
    end

    # Refresh new supplier
    if new_supplier_id.present?
      Contact.find_by(id: new_supplier_id)&.refresh_supplier_flag!
    end
  rescue StandardError => e
    Rails.logger.error("PriceHistory##{id}: Failed to refresh supplier flag on change - #{e.message}")
  end
end
