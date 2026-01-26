# frozen_string_literal: true

# SSoT: Create ROOT tabs for Invoices, Bills, Purchase Orders
#
# These tabs were created locally but never migrated to production.
# They provide primary access to Xero data at the contact level.
#
# Tab Structure:
#   ROOT: invoices [has_xero_links] - Primary Xero invoices
#   ROOT: bills [has_xero_links] - Primary Xero bills
#   ROOT: purchase-orders [is_supplier] - Supplier purchase orders
#
class AddInvoicesBillsPurchaseOrdersRootTabs < ActiveRecord::Migration[8.0]
  def up
    # Create ROOT Invoices tab
    invoices = EntityTab.find_or_create_by!(scope: 'contact', tab_key: 'invoices', parent_id: nil) do |t|
      t.display_name = 'Invoices'
      t.description = 'Xero invoices for this contact'
      t.order_position = 3
      t.enabled = true
      t.is_system_tab = true
      t.visibility_rule = 'has_xero_links'
      t.component_name = 'ContactInvoicesTab'
    end
    puts "  Created/found ROOT invoices tab: #{invoices.id}"

    # Create ROOT Bills tab
    bills = EntityTab.find_or_create_by!(scope: 'contact', tab_key: 'bills', parent_id: nil) do |t|
      t.display_name = 'Bills'
      t.description = 'Xero bills for this contact'
      t.order_position = 4
      t.enabled = true
      t.is_system_tab = true
      t.visibility_rule = 'has_xero_links'
      t.component_name = 'ContactBillsTab'
    end
    puts "  Created/found ROOT bills tab: #{bills.id}"

    # Create ROOT Purchase Orders tab
    po = EntityTab.find_or_create_by!(scope: 'contact', tab_key: 'purchase-orders', parent_id: nil) do |t|
      t.display_name = 'Purchase Orders'
      t.description = 'Purchase orders for this supplier'
      t.order_position = 5
      t.enabled = true
      t.is_system_tab = true
      t.visibility_rule = 'is_supplier'
      t.component_name = 'ContactPurchaseOrdersTab'
    end
    puts "  Created/found ROOT purchase-orders tab: #{po.id}"

    # Ensure Financial sub-tabs exist
    financial = EntityTab.find_by(scope: 'contact', tab_key: 'financial')
    if financial
      # Bank Details sub-tab
      EntityTab.find_or_create_by!(scope: 'contact', tab_key: 'bank-details', parent_id: financial.id) do |t|
        t.display_name = 'Bank Details'
        t.description = 'Bank account information'
        t.order_position = 1
        t.enabled = true
        t.is_system_tab = true
      end

      # Xero sub-tab (for dynamic Xero connection tabs)
      EntityTab.find_or_create_by!(scope: 'contact', tab_key: 'xero', parent_id: financial.id) do |t|
        t.display_name = 'Xero'
        t.description = 'Xero connection details'
        t.order_position = 2
        t.enabled = true
        t.is_system_tab = true
        t.visibility_rule = 'has_xero_links'
      end

      # Invoices sub-tab under Financial
      EntityTab.find_or_create_by!(scope: 'contact', tab_key: 'invoices', parent_id: financial.id) do |t|
        t.display_name = 'Invoices'
        t.description = 'Invoices per Xero connection'
        t.order_position = 3
        t.enabled = true
        t.is_system_tab = true
        t.visibility_rule = 'has_xero_links'
      end

      # Bills sub-tab under Financial
      EntityTab.find_or_create_by!(scope: 'contact', tab_key: 'bills', parent_id: financial.id) do |t|
        t.display_name = 'Bills'
        t.description = 'Bills per Xero connection'
        t.order_position = 4
        t.enabled = true
        t.is_system_tab = true
        t.visibility_rule = 'has_xero_links'
      end

      # Jobs sub-tab under Financial
      EntityTab.find_or_create_by!(scope: 'contact', tab_key: 'jobs', parent_id: financial.id) do |t|
        t.display_name = 'Jobs'
        t.description = 'Jobs linked to this contact'
        t.order_position = 5
        t.enabled = true
        t.is_system_tab = true
      end

      # Purchase Orders sub-tab under Financial
      EntityTab.find_or_create_by!(scope: 'contact', tab_key: 'purchase-orders', parent_id: financial.id) do |t|
        t.display_name = 'Purchase Orders'
        t.description = 'Purchase orders per Xero connection'
        t.order_position = 6
        t.enabled = true
        t.is_system_tab = true
        t.visibility_rule = 'is_supplier'
      end

      puts "  Created/verified Financial sub-tabs"
    end

    puts "[AddInvoicesBillsPurchaseOrdersRootTabs] Complete"
  end

  def down
    # Remove ROOT tabs (but keep Financial sub-tabs)
    EntityTab.where(scope: 'contact', tab_key: %w[invoices bills purchase-orders], parent_id: nil).destroy_all
  end
end
