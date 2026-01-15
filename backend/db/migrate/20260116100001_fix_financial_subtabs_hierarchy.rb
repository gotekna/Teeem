# frozen_string_literal: true

# SSoT Fix: Move Invoices, Bills under Financial as sub-tabs
# Also add Xero sub-tab under Financial
#
# Before: Invoices and Bills are ROOT tabs
# After: They are children of Financial, shown under chevron in Entity Config
#
# Structure after migration:
# - Financial (parent)
#   - Bank Details
#   - Xero (new)
#   - Invoices (moved from ROOT)
#   - Bills (moved from ROOT)
#   - Jobs
#   - Purchase Orders
#
class FixFinancialSubtabsHierarchy < ActiveRecord::Migration[8.0]
  def up
    financial_tab = EntityTab.find_by(scope: 'contact', tab_key: 'financial')

    unless financial_tab
      puts "[FixFinancialSubtabsHierarchy] Financial tab not found, skipping"
      return
    end

    # Move Invoices under Financial
    invoices_tab = EntityTab.find_by(scope: 'contact', tab_key: 'invoices')
    if invoices_tab
      invoices_tab.update!(parent_id: financial_tab.id, order_position: 3)
      puts "[FixFinancialSubtabsHierarchy] Moved Invoices under Financial"
    end

    # Move Bills under Financial
    bills_tab = EntityTab.find_by(scope: 'contact', tab_key: 'bills')
    if bills_tab
      bills_tab.update!(parent_id: financial_tab.id, order_position: 4)
      puts "[FixFinancialSubtabsHierarchy] Moved Bills under Financial"
    end

    # Add Xero sub-tab under Financial (if not exists)
    EntityTab.find_or_create_by!(scope: 'contact', tab_key: 'xero', parent_id: financial_tab.id) do |tab|
      tab.display_name = 'Xero'
      tab.description = 'Xero account sync and transactions'
      tab.tab_group = 'main'
      tab.order_position = 2  # After Bank Details
      tab.icon_name = 'ExternalLink'
      tab.enabled = true
      tab.is_system_tab = true
      tab.visibility_rule = 'has_xero_links'
    end
    puts "[FixFinancialSubtabsHierarchy] Added/verified Xero sub-tab under Financial"

    # Reorder Financial sub-tabs for logical flow
    # 1. Bank Details, 2. Xero, 3. Invoices, 4. Bills, 5. Jobs, 6. Purchase Orders
    EntityTab.find_by(scope: 'contact', tab_key: 'bank-details')&.update!(order_position: 1)
    EntityTab.find_by(scope: 'contact', tab_key: 'xero', parent_id: financial_tab.id)&.update!(order_position: 2)
    EntityTab.find_by(scope: 'contact', tab_key: 'invoices')&.update!(order_position: 3)
    EntityTab.find_by(scope: 'contact', tab_key: 'bills')&.update!(order_position: 4)
    EntityTab.find_by(scope: 'contact', tab_key: 'jobs')&.update!(order_position: 5)
    EntityTab.find_by(scope: 'contact', tab_key: 'purchase-orders')&.update!(order_position: 6)

    puts "[FixFinancialSubtabsHierarchy] Reordered Financial sub-tabs"
    puts "[FixFinancialSubtabsHierarchy] Financial now has #{financial_tab.children.count} sub-tabs"
  end

  def down
    # Move Invoices and Bills back to ROOT
    EntityTab.where(scope: 'contact', tab_key: ['invoices', 'bills'])
             .update_all(parent_id: nil)

    # Remove Xero sub-tab
    EntityTab.find_by(scope: 'contact', tab_key: 'xero')&.destroy
  end
end
