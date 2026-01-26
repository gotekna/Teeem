# frozen_string_literal: true

# SSoT: Rename Financial sub-tabs to have unique keys
# This prevents confusion and conflicts with ROOT tabs that have the same functionality
# ROOT tabs (invoices, bills, purchase-orders) show PRIMARY Xero data
# Financial sub-tabs (financial-invoices, financial-bills, financial-purchase-orders) show ALL Xero data
class RenameFinancialSubtabsToUniqueKeys < ActiveRecord::Migration[7.1]
  def up
    # Find the Financial tab (parent of the sub-tabs)
    financial_tab = EntityTab.find_by(scope: 'contact', tab_key: 'financial', parent_id: nil)
    return unless financial_tab

    # Rename sub-tabs under Financial to have unique keys
    renames = {
      'invoices' => 'financial-invoices',
      'bills' => 'financial-bills',
      'purchase-orders' => 'financial-purchase-orders'
    }

    renames.each do |old_key, new_key|
      tab = EntityTab.find_by(scope: 'contact', tab_key: old_key, parent_id: financial_tab.id)
      if tab
        tab.update!(tab_key: new_key)
        puts "  Renamed: #{old_key} → #{new_key} (id: #{tab.id})"
      end
    end
  end

  def down
    # Find the Financial tab
    financial_tab = EntityTab.find_by(scope: 'contact', tab_key: 'financial', parent_id: nil)
    return unless financial_tab

    # Revert renames
    renames = {
      'financial-invoices' => 'invoices',
      'financial-bills' => 'bills',
      'financial-purchase-orders' => 'purchase-orders'
    }

    renames.each do |old_key, new_key|
      tab = EntityTab.find_by(scope: 'contact', tab_key: old_key, parent_id: financial_tab.id)
      if tab
        tab.update!(tab_key: new_key)
        puts "  Reverted: #{old_key} → #{new_key} (id: #{tab.id})"
      end
    end
  end
end
