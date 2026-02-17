# frozen_string_literal: true

# Add "P&L - XERO" sub-tab under Finance on Job pages
# This tab shows the Xero Profit & Loss report filtered by the job's tracking category
#
# Usage:
#   rails add_xero_pl_tab:check   # Check if tab exists
#   rails add_xero_pl_tab:add     # Add the tab

namespace :add_xero_pl_tab do
  desc "Check if P&L - XERO tab exists under Finance"
  task check: :environment do
    job_type = WarehouseType.find_by(code: "job")
    unless job_type
      puts "No 'job' WarehouseType found"
      next
    end

    finance_tabs = WarehouseFolder.where(warehouse_type: job_type, tab_key: "finance", parent_id: nil)
    finance_tabs.each do |finance_tab|
      puts "Finance tab ID: #{finance_tab.id} (tenant: #{finance_tab.tenant_id})"
      children = finance_tab.children.order(:order_position)
      children.each do |child|
        puts "  #{child.display_name} (tab_key: #{child.tab_key}, position: #{child.order_position})"
      end

      existing = finance_tab.children.find_by(tab_key: "p&l---xero")
      puts existing ? "  P&L - XERO tab EXISTS" : "  P&L - XERO tab NOT FOUND"
    end
  end

  desc "Add P&L - XERO tab under Finance for all tenants"
  task add: :environment do
    job_type = WarehouseType.find_by(code: "job")
    unless job_type
      puts "No 'job' WarehouseType found"
      next
    end

    finance_tabs = WarehouseFolder.where(warehouse_type: job_type, tab_key: "finance", parent_id: nil)
    added = 0

    finance_tabs.each do |finance_tab|
      existing = finance_tab.children.find_by(tab_key: "p&l---xero")
      if existing
        puts "Tenant #{finance_tab.tenant_id}: P&L - XERO already exists (id: #{existing.id})"
        next
      end

      # Find max position to add at end
      max_pos = finance_tab.children.maximum(:order_position) || 0

      tab = WarehouseFolder.create!(
        tenant_id: finance_tab.tenant_id,
        warehouse_type: job_type,
        parent_id: finance_tab.id,
        display_name: "P&L - XERO",
        tab_key: "p&l---xero",
        component_name: "XeroJobProfitLossCard",
        tab_type: "system",
        order_position: max_pos + 1
      )

      puts "Tenant #{finance_tab.tenant_id}: Added P&L - XERO tab (id: #{tab.id})"
      added += 1
    end

    puts "\nAdded #{added} tab(s)"
  end
end
