class SeedDefaultJobTabs < ActiveRecord::Migration[8.0]
  def up
    tabs = [
      { name: "Overview", slug: "overview", icon: "ClipboardList", position: 0 },
      { name: "Contract", slug: "contract", icon: "FileSignature", position: 1 },
      { name: "Plans", slug: "plans", icon: "Map", position: 2 },
      { name: "Specifications", slug: "specifications", icon: "FileText", position: 3 },
      { name: "Colours", slug: "colours", icon: "Palette", position: 4 },
      { name: "Claims", slug: "claims", icon: "TrendingUp", position: 5 },
      { name: "People", slug: "people", icon: "Users", position: 6 },
      { name: "Purchase Orders", slug: "purchase-orders", icon: "ShoppingCart", position: 7 },
      { name: "Estimates", slug: "estimates", icon: "FileText", position: 8 },
      { name: "Profit", slug: "profit", icon: "TrendingUp", position: 9 },
      { name: "Activity", slug: "activity", icon: "Activity", position: 10 },
      { name: "Budget", slug: "budget", icon: "DollarSign", position: 11 },
      { name: "Schedule", slug: "schedule", icon: "Calendar", position: 12 },
      { name: "WHS", slug: "whs", icon: "Shield", position: 13 },
      { name: "Rain Log", slug: "rain-log", icon: "Cloud", position: 14 },
      { name: "Documents", slug: "documents", icon: "FileText", position: 15 },
      { name: "Coms", slug: "coms", icon: "MessageSquare", position: 16 },
      { name: "Settings", slug: "settings", icon: "Settings", position: 17 },
    ]

    tabs.each do |tab|
      execute <<-SQL
        INSERT INTO job_tabs (name, slug, icon, position, is_active, created_at, updated_at)
        VALUES ('#{tab[:name]}', '#{tab[:slug]}', '#{tab[:icon]}', #{tab[:position]}, true, NOW(), NOW())
      SQL
    end
  end

  def down
    execute "DELETE FROM job_tabs"
  end
end
