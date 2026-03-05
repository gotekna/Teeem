class RemoveSystemPerformanceNavItem < ActiveRecord::Migration[8.0]
  def up
    # System Performance is a duplicate of the Performance tab inside System Health.
    # System Health is accessible via the heart icon in the header bar,
    # so both nav items are redundant.
    nav = NavigationItem.find_by(href: "/system-performance")
    if nav
      # Remove any user configs referencing this item
      UserNavigationConfig.where(navigation_item_id: nav.id).delete_all if defined?(UserNavigationConfig)
      nav.destroy
    end

    # Also remove System Health from left nav - it's accessible via heart icon in header
    nav_health = NavigationItem.find_by(href: "/system-health")
    if nav_health
      UserNavigationConfig.where(navigation_item_id: nav_health.id).delete_all if defined?(UserNavigationConfig)
      nav_health.destroy
    end
  end

  def down
    # Re-create both nav items if rolling back
    group = NavigationGroup.find_by(name: "Admin") || NavigationGroup.first
    return unless group

    NavigationItem.create!(
      navigation_group_id: group.id,
      name: "System Health",
      href: "/system-health",
      icon: "Activity",
      position: 90
    )
    NavigationItem.create!(
      navigation_group_id: group.id,
      name: "System Performance",
      href: "/system-performance",
      icon: "Gauge",
      position: 91
    )
  end
end
