# UnrealMeasurement - Stores quantity measurements from takeoff tools
#
# SSoT: This is THE source for measurements taken in either:
# - Unreal Engine 3D takeoff app (source: "unreal")
# - Browser PDF takeoff (source: "pdf_takeoff")
# - Manual entry (source: "manual")
#
# Measurements can be synced to PurchaseOrderLineItems via sync_to_po endpoint.
#
# measurement_type: "area" (m2), "length" (m), "count" (ea), "perimeter" (m)
# geometry_data: JSON blob containing polygon points, line endpoints, or marker positions
#
class UnrealMeasurement < ApplicationRecord
  # Associations
  belongs_to :job, optional: true  # Optional for DocSort standalone takeoff
  belongs_to :job_plan, optional: true
  belongs_to :docsort_item, optional: true  # For standalone takeoff from DocSort
  belongs_to :pricebook_item, class_name: "PricebookItem", optional: true
  belongs_to :job_colour_selection, optional: true
  belongs_to :synced_to_po, class_name: "PurchaseOrder", optional: true

  # PDF Takeoff associations (Feb 2026)
  belongs_to :takeoff_layer, optional: true
  belongs_to :parent_measurement, class_name: "UnrealMeasurement", optional: true
  has_many :deductions, class_name: "UnrealMeasurement", foreign_key: :parent_measurement_id, dependent: :nullify

  # Validations
  validates :session_id, presence: true
  validates :measurement_type, presence: true, inclusion: { in: %w[area length count perimeter] }
  validates :value, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :unit, presence: true
  validates :source, inclusion: { in: %w[unreal pdf_takeoff manual] }, allow_nil: true
  validate :job_or_docsort_present

  # Custom validation: must belong to either a job or a docsort_item
  def job_or_docsort_present
    return if job_id.present? || docsort_item_id.present?
    errors.add(:base, "Measurement must belong to either a job or a docsort_item")
  end

  # Scopes
  scope :by_session, ->(session_id) { where(session_id: session_id) }
  scope :by_type, ->(type) { where(measurement_type: type) }
  scope :by_category, ->(category) { where(category: category) }
  scope :unsynced, -> { where(synced_to_po_id: nil) }
  scope :synced, -> { where.not(synced_to_po_id: nil) }
  scope :with_pricebook_item, -> { where.not(pricebook_item_id: nil) }

  # PDF Takeoff scopes
  scope :from_pdf_takeoff, -> { where(source: "pdf_takeoff") }
  scope :from_unreal, -> { where(source: ["unreal", nil]) }
  scope :deductions, -> { where(is_deduction: true) }
  scope :non_deductions, -> { where(is_deduction: [false, nil]) }
  scope :for_page, ->(page_num) { where(page_number: page_num) }
  scope :for_layer, ->(layer) { where(takeoff_layer: layer) }
  scope :for_docsort, ->(docsort_item) { where(docsort_item: docsort_item) }
  scope :standalone, -> { where.not(docsort_item_id: nil).where(job_id: nil) }

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
    when "length", "perimeter"
      "#{value.round(2)} m"
    when "count"
      "#{value.to_i} ea"
    else
      "#{value} #{unit}"
    end
  end

  # =============================================================================
  # PDF Takeoff Methods (Feb 2026)
  # =============================================================================

  # Calculate net value after deductions
  def net_value
    return value unless deductions.any?

    deduction_total = deductions.sum(:value)
    [value - deduction_total, 0].max
  end

  # Formatted net value
  def formatted_net_value
    case measurement_type
    when "area"
      "#{net_value.round(2)} m\u00B2"
    when "length", "perimeter"
      "#{net_value.round(2)} m"
    else
      formatted_value
    end
  end

  # Check if this is a PDF takeoff measurement
  def from_pdf_takeoff?
    source == "pdf_takeoff"
  end

  # Check if this is a deduction
  def deduction?
    is_deduction == true
  end

  # Get display label (for count markers) or generate one
  def label
    display_label.presence || (measurement_type == "count" ? id.to_s : nil)
  end

  # Get effective color (layer color or override)
  def effective_color
    color.presence || takeoff_layer&.color || "#3B82F6"
  end

  # Calculate line total using net value (after deductions)
  def net_line_total
    return nil unless pricebook_item&.current_price

    net_value * pricebook_item.current_price
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
