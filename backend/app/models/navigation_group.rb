class NavigationGroup < ApplicationRecord
  has_many :navigation_items, -> { order(:position) }, dependent: :nullify

  validates :name, presence: true
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position) }
  scope :visible_to_role, ->(role) {
    where("visible_to_roles = '{}' OR ? = ANY(visible_to_roles)", role)
  }

  def visible_to?(user)
    return true if visible_to_roles.blank?
    visible_to_roles.include?(user.role)
  end
end
