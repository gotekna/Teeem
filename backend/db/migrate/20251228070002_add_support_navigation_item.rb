# frozen_string_literal: true

class AddSupportNavigationItem < ActiveRecord::Migration[8.0]
  def up
    # Add Support navigation item for SaaS customers to access their tickets
    # Position 7 puts it between Meetings and Finance
    NavigationItem.create!(
      name: "Support",
      href: "/support",
      icon: "LifeBuoy",
      position: 7,
      is_active: true,
      visible_to_roles: []  # Empty means visible to all roles
    )
  end

  def down
    NavigationItem.find_by(href: "/support")&.destroy
  end
end
