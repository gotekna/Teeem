# SSoT: Corporate Entity Tabs
# Single source of truth for all tabs on company/trust/superfund detail pages.
# Replaces hardcoded DOCUMENT_TABS, OVERVIEW_SUB_TABS, TRUST_SUB_TABS in frontend.
#
# Tab Groups:
# - overview: Sub-tabs within Overview section (Info, Corporate, Bank Accounts, etc.)
# - documents: Document folder tabs (Advice, ASIC, ATO, etc.)
# - data: Data/reporting tabs
# - special: Special tabs (Documents browser, Activity, etc.)
#
# Entity Types:
# - Company: Regular companies
# - Trust: Family trusts, unit trusts, etc.
# - Superfund: Self-managed super funds
# - Trustee: Companies acting as trustees (subset of Company)
#
# SharePoint Folder Integration:
# - has_sharepoint_folder: Whether this tab has a corresponding SharePoint folder
# - sharepoint_folder_path: The folder path in SharePoint (e.g., "BANK", "XERO")
# - sub_tabs: JSON array of sub-tabs with their folder paths
#   Format: [{ key: "statements", name: "Statements", folder: "Statements" }]
#
class CorporateEntityTab < ApplicationRecord
  # Validations
  validates :tab_key, presence: true, uniqueness: true
  validates :display_name, presence: true
  validates :tab_group, inclusion: { in: %w[overview documents data special] }

  # Scopes
  scope :enabled, -> { where(enabled: true) }
  scope :ordered, -> { order(:order_position) }
  scope :for_group, ->(group) { where(tab_group: group) }

  # Entity type scopes
  scope :for_entity_type, ->(type) {
    where("entity_types @> ARRAY[?]::varchar[] OR entity_types = '{}'", type)
  }

  # Class methods
  def self.all_tabs_ordered
    enabled.ordered.map do |tab|
      {
        id: tab.tab_key,
        name: tab.display_name,
        type: tab.tab_group,
        group: tab.tab_group,
        icon: tab.icon_name,
        entity_types: tab.entity_types,
        enabled: tab.enabled,
        order_position: tab.order_position,
        component: tab.component_name,
        description: tab.description,
        has_sharepoint_folder: tab.has_sharepoint_folder,
        sharepoint_folder_path: tab.sharepoint_folder_path,
        sub_tabs: tab.sub_tabs || [],
        document_types: tab.document_types_with_primary
      }
    end
  end

  # Get tabs for a specific entity type
  def self.tabs_for_entity(entity_type)
    enabled.for_entity_type(entity_type).ordered.map do |tab|
      {
        id: tab.tab_key,
        name: tab.display_name,
        type: tab.tab_group,
        group: tab.tab_group,
        icon: tab.icon_name,
        component: tab.component_name
      }
    end
  end

  # Get overview sub-tabs for an entity type
  def self.overview_tabs_for(entity_type)
    for_group("overview").for_entity_type(entity_type).ordered.map do |tab|
      { id: tab.tab_key, name: tab.display_name }
    end
  end

  # Get document tabs for an entity type
  def self.document_tabs_for(entity_type)
    for_group("documents").for_entity_type(entity_type).ordered.map do |tab|
      { id: tab.tab_key, name: tab.display_name, icon: tab.icon_name }
    end
  end

  # SharePoint folder scopes
  scope :with_sharepoint_folder, -> { where(has_sharepoint_folder: true) }

  # Get full SharePoint path for this tab
  def full_sharepoint_path
    return nil unless has_sharepoint_folder && sharepoint_folder_path.present?

    config = CorporateCompanySetting.sharepoint_config
    base_path = config[:root_path] || "/Shared Documents"
    "#{base_path}/#{sharepoint_folder_path}"
  end

  # Get document types that belong to this tab
  def document_types
    return [] unless tab_group == "documents"

    tab_name = tab_key.upcase
    # tabs is JSONB array, use @> for contains check
    DocumentType.where("primary_tab = ? OR tabs @> ?", tab_name, [tab_name].to_json)
  end

  # Get document types with primary flag
  def document_types_with_primary
    return [] unless tab_group == "documents"

    tab_name = tab_key.upcase
    # tabs is JSONB array, use @> for contains check
    DocumentType.where("primary_tab = ? OR tabs @> ?", tab_name, [tab_name].to_json).map do |dt|
      {
        id: dt.id,
        name: dt.name,
        display_name: dt.display_name,
        is_primary: dt.primary_tab == tab_name
      }
    end
  end

  # Convert to JSON for API
  def as_api_json
    {
      id: id,
      tab_key: tab_key,
      display_name: display_name,
      tab_group: tab_group,
      entity_types: entity_types || [],
      order_position: order_position,
      enabled: enabled,
      icon_name: icon_name,
      description: description,
      has_sharepoint_folder: has_sharepoint_folder,
      sharepoint_folder_path: sharepoint_folder_path,
      sub_tabs: sub_tabs || [],
      document_types: document_types_with_primary
    }
  end

  # Seed default tabs from the hardcoded values
  def self.seed_defaults!
    # Overview tabs (for all entity types)
    overview_tabs = [
      { tab_key: "info", display_name: "Information", entity_types: %w[Company Trust Superfund] },
      { tab_key: "corporate", display_name: "Corporate", entity_types: %w[Company Trust Superfund] },
      { tab_key: "bank-accounts", display_name: "Bank Accounts", entity_types: %w[Company Trust Superfund] },
      { tab_key: "directors", display_name: "Directors", entity_types: %w[Company] },
      { tab_key: "shareholdings", display_name: "Shareholdings", entity_types: %w[Company] },
      { tab_key: "consolidation", display_name: "Consolidation", entity_types: %w[Company Trust Superfund] },
      { tab_key: "trustees", display_name: "Trustees", entity_types: %w[Trust Superfund] },
      { tab_key: "beneficiaries", display_name: "Beneficiaries", entity_types: %w[Trust] },
      { tab_key: "members", display_name: "Members", entity_types: %w[Superfund] },
    ]

    overview_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = "overview"
        tab.entity_types = attrs[:entity_types]
        tab.order_position = idx
        tab.enabled = true
      end
    end

    # Document tabs (for all entity types)
    document_tabs = %w[
      Xero Advice ASIC Assets ATO Bank Company Dividends Financials
      General Insurance Loans Minutes Registry Trust
    ]

    document_tabs.each_with_index do |name, idx|
      tab_key = name.downcase.gsub(/\s+/, "-")
      find_or_create_by!(tab_key: tab_key) do |tab|
        tab.display_name = name
        tab.tab_group = "documents"
        tab.entity_types = %w[Company Trust Superfund]
        tab.order_position = idx + 100 # After overview tabs
        tab.enabled = true
      end
    end

    # Special tabs
    special_tabs = [
      { tab_key: "documents", display_name: "Documents", component_name: "DocumentsTab" },
      { tab_key: "data", display_name: "Data", component_name: "DataTab" },
      { tab_key: "activity", display_name: "Activity", component_name: "ActivityTab" },
    ]

    special_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = "special"
        tab.entity_types = %w[Company Trust Superfund]
        tab.order_position = idx + 200 # After document tabs
        tab.enabled = true
        tab.component_name = attrs[:component_name]
      end
    end

    Rails.logger.info "[CorporateEntityTab] Seeded #{count} tabs"
  end
end
