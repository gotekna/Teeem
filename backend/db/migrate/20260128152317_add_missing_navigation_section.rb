class AddMissingNavigationSection < ActiveRecord::Migration[8.0]
  def up
    # Create "Missing" parent nav item to hold orphaned pages
    # These are pages that exist but have no navigation link
    # User can later decide where to move them in the left nav
    missing_nav = NavigationItem.find_or_create_by!(href: "/missing") do |nav|
      nav.name = "Missing"
      nav.icon = "AlertTriangle"
      nav.position = 99  # At the bottom
      nav.is_active = true
    end

    # Orphaned pages found in frontend-next/app/(app)/ but not in navigation
    orphaned_pages = [
      { name: "Accounts", href: "/accounts", icon: "Wallet" },
      { name: "Agent Tasks", href: "/agent-tasks", icon: "Bot" },
      { name: "Chat", href: "/chat", icon: "MessageSquare" },
      { name: "Company Groups", href: "/company-groups", icon: "Building2" },
      { name: "Contact Duplicates", href: "/contacts/duplicates", icon: "Users" },
      { name: "Contact Quality Review", href: "/contacts/quality-review", icon: "UserCheck" },
      { name: "Data Warehouse", href: "/data-warehouse", icon: "Database" },
      { name: "Design System", href: "/design-system", icon: "Palette" },
      { name: "Designer", href: "/designer", icon: "PenTool" },
      { name: "Device", href: "/device", icon: "Smartphone" },
      { name: "E-Signature", href: "/e-signature", icon: "PenLine" },
      { name: "Email Rules", href: "/email/rules", icon: "Filter" },
      { name: "Email Settings", href: "/email/settings", icon: "Settings" },
      { name: "Financial Transactions", href: "/financial/transactions", icon: "ArrowLeftRight" },
      { name: "Financial Reports", href: "/financial/reports", icon: "FileBarChart" },
      { name: "Pricebook Health", href: "/pricebook/health", icon: "HeartPulse" },
      { name: "Public Holidays", href: "/public-holidays", icon: "Calendar" },
      { name: "Schedule Templates", href: "/schedule-templates", icon: "LayoutTemplate" },
      { name: "SharePoint", href: "/sharepoint", icon: "Cloud" },
      { name: "SM Tasks", href: "/sm_tasks", icon: "ListTodo" },
      { name: "System Health", href: "/system-health", icon: "Activity" },
      { name: "System Performance", href: "/system-performance", icon: "Gauge" },
      { name: "Task Templates", href: "/task-templates", icon: "FileCode" },
      { name: "Training", href: "/training", icon: "GraduationCap" },
      { name: "Xero (Main)", href: "/xero", icon: "FileSpreadsheet" },
      { name: "Xero Sync", href: "/xero/sync", icon: "RefreshCw" },
    ]

    orphaned_pages.each_with_index do |page, index|
      NavigationItem.find_or_create_by!(href: page[:href]) do |nav|
        nav.name = page[:name]
        nav.icon = page[:icon]
        nav.position = index
        nav.parent_id = missing_nav.id
        nav.is_active = true
      end
    end

    puts "Created 'Missing' nav section with #{orphaned_pages.count} orphaned pages"
  end

  def down
    missing_nav = NavigationItem.find_by(href: "/missing")
    if missing_nav
      # Delete children first
      NavigationItem.where(parent_id: missing_nav.id).destroy_all
      missing_nav.destroy
    end
  end
end
