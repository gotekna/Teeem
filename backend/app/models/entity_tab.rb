# SSoT: Unified Tab Configuration
# This is THE SINGLE SOURCE OF TRUTH for all tabs across:
# - Corporate Entities (Companies, Trusts, Superfunds, Charities)
# - People (Contacts)
# - Jobs
# - Document Folders
#
# Xero tabs are children of the Xero tab in corporate_entity scope (SSoT)
#
# Replaces: CorporateEntityTab, DocumentFolder, JobTab, JobDocumentationTab,
#           XeroFeatureTab, UserJobTabConfig
#
class EntityTab < ApplicationRecord
  # Valid scopes (xero tabs are children of corporate_entity/xero tab)
  # System scopes (email, warehouse, task, task_attachments, task_responses) are read-only in UI - is_system_tab: true
  SCOPES = %w[corporate_entity people job document contact email warehouse task task_attachments task_responses xero].freeze

  # Valid tab groups
  # - overview: Main features and data display
  # - documents: File/folder tabs with SharePoint integration
  # - reports: Xero reports (P&L, Balance Sheet, etc.)
  # - data: Xero data views (Accounts, Contacts, etc.)
  # - setup: Configuration tabs (Connection, Settings)
  # - system: System-managed tabs (email storage, warehousing) - read-only in UI
  TAB_GROUPS = %w[overview documents reports data setup main system].freeze

  # Display modes for tabs (SSoT: how tabs render in UI)
  # - both: Show icon + text (default)
  # - icon_only: Show only icon (root tabs only, tooltip shows name)
  # - text_only: Show only text (no icon)
  DISPLAY_MODES = %w[both icon_only text_only].freeze

  # Valid xero_scope values (SSoT: which Xero account this tab uses)
  # - nil: No Xero integration
  # - "primary": Uses PRIMARY Xero account (XeroCredential.is_primary = true)
  # - tenant_id: Specific Xero tenant (future use)
  XERO_SCOPES = %w[primary].freeze

  # Associations
  belongs_to :parent, class_name: 'EntityTab', optional: true
  belongs_to :job, optional: true  # For per-job tabs

  has_many :children, class_name: 'EntityTab', foreign_key: :parent_id, dependent: :destroy

  # Document type links (SSoT for tab-to-document-type associations)
  has_many :entity_tab_document_types, dependent: :destroy
  has_many :document_types, through: :entity_tab_document_types

  # SSoT: Auto-inherit storage folder flag from parent when document types assigned
  before_save :inherit_storage_from_parent

  # SSoT: Auto-sync tab_key from display_name (display_name is the source of truth)
  before_validation :sync_tab_key_from_display_name

  # SSoT: When display_name changes, sync SharePoint folder and job_documents
  after_update :enqueue_folder_rename_if_needed

  # Set document types by IDs
  # SSoT: EntityTab can only add/remove SECONDARY links (is_primary: false)
  # Primary links are controlled from DocumentType side only
  def document_type_ids=(ids)
    ids = Array(ids).map(&:to_i).reject(&:zero?)
    existing_ids = entity_tab_document_types.pluck(:document_type_id)

    # Remove old assignments - ONLY secondary ones!
    # Primary links cannot be removed from EntityTab side
    entity_tab_document_types
      .where.not(document_type_id: ids)
      .where(is_primary: false)
      .destroy_all

    # Add new assignments as SECONDARY (is_primary: false)
    # Primary can only be set from DocumentType side
    (ids - existing_ids).each do |doc_type_id|
      entity_tab_document_types.create(document_type_id: doc_type_id, is_primary: false)
    end
  end

  # Get document type IDs
  def document_type_ids
    entity_tab_document_types.pluck(:document_type_id)
  end

  # Validations
  validates :scope, presence: true, inclusion: { in: SCOPES }
  validates :tab_key, presence: true
  validates :display_name, presence: true
  validates :tab_group, inclusion: { in: TAB_GROUPS }, allow_blank: true
  validates :display_mode, inclusion: { in: DISPLAY_MODES }, allow_blank: true
  validates :xero_scope, inclusion: { in: XERO_SCOPES }, allow_blank: true

  # Uniqueness within scope + job + parent (allows same tab_key under different parents)
  # SSoT: Child tabs under different parents can have the same display_name (e.g., "Site" under Documents vs "Site" under Photos)
  validates :tab_key, uniqueness: { scope: [:scope, :job_id, :parent_id] }

  # SSoT: Icon uniqueness - root tabs must have unique icons within scope
  validate :icon_uniqueness_for_root_tabs

  # SSoT: Child tabs must show text to differentiate from siblings
  validate :child_tabs_must_show_text

  # Scopes
  scope :for_scope, ->(s) { where(scope: s) }
  scope :for_corporate, -> { for_scope('corporate_entity') }
  scope :for_people, -> { for_scope('people') }
  scope :for_jobs, -> { for_scope('job') }
  scope :for_documents, -> { for_scope('document') }
  # Note: Xero tabs are children of corporate_entity/xero tab, not a separate scope

  scope :enabled, -> { where(enabled: true) }
  scope :disabled, -> { where(enabled: false) }
  scope :ordered, -> { order(:order_position) }
  scope :root_tabs, -> { where(parent_id: nil) }
  scope :system_tabs, -> { where(is_system_tab: true) }
  scope :custom_tabs, -> { where(is_system_tab: false) }
  scope :global, -> { where(job_id: nil) }  # Not job-specific
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :with_xero_scope, -> { where.not(xero_scope: nil) }

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

  # SSoT: Get the name of the PRIMARY Xero account
  # Returns nil if no primary Xero credential exists
  def self.primary_xero_name
    XeroCredential.primary.first&.tenant_name
  end

  # Get the Xero account name for this tab (if xero_scope is set)
  # Returns the primary Xero name for xero_scope: "primary"
  def xero_account_name
    return nil unless xero_scope.present?

    case xero_scope
    when 'primary'
      self.class.primary_xero_name
    else
      # Future: Could be a specific tenant_id
      XeroCredential.find_by(tenant_id: xero_scope)&.tenant_name
    end
  end

  # SSoT: Get folder name for a tab by key
  # Use this instead of hardcoding folder names like "04 Plans" or "Documents"
  #
  # @param scope [String] The scope (job, corporate_entity, etc.)
  # @param tab_key [String] The tab key (plans, documents, photos, etc.)
  # @param fallback [String] Fallback if tab not found (optional)
  # @return [String] The display_name to use as folder name
  #
  # Examples:
  #   EntityTab.folder_name_for("job", "plans")     # => "04 Plans" (from EntityTab)
  #   EntityTab.folder_name_for("job", "documents") # => "Documents"
  #   EntityTab.folder_name_for("job", "missing", "Fallback") # => "Fallback"
  #
  def self.folder_name_for(scope, tab_key, fallback = nil)
    tab = find_by(scope: scope, tab_key: tab_key)
    tab&.display_name || fallback
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

  # Get the full storage path for this tab
  # SSoT: Uses storage_base_path (which respects storage_path_type) + storage_folder_path
  def full_storage_path
    return nil unless has_storage_folder && storage_folder_path.present?

    base = storage_base_path || ''
    "#{base}/#{storage_folder_path}".gsub(%r{//+}, '/')
  end

  # Alias for backwards compatibility
  alias_method :full_sharepoint_path, :full_storage_path

  # SSoT: Template Inheritance for SharePoint Paths
  # ================================================

  # Valid path types for sharepoint_path_type field
  PATH_TYPES = %w[corporate contacts].freeze

  # SSoT: Map EntityTab to StorageConfiguration template scope
  # Priority: storage_path_type (explicit override) > scope (default)
  def scope_for_template
    # SSoT: storage_path_type is THE ONE way to override which path config to use
    # This allows "document" scope tabs to use "corporate" templates
    if storage_path_type.present?
      return storage_path_type.to_sym
    end

    # Fall back to scope-based mapping
    case scope
    when 'job' then :job
    when 'corporate_entity' then :corporate
    when 'people', 'contact' then :people
    when 'email' then :email
    when 'warehouse' then :warehouse
    when 'task' then :task
    when 'task_attachments' then :task_attachments
    when 'task_responses' then :task_responses
    when 'document' then :corporate  # Document tabs default to corporate
    else :job  # Default fallback
    end
  end

  # Get the inherited template (default template based on scope)
  # SSoT: Uses StorageConfiguration.template_for() - NOT hardcoded templates
  def inherited_template
    return nil unless has_storage_folder

    begin
      # SSoT: Get template from StorageConfiguration (database)
      config = StorageConfiguration.instance
      template_scope = scope_for_template.to_s

      # Get template from SSoT
      template = config.template_for(template_scope)

      # Replace {{TabName}} with this tab's display_name
      template&.gsub("{{TabName}}", display_name)
    rescue => e
      Rails.logger.warn "[EntityTab] Failed to get inherited template: #{e.message}"
      nil
    end
  end

  # Get the storage base path for this tab (used in UI preview)
  def storage_base_path
    return nil unless has_storage_folder
    config = StorageConfiguration.instance
    return nil unless config
    File.join(config.root_path, config.path_for(scope_for_template))
  rescue => e
    Rails.logger.warn "[EntityTab] Failed to get base path: #{e.message}"
    nil
  end

  # Alias for backwards compatibility
  alias_method :sharepoint_base_path, :storage_base_path

  # Get the EFFECTIVE storage path for this tab (for UI display)
  # SSoT: EntityTab owns folder paths. Child tabs INHERIT from parent.
  #
  # Inheritance chain:
  #   inherited_template → "{{JobCode}}/{{TabName}}"  (default per scope)
  #   Photo (root tab) → "{{JobCode}}/Photo"
  #   Site Photo (child) → "{{JobCode}}/Photo/Site Photo"  ← inherits parent + adds own name
  def effective_storage_path
    return nil unless has_storage_folder

    if uses_custom_path && storage_folder_path.present?
      # Custom path - use exactly what's set
      storage_folder_path
    elsif parent&.has_storage_folder
      # SSoT: INHERIT FROM PARENT - child path = parent path + "/" + display_name
      parent_path = parent.effective_storage_path
      return nil unless parent_path.present?
      "#{parent_path}/#{display_name}"
    else
      # Root tab - use global template from CorporateCompanySetting (SSoT)
      template = inherited_template
      return nil unless template.present?

      # Replace ALL folder placeholders with this tab's display_name
      CorporateCompanySetting.resolve_template(template, {
        "Category" => display_name,
        "TabName" => display_name
      })
    end
  end

  # Alias for backwards compatibility
  alias_method :effective_sharepoint_path, :effective_storage_path

  # Get the folder path for actual uploads (strips {{JobCode}} for job-scope tabs)
  # Use this when uploading files - the upload logic navigates to job folder separately
  def upload_folder_path
    path = effective_storage_path
    return nil unless path.present?

    # SSoT: For job-scope tabs, strip {{JobCode}} prefix since job folder is handled separately
    if scope == 'job'
      path = path.gsub(/\{\{JobCode\}\}\s*\/?/, "").gsub(/^\/+/, "")
    end

    path.presence
  end

  # Build hierarchy path - SSoT: Use storage_folder_path when set
  def hierarchy_path
    # For document tabs with storage paths, use the actual path (SSoT)
    return storage_folder_path if storage_folder_path.present?

    # Fallback for tabs without SharePoint paths (overview tabs, etc.)
    scope_prefix = case scope
    when 'corporate_entity' then 'Corporate'
    when 'people' then 'People'
    when 'job' then 'Jobs'
    when 'document' then 'Documents'
    when 'xero' then 'Corporate'
    else scope.titleize
    end

    # Build tab hierarchy (root to leaf)
    tab_parts = []
    current = self
    while current
      tab_parts.unshift(current.display_name)
      current = current.parent
    end

    ([scope_prefix] + tab_parts).join('/')
  end

  # Convert to nested JSON for API
  def as_nested_json
    {
      id: id,
      scope: scope,
      tab_key: tab_key,
      name: display_name,  # SSoT: Frontend expects 'name' for category matching
      display_name: display_name,
      display_code: display_code,
      description: description,
      tab_group: tab_group,
      parent_id: parent_id,
      job_id: job_id,
      entity_filters: entity_filters || [],
      order_position: order_position,
      enabled: enabled,
      icon_name: icon_name,
      effective_icon_name: effective_icon_name,  # SSoT: Computed icon (inherits from parent)
      display_mode: display_mode || 'both',      # SSoT: How tab renders (icon_only, text_only, both)
      hidden_by_default: hidden_by_default,      # SSoT: Tab hidden in overflow menu by default
      component_name: component_name,
      is_system_tab: is_system_tab,
      # SSoT: Visibility rules - when this tab is shown/hidden
      visibility_rule: visibility_rule,
      # SSoT: Xero integration fields
      xero_scope: xero_scope,
      xero_account_name: xero_account_name,  # Resolved name (e.g., "Tekna Homes")
      has_storage_folder: has_storage_folder,
      storage_folder_path: storage_folder_path,
      full_storage_path: full_storage_path,
      # SSoT: Template inheritance fields
      uses_custom_path: uses_custom_path,
      storage_path_type: storage_path_type || 'corporate',
      storage_base_path: storage_base_path,
      effective_storage_path: effective_storage_path,  # For UI display (keeps {{JobCode}})
      folder_path: upload_folder_path,  # For uploads (strips {{JobCode}} for job-scope tabs)
      inherited_template: inherited_template,
      hierarchy_path: hierarchy_path,
      document_count: document_count,
      is_photo_category: is_photo_category,  # SSoT: Explicit photo gallery flag
      can_delete: can_delete?,
      children: children.enabled.ordered.map(&:as_nested_json),
      document_types: document_types.map { |dt|
        join = entity_tab_document_types.find_by(document_type_id: dt.id)
        {
          id: dt.id,
          name: dt.name,
          display_name: dt.display_name,
          abbreviation: dt.abbreviation,
          file_name: dt.file_name,
          is_primary: join&.is_primary || false  # SSoT: Include primary/secondary flag
        }
      },
      # Backwards compatibility aliases
      has_sharepoint_folder: has_storage_folder,
      sharepoint_folder_path: storage_folder_path,
      full_sharepoint_path: full_storage_path,
      sharepoint_path_type: storage_path_type || 'corporate',
      sharepoint_base_path: storage_base_path,
      effective_sharepoint_path: effective_storage_path
    }
  end

  # Get all tabs as nested structure for a scope
  def self.nested_tabs_for_scope(scope_name, entity_type: nil)
    tabs = tabs_for_scope(scope_name, entity_type: entity_type)
                .root_tabs
                .includes(children: { children: :children }, document_types: [])

    tabs.map(&:as_nested_json)
  end

  # Seed task tabs only (callable individually)
  def self.seed_task_tabs_only!
    send(:seed_task_tabs!)
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

    # Task tabs (legacy - Tasks folder)
    seed_task_tabs!

    # Task Attachments tabs (Tasks/Attachments folder)
    seed_task_attachments_tabs!

    # Task Response tabs (Tasks/Responses folder)
    seed_task_responses_tabs!

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
        tab.has_storage_folder = true
        tab.storage_folder_path = name.upcase
      end
    end

    # Feature tabs (Documents browser, Data view, Activity log)
    feature_tabs = [
      { tab_key: 'documents', display_name: 'Documents', component_name: 'DocumentsTab' },
      { tab_key: 'data', display_name: 'Data', component_name: 'DataTab' },
      { tab_key: 'activity', display_name: 'Activity', component_name: 'ActivityTab' }
    ]

    feature_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(scope: 'corporate_entity', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'overview'
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
      { tab_key: 'financial', display_name: 'Financial', tab_group: 'overview' },
      { tab_key: 'communications', display_name: 'Communications', tab_group: 'overview' },
      { tab_key: 'cases', display_name: 'Cases', tab_group: 'overview' },
      { tab_key: 'emails', display_name: 'Emails', tab_group: 'overview' },
      { tab_key: 'portal-access', display_name: 'Portal Access', tab_group: 'overview' },
      { tab_key: 'directorships', display_name: 'Directorships', tab_group: 'overview' }
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
      { tab_key: 'financials', display_name: 'Financials', tab_group: 'overview' },
      { tab_key: 'activity', display_name: 'Activity', tab_group: 'overview' }
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
        tab.has_storage_folder = true
        tab.storage_folder_path = name.upcase
      end
    end
  end

  # Task document folder tabs
  # SSoT: Defines the folder structure for task-related documents
  # Base path from StorageConfiguration: "Tasks"
  # Template: "Tasks/Task-{{TaskId}}/{{Category}}"
  private_class_method def self.seed_task_tabs!
    # Overview tab - task info display
    find_or_create_by!(scope: 'task', tab_key: 'overview') do |tab|
      tab.display_name = 'Overview'
      tab.tab_group = 'overview'
      tab.order_position = 0
      tab.enabled = true
      tab.is_system_tab = true
      tab.icon_name = 'ClipboardList'
    end

    # Document folder tabs for task attachments
    # These represent categories of documents that can be attached to tasks
    task_document_tabs = [
      { tab_key: 'documents', display_name: 'Documents', icon: 'FileText', folder: 'Documents' },
      { tab_key: 'photos', display_name: 'Photos', icon: 'Image', folder: 'Photos', is_photo: true },
      { tab_key: 'plans', display_name: 'Plans', icon: 'Map', folder: 'Plans' },
      { tab_key: 'drawings', display_name: 'Drawings', icon: 'PenTool', folder: 'Drawings', is_cad: true },
      { tab_key: 'reports', display_name: 'Reports', icon: 'FileBarChart', folder: 'Reports' },
      { tab_key: 'correspondence', display_name: 'Correspondence', icon: 'Mail', folder: 'Correspondence' },
      { tab_key: 'attachments', display_name: 'Attachments', icon: 'Paperclip', folder: 'Attachments' }
    ]

    task_document_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(scope: 'task', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'documents'
        tab.order_position = idx + 10
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.has_storage_folder = true
        tab.storage_folder_path = attrs[:folder]
        tab.is_photo_category = attrs[:is_photo] || false
        tab.is_cad_category = attrs[:is_cad] || false
      end
    end

    Rails.logger.info "[EntityTab] Seeded #{where(scope: 'task').count} task tabs"
  end

  # Task Attachments tabs (for task attachments - under Tasks/Attachments)
  # SSoT: Defines the folder structure for task attachment documents
  # Base path from StorageConfiguration: "Tasks/Attachments"
  # Template: "Tasks/Attachments/{{TaskId}}"
  private_class_method def self.seed_task_attachments_tabs!
    # Overview tab - task attachments info display
    find_or_create_by!(scope: 'task_attachments', tab_key: 'overview') do |tab|
      tab.display_name = 'Overview'
      tab.tab_group = 'overview'
      tab.order_position = 0
      tab.enabled = true
      tab.is_system_tab = true
      tab.icon_name = 'Paperclip'
    end

    # Document folder tabs for task attachments
    task_attachment_tabs = [
      { tab_key: 'attachments', display_name: 'Attachments', icon: 'Paperclip', folder: 'Attachments' },
      { tab_key: 'documents', display_name: 'Documents', icon: 'FileText', folder: 'Documents' },
      { tab_key: 'photos', display_name: 'Photos', icon: 'Image', folder: 'Photos', is_photo: true }
    ]

    task_attachment_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(scope: 'task_attachments', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'documents'
        tab.order_position = idx + 10
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.has_storage_folder = true
        tab.storage_folder_path = attrs[:folder]
        tab.is_photo_category = attrs[:is_photo] || false
      end
    end

    Rails.logger.info "[EntityTab] Seeded #{where(scope: 'task_attachments').count} task_attachments tabs"
  end

  # Callable individually for task attachments seeding
  def self.seed_task_attachments_tabs_only!
    send(:seed_task_attachments_tabs!)
  end

  # Task Response tabs (for task responses - separate from attachments)
  # SSoT: Defines the folder structure for task response documents
  # Base path from StorageConfiguration: "Tasks/Responses"
  # Template: "Tasks/Responses/{{TaskId}}"
  private_class_method def self.seed_task_responses_tabs!
    # Overview tab - task response info display
    find_or_create_by!(scope: 'task_responses', tab_key: 'overview') do |tab|
      tab.display_name = 'Overview'
      tab.tab_group = 'overview'
      tab.order_position = 0
      tab.enabled = true
      tab.is_system_tab = true
      tab.icon_name = 'FileOutput'
    end

    # Document folder tabs for task responses
    task_response_tabs = [
      { tab_key: 'responses', display_name: 'Responses', icon: 'FileOutput', folder: 'Responses' },
      { tab_key: 'documents', display_name: 'Documents', icon: 'FileText', folder: 'Documents' }
    ]

    task_response_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(scope: 'task_responses', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'documents'
        tab.order_position = idx + 10
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.has_storage_folder = true
        tab.storage_folder_path = attrs[:folder]
      end
    end

    Rails.logger.info "[EntityTab] Seeded #{where(scope: 'task_responses').count} task_responses tabs"
  end

  # Callable individually for task responses seeding
  def self.seed_task_responses_tabs_only!
    send(:seed_task_responses_tabs!)
  end

  # SSoT: Get effective icon name (child tabs inherit from parent)
  def effective_icon_name
    icon_name.presence || parent&.effective_icon_name || 'Folder'
  end

  private

  # SSoT: Auto-inherit storage folder settings from parent
  # When a tab has document types AND has a parent with has_storage_folder: true,
  # automatically enable has_storage_folder for this tab
  def inherit_storage_from_parent
    return if has_storage_folder  # Already enabled, skip

    # Check if parent has storage folder enabled
    if parent&.has_storage_folder
      self.has_storage_folder = true
      Rails.logger.info "[EntityTab] Auto-inherited has_storage_folder from parent '#{parent.display_name}' for tab '#{display_name}'"
    end
  end

  # SSoT: display_name is the source of truth, tab_key is derived from it
  # When display_name changes, auto-update tab_key to match
  def sync_tab_key_from_display_name
    return if display_name.blank?
    return unless display_name_changed? || tab_key.blank?

    self.tab_key = display_name
      .downcase
      .gsub(/[^a-z0-9\s-]/, '')  # Remove special chars
      .gsub(/\s+/, '-')          # Spaces to hyphens
      .gsub(/-+/, '-')           # Collapse multiple hyphens
      .gsub(/^-|-$/, '')         # Remove leading/trailing hyphens
  end

  # SSoT: When display_name changes, enqueue job to sync storage folders and job_documents
  # This ensures physical folders and database records match the tab configuration
  # Works for ALL scopes: job, corporate_entity, people, contact (unified folder rename system)
  def enqueue_folder_rename_if_needed
    return unless has_storage_folder
    return unless saved_change_to_display_name?

    old_name, new_name = saved_change_to_display_name
    return if old_name.blank? || new_name.blank? || old_name == new_name

    EntityTabFolderRenameJob.perform_later(
      entity_tab_id: id,
      old_display_name: old_name,
      new_display_name: new_name
    )
  end

  # SSoT: Root tabs must have unique icons within the same scope
  # Child tabs can inherit parent's icon OR have their own unique icon
  def icon_uniqueness_for_root_tabs
    return if parent_id.present?  # Child tabs can share/inherit icons
    return if icon_name.blank?    # No icon set, skip validation

    existing = EntityTab.where(scope: scope, parent_id: nil, icon_name: icon_name)
                        .where.not(id: id)

    if existing.exists?
      errors.add(:icon_name, "is already used by another root tab in this scope")
    end
  end

  # SSoT: Child tabs must show text to differentiate from siblings
  # icon_only is not allowed for child tabs
  def child_tabs_must_show_text
    return if parent_id.blank?           # Only applies to child tabs
    return if display_mode != 'icon_only' # Only block icon_only mode

    errors.add(:display_mode, "Sub-tabs must show text to differentiate from siblings. Use 'both' or 'text_only' instead.")
  end
end
