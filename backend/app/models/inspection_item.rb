class InspectionItem < ApplicationRecord
  acts_as_tenant :tenant

  belongs_to :inspection_room
  has_many :inspection_photos, -> { order(:sort_order) }, dependent: :destroy

  CONDITIONS = %w[new good fair poor damaged].freeze

  validates :name, presence: true
  validates :condition, inclusion: { in: CONDITIONS }, allow_nil: true
  validates :entry_condition, inclusion: { in: CONDITIONS }, allow_nil: true
  validates :sort_order, numericality: { greater_than_or_equal_to: 0 }

  scope :ordered, -> { order(:sort_order) }
  scope :checked, -> { where.not(condition: nil) }
  scope :unchecked, -> { where(condition: nil) }
  scope :requiring_action, -> { where(action_required: true) }
  scope :not_clean, -> { where(is_clean: false) }
  scope :not_working, -> { where(is_working: false) }

  after_save :update_room_condition

  def checked?
    condition.present?
  end

  def condition_degraded?
    return false if entry_condition.blank? || condition.blank?
    CONDITIONS.index(condition) > CONDITIONS.index(entry_condition)
  end

  def condition_improved?
    return false if entry_condition.blank? || condition.blank?
    CONDITIONS.index(condition) < CONDITIONS.index(entry_condition)
  end

  def condition_change
    return nil if entry_condition.blank? || condition.blank?
    if condition_improved?
      :improved
    elsif condition_degraded?
      :degraded
    else
      :unchanged
    end
  end

  def photo_count
    inspection_photos.size
  end

  private

  def update_room_condition
    return unless saved_change_to_condition?
    room = inspection_room
    return if room.inspection_items.empty?

    checked_items = room.inspection_items.where.not(condition: nil)
    return if checked_items.empty?

    worst_index = checked_items.map { |i| CONDITIONS.index(i.condition) }.max
    room.update_column(:overall_condition, CONDITIONS[worst_index]) if worst_index
  end
end
