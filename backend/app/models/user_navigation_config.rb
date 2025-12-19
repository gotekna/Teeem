class UserNavigationConfig < ApplicationRecord
  belongs_to :user
  belongs_to :navigation_item

  validates :user_id, uniqueness: { scope: :navigation_item_id }

  # Initialize collapse preferences for a user from system defaults
  def self.initialize_for_user(user)
    return if user.user_navigation_configs.exists?

    NavigationItem.active.find_each do |item|
      create!(
        user: user,
        navigation_item: item,
        is_collapsed: item.is_collapsed_default
      )
    end
  end

  # Reset user's collapse preferences back to system defaults
  def self.reset_for_user(user)
    user.user_navigation_configs.destroy_all
    initialize_for_user(user)
  end

  # Ensure config exists for all active navigation items for this user
  # Called when new nav items are added by admin
  def self.sync_for_user(user)
    existing_item_ids = user.user_navigation_configs.pluck(:navigation_item_id)

    NavigationItem.active.where.not(id: existing_item_ids).find_each do |item|
      create!(
        user: user,
        navigation_item: item,
        is_collapsed: item.is_collapsed_default
      )
    end
  end
end
