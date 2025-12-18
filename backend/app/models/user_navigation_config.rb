class UserNavigationConfig < ApplicationRecord
  belongs_to :user
  belongs_to :navigation_item

  validates :user_id, uniqueness: { scope: :navigation_item_id }
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :ordered, -> { order(:position) }
  scope :visible, -> { where(is_hidden: false) }

  # Initialize config for a user from system defaults
  def self.initialize_for_user(user)
    return if user.user_navigation_configs.exists?

    NavigationItem.active.ordered.each_with_index do |item, index|
      create!(
        user: user,
        navigation_item: item,
        position: index,
        parent_id: item.parent_id,
        is_hidden: false,
        is_collapsed: item.is_collapsed_default
      )
    end
  end

  # Reset user's config back to system defaults
  def self.reset_for_user(user)
    user.user_navigation_configs.destroy_all
    initialize_for_user(user)
  end
end
