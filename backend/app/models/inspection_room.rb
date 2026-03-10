class InspectionRoom < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :property_inspection
  has_many :inspection_items, -> { order(:sort_order) }, dependent: :destroy

  ROOM_TYPES = %w[
    kitchen bedroom bathroom living dining laundry garage outdoor
    hallway ensuite storage car_space balcony study office patio other
  ].freeze

  CONDITIONS = %w[new good fair poor damaged].freeze

  validates :name, presence: true
  validates :room_type, presence: true, inclusion: { in: ROOM_TYPES }
  validates :sort_order, numericality: { greater_than_or_equal_to: 0 }
  validates :overall_condition, inclusion: { in: CONDITIONS }, allow_nil: true

  scope :ordered, -> { order(:sort_order) }

  def completion_percentage
    return 0 if inspection_items.empty?
    checked = inspection_items.count { |item| item.condition.present? }
    (checked.to_f / inspection_items.size * 100).round
  end

  def all_items_checked?
    completion_percentage == 100
  end

  def action_items
    inspection_items.where(action_required: true)
  end

  def duplicate!
    new_room = dup
    new_room.sort_order = property_inspection.inspection_rooms.maximum(:sort_order).to_i + 1
    new_room.overall_condition = nil
    new_room.save!

    inspection_items.each do |item|
      new_item = item.dup
      new_item.inspection_room = new_room
      new_item.condition = nil
      new_item.entry_condition = nil
      new_item.save!
    end

    new_room
  end
end
