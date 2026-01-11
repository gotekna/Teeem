class FixCalendarNavigationPosition < ActiveRecord::Migration[8.0]
  def up
    # Move Calendar to position 2 (below Email) and fix icon
    cal = NavigationItem.find_by(href: "/calendar")
    cal&.update!(position: 2, icon: "Calendar")
  end

  def down
    cal = NavigationItem.find_by(href: "/calendar")
    cal&.update!(position: 25, icon: "calendar")
  end
end
