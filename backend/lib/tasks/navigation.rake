namespace :navigation do
  desc "Seed default navigation items from current sidebar configuration"
  task seed: :environment do
    puts "Seeding navigation items..."

    # Default navigation items matching current sidebar.tsx
    default_items = [
      { name: "Dashboard", href: "/dashboard", icon: "Home", position: 0 },
      { name: "Leads", href: "/leads", icon: "Target", badge_key: "pendingProposals", position: 1 },
      { name: "Jobs", href: "/jobs", icon: "Briefcase", position: 2 },
      { name: "Tasks", href: "/tasks", icon: "ListTodo", position: 3 },
      { name: "Schedule", href: "/schedule-master", icon: "CalendarClock", position: 4 },
      { name: "Meetings", href: "/meetings", icon: "Calendar", position: 5 },
      { name: "WHS", href: "/whs", icon: "Shield", position: 6 },
      { name: "Finance", href: "/finance", icon: "Layers", badge_key: "pendingBills", position: 7 },
      { name: "Purchase Orders", href: "/purchase_orders", icon: "FileText", position: 8 },
      { name: "Quote Requests", href: "/quote-requests", icon: "FileQuestion", position: 9 },
      { name: "Contacts", href: "/contacts", icon: "Users", position: 10 },
      { name: "Email", href: "/email", icon: "Mail", position: 11 },
      { name: "Price Book", href: "/pricebook", icon: "Package", position: 12 },
      { name: "Price Histories", href: "/price_histories", icon: "History", position: 13 },
      { name: "Documents", href: "/documents", icon: "FolderOpen", position: 14 },
      { name: "Workflows", href: "/workflows/processes", icon: "Workflow", position: 15 },
      { name: "Corporate", href: "/corporate", icon: "Building2", position: 16 },
      { name: "Cases", href: "/cases", icon: "Scale", badge_key: "pendingCaseProposals", position: 17 },
      { name: "Portal", href: "/portal", icon: "ExternalLink", position: 18 },
      { name: "Admin", href: "/admin", icon: "Wrench", visible_to_roles: ["admin"], position: 19 }
    ]

    created_count = 0
    updated_count = 0

    default_items.each do |item_attrs|
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
    puts "Total navigation items: #{NavigationItem.count}"
  end

  desc "Reset navigation to defaults (deletes all and reseeds)"
  task reset: :environment do
    puts "Resetting navigation..."
    NavigationGroup.destroy_all
    NavigationItem.destroy_all
    puts "Cleared all navigation groups and items."
    Rake::Task["navigation:seed"].invoke
  end
end
