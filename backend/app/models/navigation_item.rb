class NavigationItem < ApplicationRecord
  belongs_to :navigation_group, optional: true

  validates :name, presence: true
  validates :href, presence: true, uniqueness: true
  validates :icon, presence: true
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position) }
  scope :ungrouped, -> { where(navigation_group_id: nil) }
  scope :visible_to_role, ->(role) {
    where("visible_to_roles = '{}' OR ? = ANY(visible_to_roles)", role)
  }

  def visible_to?(user)
    return true if visible_to_roles.blank?
    visible_to_roles.include?(user.role)
  end
end
