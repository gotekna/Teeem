class AddCalendarNavigationItem < ActiveRecord::Migration[8.0]
  def up
    # Add Calendar navigation item
    # Position 25 places it after Tasks (typically around 20-24)
    NavigationItem.create!(
      name: "Calendar",
      href: "/calendar",
      icon: "calendar",
      position: 25,
      is_active: true,
      visible_to_roles: []  # Empty means visible to all
    )
  end

  def down
    NavigationItem.find_by(href: "/calendar")&.destroy
  end
end
