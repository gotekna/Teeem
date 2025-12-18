class SeedDefaultNavigationItems < ActiveRecord::Migration[8.0]
  def up
    # Default navigation items matching the frontend sidebar
    items = [
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
      { name: "Admin", href: "/admin", icon: "Wrench", position: 19 }
    ]

    items.each do |item_attrs|
      NavigationItem.create!(
        name: item_attrs[:name],
        href: item_attrs[:href],
        icon: item_attrs[:icon],
        badge_key: item_attrs[:badge_key],
        position: item_attrs[:position],
        is_active: true,
        visible_to_roles: []
      )
    end
  end

  def down
    NavigationItem.delete_all
  end
end
