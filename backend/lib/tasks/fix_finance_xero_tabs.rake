# frozen_string_literal: true

# Fix Finance > Claims - XERO and Bills - XERO tabs on Job pages
# These WarehouseFolder records are missing component_name, so the job page
# falls through to document folder rendering instead of showing Xero data.
#
# Usage:
#   rails fix_finance_xero_tabs:check    # Check current state
#   rails fix_finance_xero_tabs:fix      # Fix component_names

namespace :fix_finance_xero_tabs do
  desc "Check Finance child tabs for missing component_name"
  task check: :environment do
    puts "=" * 60
    puts "Checking Finance child tabs across all tenants..."
    puts "=" * 60

    # Find the job warehouse type
    job_type = WarehouseType.find_by(code: "job")
    unless job_type
      puts "❌ No 'job' WarehouseType found"
      next
    end

    # Find all Finance parent tabs
    finance_tabs = WarehouseFolder.where(warehouse_type: job_type, tab_key: "finance", parent_id: nil)
    puts "\nFound #{finance_tabs.count} Finance parent tab(s)"

    finance_tabs.each do |finance_tab|
      puts "\n  Finance tab ID: #{finance_tab.id} (tenant: #{finance_tab.tenant_id})"

      children = finance_tab.children.order(:order_position)
      children.each do |child|
        status = child.component_name.present? ? "✅" : "❌"
        puts "    #{status} #{child.display_name} (tab_key: #{child.tab_key}, component_name: #{child.component_name || 'NULL'}, folder_path: #{child.folder_path || 'NULL'})"
      end
    end

    puts "\n" + "=" * 60
    puts "Tab component mapping needed:"
    puts "  claims      → JobClaimStagesTab (internal claim stages)"
    puts "  expenses    → JobExpensesTab (purchase orders for job)"
    puts "  profit      → JobProfitTab (profit analysis)"
    puts "  claims-xero → XeroInvoicesCard (Xero sales invoices for job)"
    puts "  bills-xero  → XeroBillsCard (Xero bills for job)"
    puts "  bills       → XeroBillsCard (if tab_key is 'bills' instead of 'bills-xero')"
    puts "=" * 60
  end

  desc "Fix component_name on Finance child tabs"
  task fix: :environment do
    puts "=" * 60
    puts "Fixing Finance child tab component_names..."
    puts "=" * 60

    # Component name mapping by tab_key
    # These map WarehouseFolder tab_keys to React component names in tab-component-registry.ts
    component_map = {
      "claims" => "JobClaimStagesTab",
      "expenses" => "JobExpensesTab",
      "profit" => "JobProfitTab",
      # Xero tabs - these need the Xero components that now support jobId
      "claims-xero" => "XeroInvoicesCard",
      "bills-xero" => "XeroBillsCard",
      # Fallback: if someone named the tab_key "bills" or "invoices" instead
      "bills" => "XeroBillsCard",
      "invoices" => "XeroInvoicesCard",
    }

    job_type = WarehouseType.find_by(code: "job")
    unless job_type
      puts "❌ No 'job' WarehouseType found"
      next
    end

    finance_tabs = WarehouseFolder.where(warehouse_type: job_type, tab_key: "finance", parent_id: nil)
    fixed = 0
    skipped = 0

    finance_tabs.each do |finance_tab|
      children = finance_tab.children

      children.each do |child|
        expected_component = component_map[child.tab_key]

        if expected_component.nil?
          puts "  ⚠️  Unknown tab_key: #{child.tab_key} (#{child.display_name}) - skipping"
          skipped += 1
          next
        end

        if child.component_name == expected_component
          puts "  ✅ #{child.display_name} already has component_name: #{expected_component}"
          skipped += 1
          next
        end

        old_value = child.component_name || "NULL"
        child.update_column(:component_name, expected_component)
        fixed += 1
        puts "  🔧 #{child.display_name}: #{old_value} → #{expected_component}"
      end
    end

    puts "\n" + "=" * 60
    puts "Fixed: #{fixed}, Skipped: #{skipped}"
    puts "=" * 60
  end
end
