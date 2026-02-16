class AddFeatureRequestsNavigationItem < ActiveRecord::Migration[8.0]
  def up
    NavigationItem.find_or_create_by!(href: "/feature-requests") do |item|
      item.name = "Feature Requests"
      item.icon = "Lightbulb"
      item.position = 20
      item.is_active = true
      item.visible_to_roles = []
    end
  end

  def down
    NavigationItem.find_by(href: "/feature-requests")&.destroy
  end
end
