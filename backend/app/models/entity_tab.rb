# SSoT: Unified Tab Configuration
# This is THE SINGLE SOURCE OF TRUTH for all tabs across:
# - Corporate Entities (Companies, Trusts, Superfunds, Charities)
# - People (Contacts)
# - Jobs
# - Document Folders
# - Xero Integration
#
# Replaces: CorporateEntityTab, DocumentFolder, JobTab, JobDocumentationTab,
#           XeroFeatureTab, UserJobTabConfig
#
class EntityTab < ApplicationRecord
  # Valid scopes
  SCOPES = %w[corporate_entity people job document xero].freeze

  # Valid tab groups
  TAB_GROUPS = %w[overview documents data special].freeze

  # Associations
  belongs_to :parent, class_name: 'EntityTab', optional: true
  belongs_to :job, optional: true  # For per-job tabs

  has_many :children, class_name: 'EntityTab', foreign_key: :parent_id, dependent: :destroy

  # Document type links
  has_many :entity_tab_document_types, dependent: :destroy
  has_many :document_types, through: :entity_tab_document_types

  # Validations
  validates :scope, presence: true, inclusion: { in: SCOPES }
  validates :tab_key, presence: true
  validates :display_name, presence: true
  validates :tab_group, inclusion: { in: TAB_GROUPS }, allow_blank: true

  # Uniqueness within scope + job (allows same tab_key for different scopes or per-job tabs)
  validates :tab_key, uniqueness: { scope: [:scope, :job_id] }

  # Scopes
  scope :for_scope, ->(s) { where(scope: s) }
  scope :for_corporate, -> { for_scope('corporate_entity') }
  scope :for_people, -> { for_scope('people') }
  scope :for_jobs, -> { for_scope('job') }
  scope :for_documents, -> { for_scope('document') }
  scope :for_xero, -> { for_scope('xero') }

  scope :enabled, -> { where(enabled: true) }
  scope :disabled, -> { where(enabled: false) }
  scope :ordered, -> { order(:order_position) }
  scope :root_tabs, -> { where(parent_id: nil) }
  scope :system_tabs, -> { where(is_system_tab: true) }
  scope :custom_tabs, -> { where(is_system_tab: false) }
  scope :global, -> { where(job_id: nil) }  # Not job-specific
  scope :for_job, ->(job_id) { where(job_id: job_id) }

  # Filter by entity type (for corporate_entity scope)
  scope :for_entity_type, ->(entity_type) {
    where("entity_filters @> ARRAY[?]::varchar[] OR entity_filters = '{}'", entity_type)
  }

  # Filter by tab group
  scope :for_group, ->(group) { where(tab_group: group) }

  # Instance Methods

  # Get all enabled tabs for a scope, ordered
  def self.tabs_for_scope(scope_name, entity_type: nil)
    tabs = for_scope(scope_name).enabled.global.ordered

    if entity_type.present?
      tabs = tabs.for_entity_type(entity_type)
    end

    tabs
  end

  # Check if this tab can be deleted
  def can_delete?
    return false if is_system_tab
    document_count == 0
  end

  # Count documents linked to this tab
  def document_count
    return 0 unless tab_group == 'documents'
    return 0 if document_types.empty?

    # Count documents with any of our linked document types
    CorporateCompanyDocument
      .where(document_type_id: document_type_ids)
      .count
  end

  # Get the full SharePoint path for this tab
  def full_sharepoint_path
    return nil unless has_sharepoint_folder && sharepoint_folder_path.present?

    # Get base path from settings
    config = CorporateCompanySetting.sharepoint_config rescue {}
    base_path = config[:root_path] || '/Shared Documents'

    "#{base_path}/#{sharepoint_folder_path}"
  end

  # Build hierarchy path (e.g., "ATO/Tax Returns")
  def hierarchy_path
    parts = []
    current = self
    while current
      parts.unshift(current.display_name)
      current = current.parent
    end
    parts.join(' > ')
  end

  # Convert to nested JSON for API
  def as_nested_json
    {
      id: id,
      scope: scope,
      tab_key: tab_key,
      display_name: display_name,
      description: description,
      tab_group: tab_group,
      parent_id: parent_id,
      job_id: job_id,
      entity_filters: entity_filters || [],
      order_position: order_position,
      enabled: enabled,
      icon_name: icon_name,
      component_name: component_name,
      is_system_tab: is_system_tab,
      has_sharepoint_folder: has_sharepoint_folder,
      sharepoint_folder_path: sharepoint_folder_path,
      full_sharepoint_path: full_sharepoint_path,
      hierarchy_path: hierarchy_path,
      document_count: document_count,
      can_delete: can_delete?,
      children: children.enabled.ordered.map(&:as_nested_json),
      document_types: document_types.map { |dt| { id: dt.id, name: dt.name, display_name: dt.display_name } }
    }
  end

  # Get all tabs as nested structure for a scope
  def self.nested_tabs_for_scope(scope_name, entity_type: nil)
    tabs = tabs_for_scope(scope_name, entity_type: entity_type)
                .root_tabs
                .includes(:children, :document_types)

    tabs.map(&:as_nested_json)
  end

  # Seed system tabs for all scopes
  def self.seed_system_tabs!
    # Corporate Entity tabs
    seed_corporate_entity_tabs!

    # People tabs
    seed_people_tabs!

    # Job tabs
    seed_job_tabs!

    # Document folder tabs
    seed_document_tabs!

    Rails.logger.info "[EntityTab] Seeded #{count} total tabs"
  end

  private_class_method def self.seed_corporate_entity_tabs!
    # Overview sub-tabs
    overview_tabs = [
      { tab_key: 'info', display_name: 'Information', entity_filters: %w[Company Trust Superfund Charity] },
      { tab_key: 'corporate', display_name: 'Corporate', entity_filters: %w[Company Trust Superfund Charity] },
      { tab_key: 'bank-accounts', display_name: 'Bank Accounts', entity_filters: %w[Company Trust Superfund Charity] },
      { tab_key: 'directors', display_name: 'Directors', entity_filters: %w[Company Charity] },
      { tab_key: 'shareholdings', display_name: 'Shareholdings', entity_filters: %w[Company] },
      { tab_key: 'consolidation', display_name: 'Consolidation', entity_filters: %w[Company Trust Superfund Charity] },
      { tab_key: 'trustees', display_name: 'Trustees', entity_filters: %w[Trust Superfund] },
      { tab_key: 'beneficiaries', display_name: 'Beneficiaries', entity_filters: %w[Trust] },
      { tab_key: 'members', display_name: 'Members', entity_filters: %w[Superfund] }
    ]

    overview_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(scope: 'corporate_entity', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'overview'
        tab.entity_filters = attrs[:entity_filters]
        tab.order_position = idx
        tab.enabled = true
        tab.is_system_tab = true
      end
    end

    # Document folder tabs
    document_tabs = %w[Xero Advice ASIC Assets ATO Bank Company Dividends Financials General Insurance Loans Minutes Registry Trust]

    document_tabs.each_with_index do |name, idx|
      tab_key = name.downcase.gsub(/\s+/, '-')
      find_or_create_by!(scope: 'corporate_entity', tab_key: tab_key) do |tab|
        tab.display_name = name
        tab.tab_group = 'documents'
        tab.entity_filters = %w[Company Trust Superfund Charity]
        tab.order_position = idx + 100
        tab.enabled = true
        tab.is_system_tab = true
        tab.has_sharepoint_folder = true
        tab.sharepoint_folder_path = name.upcase
      end
    end

    # Special tabs
    special_tabs = [
      { tab_key: 'documents', display_name: 'Documents', component_name: 'DocumentsTab' },
      { tab_key: 'data', display_name: 'Data', component_name: 'DataTab' },
      { tab_key: 'activity', display_name: 'Activity', component_name: 'ActivityTab' }
    ]

    special_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(scope: 'corporate_entity', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'special'
        tab.entity_filters = %w[Company Trust Superfund Charity]
        tab.order_position = idx + 200
        tab.enabled = true
        tab.is_system_tab = true
        tab.component_name = attrs[:component_name]
      end
    end
  end

  private_class_method def self.seed_people_tabs!
    people_tabs = [
      { tab_key: 'overview', display_name: 'Overview', tab_group: 'overview' },
      { tab_key: 'documents', display_name: 'Documents', tab_group: 'documents' },
      { tab_key: 'financial', display_name: 'Financial', tab_group: 'data' },
      { tab_key: 'communications', display_name: 'Communications', tab_group: 'data' },
      { tab_key: 'cases', display_name: 'Cases', tab_group: 'data' },
      { tab_key: 'emails', display_name: 'Emails', tab_group: 'data' },
      { tab_key: 'portal-access', display_name: 'Portal Access', tab_group: 'special' },
      { tab_key: 'directorships', display_name: 'Directorships', tab_group: 'special' }
    ]

    people_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(scope: 'people', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = attrs[:tab_group]
        tab.order_position = idx
        tab.enabled = true
        tab.is_system_tab = true
      end
    end
  end

  private_class_method def self.seed_job_tabs!
    job_tabs = [
      { tab_key: 'overview', display_name: 'Overview', tab_group: 'overview' },
      { tab_key: 'schedule', display_name: 'Schedule', tab_group: 'overview' },
      { tab_key: 'tasks', display_name: 'Tasks', tab_group: 'overview' },
      { tab_key: 'documents', display_name: 'Documents', tab_group: 'documents' },
      { tab_key: 'photos', display_name: 'Photos', tab_group: 'documents' },
      { tab_key: 'financials', display_name: 'Financials', tab_group: 'data' },
      { tab_key: 'activity', display_name: 'Activity', tab_group: 'special' }
    ]

    job_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(scope: 'job', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = attrs[:tab_group]
        tab.order_position = idx
        tab.enabled = true
        tab.is_system_tab = true
      end
    end
  end

  private_class_method def self.seed_document_tabs!
    # Document folders - these are the top-level folders for document organization
    # They mirror the corporate entity document tabs but are scope: 'document'
    folder_tabs = %w[Xero Advice ASIC Assets ATO Bank Company Dividends Financials General Insurance Loans Minutes Registry Trust]

    folder_tabs.each_with_index do |name, idx|
      tab_key = name.downcase.gsub(/\s+/, '-')
      find_or_create_by!(scope: 'document', tab_key: tab_key) do |tab|
        tab.display_name = name
        tab.tab_group = 'documents'
        tab.order_position = idx
        tab.enabled = true
        tab.is_system_tab = true
        tab.has_sharepoint_folder = true
        tab.sharepoint_folder_path = name.upcase
      end
    end
  end
end
