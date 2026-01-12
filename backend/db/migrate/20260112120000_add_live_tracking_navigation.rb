# frozen_string_literal: true

class AddLiveTrackingNavigation < ActiveRecord::Migration[7.0]
  def up
    # Find the Site Presence parent item
    site_presence = NavigationItem.find_by(href: "/admin/site-presence")
    return unless site_presence

    # Find position after Active Sessions (position 0)
    # Insert at position 1 to be second in the list
    NavigationItem.create!(
      name: "Live Tracking",
      href: "/site-presence/live",
      icon: "MapPin",
      position: 1,
      parent_id: site_presence.id,
      is_active: true,
      visible_to_roles: ["supervisor", "manager", "admin"]
    )

    # Shift other items down to make room
    NavigationItem.where(parent_id: site_presence.id)
                  .where.not(href: "/site-presence/live")
                  .where("position >= 1")
                  .order(position: :desc)
                  .each do |item|
      item.update!(position: item.position + 1)
    end
  end

  def down
    NavigationItem.find_by(href: "/site-presence/live")&.destroy
  end
end
