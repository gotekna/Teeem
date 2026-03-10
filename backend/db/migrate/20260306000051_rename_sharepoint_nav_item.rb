class RenameSharepointNavItem < ActiveRecord::Migration[8.0]
  def up
    nav = NavigationItem.find_by(href: "/sharepoint")
    nav&.update!(name: "SharePoint & OneDrive", icon: "Cloud")
  end

  def down
    nav = NavigationItem.find_by(href: "/sharepoint")
    nav&.update!(name: "SharePoint", icon: "Cloud")
  end
end
