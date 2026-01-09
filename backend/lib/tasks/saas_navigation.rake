# frozen_string_literal: true

namespace :saas do
  desc "Add SaaS Customer Management navigation items"
  task setup_navigation: :environment do
    puts "Adding SaaS navigation items..."

    # Find the Admin parent item
    admin_item = NavigationItem.find_by(href: "/admin")

    # Get the max position under admin
    max_position = NavigationItem.where(parent_id: admin_item&.id).maximum(:position) || 0

    # SaaS navigation items (as children of Admin)
    saas_items = [
      {
        name: "SaaS Customers",
        href: "/admin/saas-customers",
        icon: "Building2",
        position: max_position + 1,
        parent_id: admin_item&.id,
        visible_to_roles: ["admin"]
      },
      {
        name: "Support Tickets",
        href: "/admin/support-tickets",
        icon: "Ticket",
        position: max_position + 2,
        parent_id: admin_item&.id,
        visible_to_roles: ["admin"]
      },
      {
        name: "Referrers",
        href: "/admin/referrers",
        icon: "Users",
        position: max_position + 3,
        parent_id: admin_item&.id,
        visible_to_roles: ["admin"]
      }
    ]

    created_count = 0
    updated_count = 0

    saas_items.each do |item_attrs|
      item = NavigationItem.find_by(href: item_attrs[:href])
      if item
        item.update!(item_attrs)
        updated_count += 1
        puts "  Updated: #{item_attrs[:name]}"
      else
        NavigationItem.create!(item_attrs)
        created_count += 1
        puts "  Created: #{item_attrs[:name]}"
      end
    end

    puts "\nDone! Created: #{created_count}, Updated: #{updated_count}"
    puts "SaaS navigation items are now available under Admin"
  end

  desc "Remove SaaS navigation items"
  task remove_navigation: :environment do
    puts "Removing SaaS navigation items..."

    hrefs = [
      "/admin/saas-customers",
      "/admin/support-tickets",
      "/admin/referrers"
    ]

    count = NavigationItem.where(href: hrefs).destroy_all.count
    puts "Removed #{count} navigation items"
  end
end
