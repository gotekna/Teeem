# frozen_string_literal: true

# SSoT: Contact Tab Visibility Rules
#
# This migration adds visibility_rules to EntityTabs to match the original
# frontend hardcoded logic. These rules determine when tabs are shown/hidden
# based on contact data.
#
# Tab Structure (SSoT):
# - ROOT tabs: Primary access (Invoices, Bills, Emails, etc.)
# - Financial sub-tabs: Static (Bank Details, Xero, Jobs, POs)
# - Corporate sub-tabs: Static (Tax, ID, Directorships)
#
# Note: Financial sub-tabs inside ContactFinancialTab are DYNAMIC based on
# xeroLinks. The database sub-tabs are for Entity Config UI, not runtime rendering.
#
class AddContactTabVisibilityRules < ActiveRecord::Migration[8.0]
  def up
    @updated_count = 0

    # ===========================================
    # ROOT TABS - Conditional Visibility
    # ===========================================

    # Corporate: visible when contact has corporate relationships
    update_tab('corporate', visibility_rule: 'has_corporate_data')

    # Cases: visible when contact has linked cases
    update_tab('cases', visibility_rule: 'has_cases')

    # Emails: visible when contact has email address
    update_tab('emails', visibility_rule: 'has_email')

    # Invoices: visible when contact has Xero links (primary Xero)
    update_tab('invoices', visibility_rule: 'has_xero_links')

    # Bills: visible when contact has Xero links (primary Xero)
    update_tab('bills', visibility_rule: 'has_xero_links')

    # Price Book: visible when contact is a supplier
    update_tab('pricebook', visibility_rule: 'is_supplier')

    # Directorships: visible when contact has directorships
    # Note: This is under Corporate in Entity Config but may render as ROOT when accessed directly
    update_tab('directorships', visibility_rule: 'has_directorships')

    # ===========================================
    # Add component_names for mapping
    # ===========================================

    update_tab('overview', component_name: 'ContactOverviewTab')
    update_tab('corporate', component_name: 'ContactCorporateTab')
    update_tab('financial', component_name: 'ContactFinancialTab')
    update_tab('cases', component_name: 'ContactCasesTab')
    update_tab('emails', component_name: 'ContactEmailsTab')
    update_tab('activity', component_name: 'ContactActivityTab')
    update_tab('pricebook', component_name: 'ContactPriceBookTab')
    update_tab('directorships', component_name: 'ContactDirectorshipsTab')

    puts "[AddContactTabVisibilityRules] Updated #{@updated_count} contact tabs"
  end

  def down
    # Clear visibility_rules
    EntityTab.where(scope: 'contact', tab_key: %w[
      corporate cases emails invoices bills pricebook directorships
    ]).update_all(visibility_rule: nil)

    # Clear component_names
    EntityTab.where(scope: 'contact', tab_key: %w[
      overview corporate financial cases emails activity pricebook directorships
    ]).update_all(component_name: nil)
  end

  private

  def update_tab(tab_key, **attrs)
    tab = EntityTab.find_by(scope: 'contact', tab_key: tab_key)
    if tab
      tab.update!(**attrs)
      @updated_count += 1
      puts "  Updated #{tab_key}: #{attrs.inspect}"
    else
      puts "  WARN: Tab not found: #{tab_key}"
    end
  end
end
