class MergeXeroNavItems < ActiveRecord::Migration[8.0]
  def up
    # Xero Sync is now a tab within the main Xero page (/xero/sync).
    # Remove the separate nav item.
    xero_sync = NavigationItem.find_by(href: "/xero/sync")
    if xero_sync
      UserNavigationConfig.where(navigation_item_id: xero_sync.id).delete_all if defined?(UserNavigationConfig)
      xero_sync.destroy
    end

    # Rename "Xero (Main)" to just "Xero"
    xero_main = NavigationItem.find_by(href: "/xero")
    xero_main&.update!(name: "Xero")
  end

  def down
    # Restore "Xero (Main)" name
    xero_main = NavigationItem.find_by(href: "/xero")
    xero_main&.update!(name: "Xero (Main)")

    # Re-create Xero Sync nav item
    group = xero_main&.navigation_group || NavigationGroup.first
    return unless group

    NavigationItem.create!(
      navigation_group_id: group.id,
      name: "Xero Sync",
      href: "/xero/sync",
      icon: "RefreshCw",
      position: (xero_main&.position || 90) + 1
    )
  end
end
