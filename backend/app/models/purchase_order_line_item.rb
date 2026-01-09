class PurchaseOrderLineItem < ApplicationRecord
  # GST codes and their tax rates
  GST_CODES = {
    "GST" => 0.10,        # Standard GST (10%)
    "GST Free" => 0.00,   # GST Free
    "Input Taxed" => 0.00 # Input Taxed (no GST claim)
  }.freeze

  # Associations
  belongs_to :purchase_order
  belongs_to :pricebook_item, optional: true

  # Validations
  validates :description, presence: true
  # Note: allow_nil: false + numericality ensures value is present AND valid
  # Using presence: true would reject 0 because 0.blank? is true in Rails
  validates :quantity, numericality: { greater_than_or_equal_to: 0, allow_nil: false }
  validates :unit_price, numericality: { greater_than_or_equal_to: 0, allow_nil: false }
  validates :line_number, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :gst_code, inclusion: { in: GST_CODES.keys }, allow_nil: true

  # Callbacks
  before_validation :set_line_number, if: :new_record?
  before_validation :set_defaults_from_pricebook_item, if: -> { pricebook_item.present? }
  before_save :calculate_totals
  after_save :update_purchase_order_totals
  after_destroy :update_purchase_order_totals

  # Scopes
  scope :ordered, -> { order(:line_number) }

  # Instance methods
  def calculate_totals
    line_subtotal = (quantity || 0) * (unit_price || 0)
    # Calculate tax based on GST code (default to 10% GST if not specified)
    tax_rate = GST_CODES[gst_code] || 0.10
    self.tax_amount = (line_subtotal * tax_rate).round(2)
    self.total_amount = (line_subtotal + tax_amount).round(2)
  end

  # Get the tax rate for this line item
  def tax_rate
    GST_CODES[gst_code] || 0.10
  end

  # Price drift detection
  def price_drift
    return nil unless pricebook_item && pricebook_item.current_price
    current = pricebook_item.current_price
    return 0 if current.nil? || unit_price.nil? || unit_price.zero?
    ((current - unit_price) / unit_price * 100).round(2)
  end

  def price_outdated?
    drift = price_drift
    drift && drift.abs > 10 # 10% threshold
  end

  def price_status
    return "no_pricebook_item" unless pricebook_item
    return "no_current_price" unless pricebook_item.current_price

    drift = price_drift
    return "in_sync" if drift.abs < 0.01 # Within 1 cent

    if drift.abs <= 10
      "minor_drift"
    else
      "major_drift"
    end
  end

  def price_status_label
    case price_status
    when "no_pricebook_item"
      "Not linked to pricebook"
    when "no_current_price"
      "Pricebook item has no price"
    when "in_sync"
      "Price up to date"
    when "minor_drift"
      "Price drift: #{price_drift}%"
    when "major_drift"
      "WARNING: Price drift: #{price_drift}%"
    end
  end

  private

  def set_line_number
    return if line_number.present?

    max_line = purchase_order&.line_items&.maximum(:line_number) || 0
    self.line_number = max_line + 1
  end

  def set_defaults_from_pricebook_item
    return unless pricebook_item

    self.description = pricebook_item.item_name if description.blank?
    self.unit_price = pricebook_item.current_price if unit_price.zero?
    self.gst_code = pricebook_item.gst_code if pricebook_item.gst_code.present? && gst_code.blank?
    # Auto-fill colour from pricebook item if not set
    self.colour = pricebook_item.colour if colour.blank? && pricebook_item.colour.present?
    self.colour_code = pricebook_item.colour_code if colour_code.blank? && pricebook_item.colour_code.present?
  end

  # Trigger parent PO to recalculate totals when line items change
  def update_purchase_order_totals
    # Reload to get fresh line_items, then save to trigger calculate_totals callback
    purchase_order.reload.save! if purchase_order.present?
  end
end
