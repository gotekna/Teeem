# frozen_string_literal: true

# TakeoffRoomSlot - A single measurement slot within a room instance
#
# Pre-created from template steps when a room instance is created.
# Each slot represents one measurement to be taken (e.g., "Floor Area").
# Slots track whether they've been filled and the resulting quantity.
#
# One measurement per slot (v1). The measurement backlink on TakeoffMeasurement
# enables cleanup when a measurement is deleted.
#
class TakeoffRoomSlot < ApplicationRecord
  # Associations
  belongs_to :takeoff_room_instance
  belongs_to :pricebook_item, class_name: "PricebookItem", optional: true
  belongs_to :measurement, class_name: "TakeoffMeasurement", optional: true

  # Validations
  validates :step_index, presence: true, uniqueness: { scope: :takeoff_room_instance_id }
  validates :label, presence: true
  validates :measurement_type, presence: true, inclusion: { in: %w[count area linear perimeter] }

  # Scopes
  scope :ordered, -> { order(:step_index) }
  scope :filled, -> { where(is_filled: true) }
  scope :unfilled, -> { where(is_filled: false) }
  scope :with_pricebook, -> { where.not(pricebook_item_id: nil) }

  # =============================================================================
  # Fill / Clear
  # =============================================================================

  # Fill this slot with a measurement
  def fill!(measurement_record)
    update!(
      measurement: measurement_record,
      quantity: measurement_record.net_value,
      is_filled: true
    )

    # Set backlink on measurement
    measurement_record.update!(takeoff_room_slot_id: id)
  end

  # Clear this slot (measurement was deleted or user manually clears)
  def clear!
    old_measurement = measurement
    update!(
      measurement: nil,
      quantity: 0,
      is_filled: false
    )

    # Clear backlink on measurement if it still exists
    old_measurement&.update(takeoff_room_slot_id: nil) if old_measurement&.persisted?
  end

  # Update quantity from current measurement value (e.g., after vertex move)
  def sync_quantity!
    return unless measurement

    update!(quantity: measurement.net_value)
  end

  # =============================================================================
  # Cost Calculation
  # =============================================================================

  # Line total for this slot
  def line_total
    return nil unless pricebook_item&.current_price && is_filled

    (quantity || 0) * pricebook_item.current_price
  end

  # Unit display
  def unit_display
    case measurement_type
    when "area" then "m\u00B2"
    when "linear", "perimeter" then "m"
    when "count" then "ea"
    else "ea"
    end
  end

  # =============================================================================
  # API Response
  # =============================================================================

  def as_json(options = {})
    {
      id: id,
      step_index: step_index,
      label: label,
      measurement_type: measurement_type,
      color: color,
      prompt: prompt,
      pricebook_item_id: pricebook_item_id,
      pricebook_item_code: pricebook_item&.code,
      pricebook_item_name: pricebook_item&.name,
      pricebook_item_price: pricebook_item&.current_price,
      measurement_id: measurement_id,
      quantity: quantity&.to_f,
      is_filled: is_filled,
      line_total: line_total&.round(2),
      unit_display: unit_display
    }
  end
end
