# SSoT: Xero Feature Tabs
# Single source of truth for all Xero sub-tabs on company pages.
# Replaces hardcoded XERO_SUB_TABS in frontend.
#
# Tab Types:
# - Functional tabs (have component_name): Render a specific React component
# - Document tabs (have document_folder_id): Render document folder browser
#
class XeroFeatureTab < ApplicationRecord
  belongs_to :document_folder, optional: true

  # Validations
  validates :tab_key, presence: true, uniqueness: true
  validates :display_name, presence: true
  validates :tab_group, inclusion: { in: %w[setup data reports documents] }

  # Scopes
  scope :enabled, -> { where(enabled: true) }
  scope :ordered, -> { order(:order_position) }
  scope :functional, -> { where.not(component_name: nil) }
  scope :document_tabs, -> { where.not(document_folder_id: nil) }

  # Class methods
  def self.all_tabs_ordered
    # Get functional tabs
    functional_tabs = enabled.functional.ordered.map do |tab|
      {
        id: tab.tab_key,
        name: tab.display_name,
        type: "functional",
        component: tab.component_name,
        icon: tab.icon_name,
        group: tab.tab_group,
        head_only: tab.description == "head_only"
      }
    end

    # SSoT: Get functional tab names to filter duplicates
    functional_tab_names = functional_tabs.map { |t| t[:name].downcase }

    # Get document folder tabs (children of XERO folder)
    # SSoT: Skip document folders that have same name as functional tabs (e.g., "Reports")
    xero_folder = DocumentFolder.find_by(name: "XERO")
    document_tabs = if xero_folder
      DocumentFolder.where(parent_id: xero_folder.id, active: true)
        .order(:order_position)
        .reject { |folder| functional_tab_names.include?(folder.name.downcase) }  # SSoT: No duplicates
        .map do |folder|
          {
            id: "xero-doc-#{folder.name.downcase.gsub(/\s+/, '-')}",
            name: folder.name,
            type: "document",
            folderId: folder.id,
            description: folder.description,
            group: "documents"
          }
        end
    else
      []
    end

    # Combine: functional first, then document folders
    functional_tabs + document_tabs
  end
end
