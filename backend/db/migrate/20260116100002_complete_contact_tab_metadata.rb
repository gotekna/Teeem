# frozen_string_literal: true

# SSoT: Complete Contact Tab Metadata
#
# This migration adds missing visibility_rules and component_names to EntityTabs.
# These fields are needed for the frontend to dynamically render tabs from the database
# instead of hardcoding them in JSX.
#
# After this migration, EntityTab becomes THE SSoT for:
# - Which tabs exist
# - What order they appear in
# - When they're visible (visibility_rule)
# - What component renders them (component_name)
# - Parent/child relationships (sub-tabs)
#
class CompleteContactTabMetadata < ActiveRecord::Migration[8.0]
  def up
    # ===========================================
    # ROOT TABS - Visibility Rules
    # ===========================================

    # Corporate tab: visible when contact has corporate data
    update_tab('corporate', visibility_rule: 'has_corporate_data')

    # Cases tab: visible when contact has linked cases
    update_tab('cases', visibility_rule: 'has_cases')

    # Emails tab: visible when contact has email address
    update_tab('emails', visibility_rule: 'has_email')

    # Price Book tab: visible when contact is a supplier
    update_tab('pricebook', visibility_rule: 'is_supplier')

    # ===========================================
    # FINANCIAL SUB-TABS - Visibility Rules
    # ===========================================

    # Xero sub-tab: visible when contact has Xero links
    update_tab('xero', visibility_rule: 'has_xero_links')

    # Invoices sub-tab: visible when contact has Xero links
    update_tab('invoices', visibility_rule: 'has_xero_links')

    # Bills sub-tab: visible when contact has Xero links AND is supplier
    update_tab('bills', visibility_rule: 'has_xero_links_and_supplier')

    # Purchase Orders sub-tab: visible when contact is supplier
    update_tab('purchase-orders', visibility_rule: 'is_supplier')

    # ===========================================
    # CORPORATE SUB-TABS - Visibility Rules
    # ===========================================

    # Directorships: visible when contact has directorships
    update_tab('directorships', visibility_rule: 'has_directorships')

    # ===========================================
    # ALL TABS - Component Names
    # ===========================================

    # ROOT tabs
    update_tab('overview', component_name: 'ContactOverviewTab')
    update_tab('documents', component_name: 'ContactDocumentsTab')
    update_tab('financial', component_name: 'ContactFinancialTab')
    update_tab('coms', component_name: 'ContactCommunicationsTab')
    update_tab('cases', component_name: 'ContactCasesTab')
    update_tab('emails', component_name: 'ContactEmailsTab')
    update_tab('pricebook', component_name: 'ContactPriceBookTab')
    update_tab('portal', component_name: 'ContactPortalTab')
    update_tab('activity', component_name: 'ContactActivityTab')
    update_tab('corporate', component_name: 'ContactCorporateTab')

    # Financial sub-tabs
    update_tab('bank-details', component_name: 'ContactBankDetailsTab')
    update_tab('xero', component_name: 'ContactXeroTab')
    update_tab('invoices', component_name: 'ContactInvoicesTab')
    update_tab('bills', component_name: 'ContactBillsTab')
    update_tab('jobs', component_name: 'ContactJobsTab')
    update_tab('purchase-orders', component_name: 'ContactPurchaseOrdersTab')

    # Corporate sub-tabs
    update_tab('tax', component_name: 'ContactTaxTab')
    update_tab('photo-id', component_name: 'ContactPhotoIdTab')
    update_tab('directorships', component_name: 'ContactDirectorshipsTab')

    # ===========================================
    # Fix missing icons
    # ===========================================

    update_tab('bank-details', icon_name: 'Landmark')
    update_tab('jobs', icon_name: 'Briefcase')
    update_tab('purchase-orders', icon_name: 'ShoppingCart')
    update_tab('tax', icon_name: 'Calculator')
    update_tab('photo-id', icon_name: 'IdCard')
    update_tab('pricebook', icon_name: 'DollarSign')
    update_tab('coms', icon_name: 'MessageSquare')
    update_tab('portal', icon_name: 'Lock')
    update_tab('documents', icon_name: 'FolderOpen')

    puts "[CompleteContactTabMetadata] Updated #{@updated_count} contact tabs"
  end

  def down
    # Clear visibility_rules
    EntityTab.where(scope: 'contact').update_all(visibility_rule: nil)

    # We don't clear component_names as they're still useful
  end

  private

  def update_tab(tab_key, **attrs)
    @updated_count ||= 0
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
