# Seed EntityTab records for contact scope
# This migrates the hardcoded tabs from contacts/[id]/page.tsx to database SSoT
class SeedContactEntityTabs < ActiveRecord::Migration[8.0]
  def up
    puts "[SeedContactEntityTabs] Creating contact tabs..."

    contact_tabs = [
      {
        tab_key: "overview",
        display_name: "Overview",
        description: "Contact overview and details",
        tab_group: "main",
        order_position: 1,
        icon_name: "user",
        component_name: "ContactOverviewTab",
        enabled: true
      },
      {
        tab_key: "corporate",
        display_name: "Corporate",
        description: "Corporate structure and shareholdings",
        tab_group: "main",
        order_position: 2,
        icon_name: "building-2",
        component_name: "ContactCorporateTab",
        entity_filters: ["company", "trust"],
        enabled: true
      },
      {
        tab_key: "documents",
        display_name: "Documents",
        description: "Contact documents",
        tab_group: "main",
        order_position: 3,
        icon_name: "folder-open",
        has_sharepoint_folder: true,
        enabled: true
      },
      {
        tab_key: "financial",
        display_name: "Financial",
        description: "Bank accounts and financial data",
        tab_group: "main",
        order_position: 4,
        icon_name: "credit-card",
        component_name: "ContactFinancialTab",
        enabled: true
      },
      {
        tab_key: "coms",
        display_name: "Communications",
        description: "Communication history",
        tab_group: "main",
        order_position: 5,
        icon_name: "message-square",
        enabled: true
      },
      {
        tab_key: "cases",
        display_name: "Cases",
        description: "Related cases and matters",
        tab_group: "main",
        order_position: 6,
        icon_name: "briefcase",
        component_name: "ContactCasesTab",
        enabled: true
      },
      {
        tab_key: "emails",
        display_name: "Emails",
        description: "Email history",
        tab_group: "main",
        order_position: 7,
        icon_name: "mail",
        component_name: "ContactEmailsTab",
        enabled: true
      },
      {
        tab_key: "invoices",
        display_name: "Invoices",
        description: "Xero invoices",
        tab_group: "main",
        order_position: 8,
        icon_name: "file-text",
        enabled: true
      },
      {
        tab_key: "pricebook",
        display_name: "Price Book",
        description: "Custom pricing for this contact",
        tab_group: "main",
        order_position: 9,
        icon_name: "percent",
        enabled: true
      },
      {
        tab_key: "portal",
        display_name: "Portal Access",
        description: "Customer portal access settings",
        tab_group: "main",
        order_position: 10,
        icon_name: "lock",
        enabled: true
      },
      {
        tab_key: "directorships",
        display_name: "Directorships",
        description: "Director positions held",
        tab_group: "main",
        order_position: 11,
        icon_name: "users",
        component_name: "ContactDirectorshipsTab",
        entity_filters: ["person"],
        enabled: true
      }
    ]

    contact_tabs.each do |tab_attrs|
      EntityTab.find_or_create_by!(scope: "contact", tab_key: tab_attrs[:tab_key]) do |tab|
        tab.display_name = tab_attrs[:display_name]
        tab.description = tab_attrs[:description]
        tab.tab_group = tab_attrs[:tab_group]
        tab.order_position = tab_attrs[:order_position]
        tab.icon_name = tab_attrs[:icon_name]
        tab.component_name = tab_attrs[:component_name]
        tab.entity_filters = tab_attrs[:entity_filters] || []
        tab.has_sharepoint_folder = tab_attrs[:has_sharepoint_folder] || false
        tab.enabled = tab_attrs[:enabled]
        tab.is_system_tab = true
      end
    end

    puts "[SeedContactEntityTabs] Created #{EntityTab.where(scope: 'contact').count} contact tabs"
  end

  def down
    EntityTab.where(scope: "contact").destroy_all
  end
end
