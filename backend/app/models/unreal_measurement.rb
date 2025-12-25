# UnrealMeasurement - Stores quantity measurements from Unreal 3D Takeoff app
#
# SSoT: This is THE source for measurements taken in the Unreal Engine takeoff tool.
# Measurements can be synced to PurchaseOrderLineItems via sync_to_po endpoint.
#
# measurement_type: "area" (m2), "length" (m), "count" (ea)
# geometry_data: JSON blob containing polygon points, line endpoints, or marker positions
#
class UnrealMeasurement < ApplicationRecord
  # Associations
  belongs_to :job
  belongs_to :job_plan, optional: true
  belongs_to :pricebook_item, class_name: "PricebookItem", optional: true
  belongs_to :job_colour_selection, optional: true
  belongs_to :synced_to_po, class_name: "PurchaseOrder", optional: true

  # Validations
  validates :session_id, presence: true
  validates :measurement_type, presence: true, inclusion: { in: %w[area length count] }
  validates :value, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :unit, presence: true

  # Scopes
  scope :by_session, ->(session_id) { where(session_id: session_id) }
  scope :by_type, ->(type) { where(measurement_type: type) }
  scope :by_category, ->(category) { where(category: category) }
  scope :unsynced, -> { where(synced_to_po_id: nil) }
  scope :synced, -> { where.not(synced_to_po_id: nil) }
  scope :with_pricebook_item, -> { where.not(pricebook_item_id: nil) }

  # Callbacks
  before_validation :set_default_unit, on: :create

  # Instance Methods

  # Calculate line total based on pricebook item price
  def line_total
    return nil unless pricebook_item&.current_price
    value * pricebook_item.current_price
  end

  # Check if measurement has been synced to a PO
  def synced?
    synced_to_po_id.present?
  end

  # Get colour info from linked colour selection
  def colour_info
    return nil unless job_colour_selection
    {
      name: job_colour_selection.colour_name,
      code: job_colour_selection.colour_code,
      brand: job_colour_selection.colour_brand
    }
  end

  # Formatted value with unit
  def formatted_value
    case measurement_type
    when "area"
      "#{value.round(2)} m\u00B2"
    when "length"
      "#{value.round(2)} m"
    when "count"
      "#{value.to_i} ea"
    else
      "#{value} #{unit}"
    end
  end

  private

  def set_default_unit
    return if unit.present?

    self.unit = case measurement_type
    when "area" then "m2"
    when "length" then "m"
    when "count" then "ea"
    else "ea"
    end
  end
end
