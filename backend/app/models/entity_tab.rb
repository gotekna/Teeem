# SSoT: Unified Tab Configuration
# This is THE SINGLE SOURCE OF TRUTH for all tabs across:
# - Corporate Entities (Companies, Trusts, Superfunds, Charities)
# - People (Contacts)
# - Jobs
# - Document Folders
#
# Xero tabs are children of the Xero tab in corporate_entity warehouse_type (SSoT)
#
# Replaces: CorporateEntityTab, DocumentFolder, JobTab, JobDocumentationTab,
#           XeroFeatureTab, UserJobTabConfig
#
class EntityTab < ApplicationRecord
  # NOTE: Multi-tenancy REMOVED (Jan 2026)
  # EntityTabs are GLOBAL configuration shared across all tenants.
  # All EntityTabs have company_group_id=NULL by design.
  # The uniqueness validation still includes company_group_id for future per-tenant customization.
  #
  # Valid warehouse types (xero tabs are children of corporate_entity/xero tab)
  # System warehouse types (email, warehouse, task, task_attachments, task_responses, user, case) are read-only in UI - is_system_tab: true
  # SSoT: 'contact' is THE ONE warehouse_type for all individuals (Jan 2026 - 'people' merged into 'contact')
  # SSoT: 'user' added for Teeem Docs personal user documents (Jan 2026)
  # SSoT: 'case' added for Case document management (Jan 2026)
  # SSoT: 'asset' added for Asset Register documents (Jan 2026)
  # SSoT: 'financial' added for Financial transaction receipts (Jan 2026)
  # SSoT: 'compliance' added for job compliance docs - permits, approvals (Jan 2026)
  # SSoT: 'payment' added for subcontractor payment docs (Jan 2026)
  WAREHOUSE_TYPES = %w[
    corporate_entity job document contact email warehouse
    task task_attachments task_responses
    case case_documents case_emails
    asset asset_expenses asset_service asset_readings
    financial financial_transactions
    compliance payment payment_invoices payment_proof
    xero user
  ].freeze

  # Legacy alias for backward compatibility
  SCOPES = WAREHOUSE_TYPES

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

  # Legacy column aliases for backward compatibility
  # These allow queries like find_by(scope: "email") to work after migration
  alias_attribute :scope, :warehouse_type
  alias_attribute :has_storage_folder, :warehouse_enabled
  alias_attribute :has_sharepoint_folder, :warehouse_enabled  # Extra legacy alias
  alias_attribute :storage_folder_path, :warehouse_folder
  alias_attribute :sharepoint_folder_path, :warehouse_folder  # Extra legacy alias
  alias_attribute :storage_path_type, :warehouse_type_override
  alias_attribute :sharepoint_path_type, :warehouse_type_override  # Extra legacy alias

  # Associations
  belongs_to :parent, class_name: 'EntityTab', optional: true
  belongs_to :job, optional: true  # For per-job tabs

  has_many :children, class_name: 'EntityTab', foreign_key: :parent_id, dependent: :destroy

  # Document type links (SSoT for tab-to-document-type associations)
  has_many :entity_tab_document_types, dependent: :destroy
  has_many :document_types, through: :entity_tab_document_types

  # SSoT: Auto-inherit warehouse folder flag from parent when document types assigned
  before_save :inherit_warehouse_from_parent

  # SSoT: Auto-sync tab_key from display_name (display_name is the source of truth)
  before_validation :sync_tab_key_from_display_name

  # SSoT: When display_name changes, update virtual folder paths in database
  # Phase 3 Blob Architecture: No physical file movement, just DB updates (instant)
  after_update :rename_folders_in_database_if_needed

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
  validates :warehouse_type, presence: true, inclusion: { in: WAREHOUSE_TYPES }
  validates :tab_key, presence: true
  validates :display_name, presence: true
  validates :tab_group, inclusion: { in: TAB_GROUPS }, allow_blank: true
  validates :display_mode, inclusion: { in: DISPLAY_MODES }, allow_blank: true
  validates :xero_scope, inclusion: { in: XERO_SCOPES }, allow_blank: true

  # Uniqueness within warehouse_type + job + parent + tenant (allows same tab_key under different parents)
  # SSoT: Child tabs under different parents can have the same display_name (e.g., "Site" under Documents vs "Site" under Photos)
  validates :tab_key, uniqueness: { scope: [:tenant_id, :warehouse_type, :job_id, :parent_id] }

  # SSoT: Icon uniqueness - root tabs must have unique icons within warehouse_type
  validate :icon_uniqueness_for_root_tabs

  # SSoT: Child tabs must show text to differentiate from siblings
  validate :child_tabs_must_show_text

  # Scopes
  scope :for_warehouse_type, ->(t) { where(warehouse_type: t) }
  scope :for_corporate, -> { for_warehouse_type('corporate_entity') }
  scope :for_contacts, -> { for_warehouse_type('contact') }
  scope :for_people, -> { for_warehouse_type('contact') }  # DEPRECATED: Use for_contacts (Jan 2026)
  scope :for_jobs, -> { for_warehouse_type('job') }
  scope :for_documents, -> { for_warehouse_type('document') }
  # Note: Xero tabs are children of corporate_entity/xero tab, not a separate warehouse_type

  # Legacy aliases
  scope :for_scope, ->(s) { for_warehouse_type(s) }

  scope :enabled, -> { where(enabled: true) }
  scope :disabled, -> { where(enabled: false) }
  scope :ordered, -> { order(:order_position) }
  scope :root_tabs, -> { where(parent_id: nil) }
  scope :system_tabs, -> { where(is_system_tab: true) }
  scope :custom_tabs, -> { where(is_system_tab: false) }
  scope :global, -> { where(job_id: nil) }  # Not job-specific
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :with_xero_scope, -> { where.not(xero_scope: nil) }

  # Filter by entity type (for corporate_entity warehouse_type)
  scope :for_entity_type, ->(entity_type) {
    where("entity_filters @> ARRAY[?]::varchar[] OR entity_filters = '{}'", entity_type)
  }

  # Filter by tab group
  scope :for_group, ->(group) { where(tab_group: group) }

  # Instance Methods

  # Get all enabled tabs for a warehouse type, ordered
  def self.tabs_for_warehouse_type(warehouse_type_name, entity_type: nil)
    tabs = for_warehouse_type(warehouse_type_name).enabled.global.ordered

    if entity_type.present?
      tabs = tabs.for_entity_type(entity_type)
    end

    tabs
  end

  # Legacy alias
  def self.tabs_for_scope(scope_name, entity_type: nil)
    tabs_for_warehouse_type(scope_name, entity_type: entity_type)
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
  # @param warehouse_type [String] The warehouse type (job, corporate_entity, etc.)
  # @param tab_key [String] The tab key (plans, documents, photos, etc.)
  # @param fallback [String] Fallback if tab not found (optional)
  # @return [String] The display_name to use as folder name
  #
  # Examples:
  #   EntityTab.folder_name_for("job", "plans")     # => "04 Plans" (from EntityTab)
  #   EntityTab.folder_name_for("job", "documents") # => "Documents"
  #   EntityTab.folder_name_for("job", "missing", "Fallback") # => "Fallback"
  #
  def self.folder_name_for(warehouse_type, tab_key, fallback = nil)
    tab = find_by(warehouse_type: warehouse_type, tab_key: tab_key)
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
  # SSoT: Uses warehouse_base_path (which respects warehouse_type_override) + warehouse_folder
  def full_warehouse_path
    return nil unless warehouse_enabled && warehouse_folder.present?

    base = warehouse_base_path || ''
    "#{base}/#{warehouse_folder}".gsub(%r{//+}, '/')
  end

  # Legacy aliases for backwards compatibility
  alias_method :full_storage_path, :full_warehouse_path
  alias_method :full_sharepoint_path, :full_warehouse_path

  # SSoT: Template Inheritance for SharePoint Paths
  # ================================================

  # Valid path types for warehouse_type_override field
  PATH_TYPES = %w[corporate contacts].freeze

  # SSoT: Map EntityTab to StorageConfiguration template warehouse type
  # Priority: warehouse_type_override (explicit override) > warehouse_type (default)
  def effective_warehouse_type
    # SSoT: warehouse_type_override is THE ONE way to override which path config to use
    # This allows "document" warehouse_type tabs to use "corporate" templates
    if warehouse_type_override.present?
      return warehouse_type_override.to_sym
    end

    # Fall back to warehouse_type-based mapping
    # SSoT: 'contact' is THE ONE for all individuals (Jan 2026 - 'people' merged into 'contact')
    case warehouse_type
    when 'job' then :job
    when 'corporate_entity' then :corporate
    when 'contact' then :contact
    when 'email' then :email
    when 'warehouse' then :warehouse
    when 'task' then :task
    when 'task_attachments' then :task_attachments
    when 'task_responses' then :task_responses
    when 'document' then :corporate  # Document tabs default to corporate
    else :job  # Default fallback
    end
  end

  # Legacy alias
  alias_method :scope_for_template, :effective_warehouse_type

  # Get the folder name for this tab
  # SSoT: warehouse_root_folders has full path pattern, tab just provides folder name
  def inherited_template
    return nil unless warehouse_enabled
    # Simply return the display_name - this is appended to warehouse_root_folders path
    display_name
  end

  # Get the warehouse base path for this tab (used in UI preview)
  def warehouse_base_path
    return nil unless warehouse_enabled
    config = StorageConfiguration.instance
    return nil unless config
    File.join(config.root_path, config.root_folder_for(effective_warehouse_type))
  rescue => e
    Rails.logger.warn "[EntityTab] Failed to get base path: #{e.message}"
    nil
  end

  # Legacy aliases for backwards compatibility
  alias_method :storage_base_path, :warehouse_base_path
  alias_method :sharepoint_base_path, :warehouse_base_path

  # Get the EFFECTIVE warehouse path for this tab (for UI display)
  # SSoT: EntityTab owns folder paths. Child tabs INHERIT from parent.
  # Note: This returns ONLY the tab's folder - identifier pattern is in warehouse_root_folders
  #
  # Inheritance chain:
  #   Photo (root tab) → "Photo"
  #   Site Photo (child) → "Photo/Site Photo"  ← inherits parent + adds own name
  def effective_warehouse_path
    return nil unless warehouse_enabled

    if uses_custom_path && warehouse_folder.present?
      # Custom path - use exactly what's set
      warehouse_folder
    elsif parent&.warehouse_enabled
      # SSoT: INHERIT FROM PARENT - child path = parent path + "/" + display_name
      parent_path = parent.effective_warehouse_path
      return nil unless parent_path.present?
      "#{parent_path}/#{display_name}"
    else
      # Root tab - just the display_name (identifier pattern is in warehouse_root_folders)
      display_name
    end
  end

  # Legacy aliases for backwards compatibility
  alias_method :effective_storage_path, :effective_warehouse_path
  alias_method :effective_sharepoint_path, :effective_warehouse_path

  # Get the folder path for actual uploads
  # SSoT: effective_warehouse_path now returns just the tab's folder (e.g., "Plans")
  # The identifier pattern ({{JobCode}}) is in warehouse_root_folders, handled by resolve_path
  def upload_folder_path
    effective_warehouse_path
  end

  # Build hierarchy path - SSoT: Static path first, then dynamic tokens
  def hierarchy_path
    # SSoT: 'contact' is THE ONE for all individuals (Jan 2026 - 'people' merged into 'contact')
    prefix = case warehouse_type
    when 'corporate_entity' then 'Corporate'
    when 'contact' then 'Contacts'
    when 'job' then 'Jobs'
    when 'document' then 'Documents'
    when 'xero' then 'Corporate'
    else warehouse_type.titleize
    end

    # Build tab hierarchy (root to leaf)
    tab_parts = []
    current = self
    while current
      tab_parts.unshift(current.display_name)
      current = current.parent
    end

    static_path = ([prefix] + tab_parts).join('/')

    # If warehouse_folder has dynamic tokens, append them after static path
    if warehouse_folder.present? && warehouse_folder.include?('{{')
      dynamic_parts = warehouse_folder.split('/').select { |p| p.include?('{{') }
      return "#{static_path}/#{dynamic_parts.join('/')}" if dynamic_parts.any?
    end

    # For tabs with non-dynamic warehouse_folder (legacy paths), use as-is
    return warehouse_folder if warehouse_folder.present?

    static_path
  end

  # Convert to nested JSON for API
  def as_nested_json
    {
      id: id,
      warehouse_type: warehouse_type,
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
      warehouse_enabled: warehouse_enabled,
      warehouse_folder: warehouse_folder,
      full_warehouse_path: full_warehouse_path,
      # SSoT: Template inheritance fields
      uses_custom_path: uses_custom_path,
      warehouse_type_override: warehouse_type_override || 'corporate',
      warehouse_base_path: warehouse_base_path,
      effective_warehouse_path: effective_warehouse_path,  # For UI display (keeps {{JobCode}})
      folder_path: upload_folder_path,  # For uploads (strips {{JobCode}} for job-warehouse_type tabs)
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
      scope: warehouse_type,
      has_storage_folder: warehouse_enabled,
      storage_folder_path: warehouse_folder,
      full_storage_path: full_warehouse_path,
      storage_path_type: warehouse_type_override || 'corporate',
      storage_base_path: warehouse_base_path,
      effective_storage_path: effective_warehouse_path,
      has_sharepoint_folder: warehouse_enabled,
      sharepoint_folder_path: warehouse_folder,
      full_sharepoint_path: full_warehouse_path,
      sharepoint_path_type: warehouse_type_override || 'corporate',
      sharepoint_base_path: warehouse_base_path,
      effective_sharepoint_path: effective_warehouse_path
    }
  end

  # Get all tabs as nested structure for a warehouse_type
  def self.nested_tabs_for_warehouse_type(warehouse_type_name, entity_type: nil)
    tabs = tabs_for_warehouse_type(warehouse_type_name, entity_type: entity_type)
                .root_tabs
                .includes(children: { children: :children }, document_types: [])

    tabs.map(&:as_nested_json)
  end

  # Legacy alias
  def self.nested_tabs_for_scope(scope_name, entity_type: nil)
    nested_tabs_for_warehouse_type(scope_name, entity_type: entity_type)
  end

  # SSoT: Get warehouse folder paths from EntityTab
  # Replaces scope_folders in StorageConfiguration
  #
  # Returns a hash that supports two lookup patterns:
  # 1. By warehouse_type: { "email" => "Emails", "job" => "Jobs", ... } (from overview/root tabs)
  # 2. By tab_key: { "users" => "Users", "user_photos" => "Users/Photos", ... } (from all warehouse tabs)
  #
  # This allows StorageConfiguration.root_folder_for to work with both:
  # - root_folder_for("email") => "Emails" (warehouse_type lookup)
  # - root_folder_for("users") => "Users" (tab_key lookup for legacy storage keys)
  #
  # Note: Legacy scope_folders used underscores (user_photos), but EntityTab tab_key uses hyphens (user-photos).
  # This method adds both underscore and hyphen versions for backward compatibility.
  #
  def self.warehouse_base_folders
    result = {}

    # Get all tabs with warehouse_folder set (exclude nil AND empty strings)
    warehouse_tabs = where(warehouse_enabled: true)
                     .where.not(warehouse_folder: [nil, ''])

    warehouse_tabs.each do |tab|
      # Add tab_key => path for all warehouse tabs
      # This enables lookup by storage key (e.g., "user-photos")
      result[tab.tab_key] = tab.warehouse_folder

      # Also add underscore version for backward compatibility with legacy scope_folders
      # Legacy used user_photos, EntityTab uses user-photos
      underscore_key = tab.tab_key.gsub('-', '_')
      result[underscore_key] = tab.warehouse_folder if underscore_key != tab.tab_key

      # For overview/root tabs, also add warehouse_type => path
      # This enables lookup by warehouse_type (e.g., "email", "warehouse")
      if tab.tab_key.in?(%w[overview root])
        result[tab.warehouse_type] = tab.warehouse_folder
      end
    end

    # Legacy alias mappings (backward compatibility)
    # These map old scope_folders keys to their actual paths
    # SSoT: The aliases exist only for backward compatibility with existing code
    legacy_aliases = {
      'corporate' => 'corporate_entity',       # corporate was the old key, corporate_entity is the warehouse_type
      'emails' => 'email',                     # emails (plural) was the old key, email is the warehouse_type
      'custom' => 'custom_documents',          # custom was the old key, custom_documents is the tab_key
      'my_docs' => 'my_documents'              # my_docs was the old key, my_documents is the tab_key (underscore form)
    }

    legacy_aliases.each do |old_key, new_key|
      # Only add alias if the new key exists and old key doesn't
      result[old_key] = result[new_key] if result[new_key] && !result[old_key]
    end

    result
  end

  # Legacy alias
  def self.scope_base_folders
    warehouse_base_folders
  end

  # Seed task tabs only (callable individually)
  def self.seed_task_tabs_only!
    send(:seed_task_tabs!)
  end

  # Seed system tabs for all warehouse_types
  def self.seed_system_tabs!
    # Corporate Entity tabs
    seed_corporate_entity_tabs!

    # Contact tabs (SSoT: 'contact' is THE ONE for all individuals - Jan 2026)
    seed_contact_tabs!

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

    # Email tabs (Emails folder)
    seed_email_tabs!

    # Legacy storage tabs (migrated from scope_folders)
    seed_legacy_storage_tabs!

    Rails.logger.info "[EntityTab] Seeded #{count} total tabs"
  end

  # Corporate entity tabs
  # SSoT: Defines the folder structure for corporate entity documents
  # Base folder: "Corporate" (stored on root tab)
  private_class_method def self.seed_corporate_entity_tabs!
    # Root tab - defines the base folder for this warehouse_type
    find_or_create_by!(warehouse_type: 'corporate_entity', tab_key: 'root') do |tab|
      tab.display_name = 'Root'
      tab.tab_group = 'system'
      tab.order_position = -1
      tab.enabled = true
      tab.is_system_tab = true
      tab.warehouse_enabled = true
      tab.warehouse_folder = 'Corporate'  # SSoT: Base folder for corporate_entity warehouse_type
    end

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
      find_or_create_by!(warehouse_type: 'corporate_entity', tab_key: attrs[:tab_key]) do |tab|
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
      find_or_create_by!(warehouse_type: 'corporate_entity', tab_key: tab_key) do |tab|
        tab.display_name = name
        tab.tab_group = 'documents'
        tab.entity_filters = %w[Company Trust Superfund Charity]
        tab.order_position = idx + 100
        tab.enabled = true
        tab.is_system_tab = true
        tab.warehouse_enabled = true
        tab.warehouse_folder = name.upcase
      end
    end

    # Feature tabs (Documents browser, Data view, Activity log)
    feature_tabs = [
      { tab_key: 'documents', display_name: 'Documents', component_name: 'DocumentsTab' },
      { tab_key: 'data', display_name: 'Data', component_name: 'DataTab' },
      { tab_key: 'activity', display_name: 'Activity', component_name: 'ActivityTab' }
    ]

    feature_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(warehouse_type: 'corporate_entity', tab_key: attrs[:tab_key]) do |tab|
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

  # Contact tabs (individuals: customers, suppliers, employees, users)
  # SSoT: 'contact' is THE ONE warehouse_type for all individuals (Jan 2026 - 'people' merged into 'contact')
  # Base folder: "Contacts" (stored on overview tab)
  private_class_method def self.seed_contact_tabs!
    # Overview/root tab - defines the base folder for this warehouse_type
    find_or_create_by!(warehouse_type: 'contact', tab_key: 'overview') do |tab|
      tab.display_name = 'Overview'
      tab.tab_group = 'overview'
      tab.order_position = 0
      tab.enabled = true
      tab.is_system_tab = true
      tab.warehouse_enabled = true
      tab.warehouse_folder = 'Contacts'  # SSoT: Base folder for contact warehouse_type
    end

    # Other contact tabs (non-storage)
    contact_tabs = [
      { tab_key: 'documents', display_name: 'Documents', tab_group: 'documents', order: 1 },
      { tab_key: 'financial', display_name: 'Financial', tab_group: 'overview', order: 2 },
      { tab_key: 'communications', display_name: 'Communications', tab_group: 'overview', order: 3 },
      { tab_key: 'cases', display_name: 'Cases', tab_group: 'overview', order: 4 },
      { tab_key: 'emails', display_name: 'Emails', tab_group: 'overview', order: 5 },
      { tab_key: 'portal-access', display_name: 'Portal Access', tab_group: 'overview', order: 6 },
      { tab_key: 'directorships', display_name: 'Directorships', tab_group: 'overview', order: 7 }
    ]

    contact_tabs.each do |attrs|
      find_or_create_by!(warehouse_type: 'contact', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = attrs[:tab_group]
        tab.order_position = attrs[:order]
        tab.enabled = true
        tab.is_system_tab = true
      end
    end
  end

  # DEPRECATED: Use seed_contact_tabs! (Jan 2026 - 'people' merged into 'contact')
  private_class_method def self.seed_people_tabs!
    seed_contact_tabs!
  end

  # Job tabs
  # SSoT: Defines the folder structure for job documents
  # Base folder: "Jobs" (stored on overview tab)
  private_class_method def self.seed_job_tabs!
    # Overview/root tab - defines the base folder for this warehouse_type
    find_or_create_by!(warehouse_type: 'job', tab_key: 'overview') do |tab|
      tab.display_name = 'Overview'
      tab.tab_group = 'overview'
      tab.order_position = 0
      tab.enabled = true
      tab.is_system_tab = true
      tab.warehouse_enabled = true
      tab.warehouse_folder = 'Jobs'  # SSoT: Base folder for job warehouse_type
    end

    # Other job tabs (non-storage)
    job_tabs = [
      { tab_key: 'schedule', display_name: 'Schedule', tab_group: 'overview', order: 1 },
      { tab_key: 'tasks', display_name: 'Tasks', tab_group: 'overview', order: 2 },
      { tab_key: 'documents', display_name: 'Documents', tab_group: 'documents', order: 3 },
      { tab_key: 'photos', display_name: 'Photos', tab_group: 'documents', order: 4 },
      { tab_key: 'financials', display_name: 'Financials', tab_group: 'overview', order: 5 },
      { tab_key: 'activity', display_name: 'Activity', tab_group: 'overview', order: 6 }
    ]

    job_tabs.each do |attrs|
      find_or_create_by!(warehouse_type: 'job', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = attrs[:tab_group]
        tab.order_position = attrs[:order]
        tab.enabled = true
        tab.is_system_tab = true
      end
    end
  end

  private_class_method def self.seed_document_tabs!
    # Document folders - these are the top-level folders for document organization
    # They mirror the corporate entity document tabs but are warehouse_type: 'document'
    folder_tabs = %w[Xero Advice ASIC Assets ATO Bank Company Dividends Financials General Insurance Loans Minutes Registry Trust]

    folder_tabs.each_with_index do |name, idx|
      tab_key = name.downcase.gsub(/\s+/, '-')
      find_or_create_by!(warehouse_type: 'document', tab_key: tab_key) do |tab|
        tab.display_name = name
        tab.tab_group = 'documents'
        tab.order_position = idx
        tab.enabled = true
        tab.is_system_tab = true
        tab.warehouse_enabled = true
        tab.warehouse_folder = name.upcase
      end
    end
  end

  # Task document folder tabs
  # SSoT: Defines the folder structure for task-related documents
  # Base folder: "Tasks" (defined in StorageConfiguration.warehouse_root_folders)
  # Template: "Tasks/{{TaskId}}/{{Category}}"
  private_class_method def self.seed_task_tabs!
    # NOTE: Overview tab NOT created for tasks (Jan 2026)
    # - Tasks only need Attachments and Responses tabs
    # - Base folder "Tasks" is defined in StorageConfiguration.warehouse_root_folders['task']
    # - Overview tabs were redundant and cluttered the Entity Config UI

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
      find_or_create_by!(warehouse_type: 'task', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'documents'
        tab.order_position = idx + 10
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.warehouse_enabled = true
        tab.warehouse_folder = attrs[:folder]
        tab.is_photo_category = attrs[:is_photo] || false
        tab.is_cad_category = attrs[:is_cad] || false
      end
    end

    Rails.logger.info "[EntityTab] Seeded #{where(warehouse_type: 'task').count} task tabs"
  end

  # Task Attachments tabs (for task attachments - under Tasks)
  # SSoT: Defines the folder structure for task attachment documents
  # Base folder: "Tasks" (stored on overview tab)
  # Template: "Tasks/{{TaskId}}/Attachments"
  private_class_method def self.seed_task_attachments_tabs!
    # Overview/root tab - defines the base folder for this warehouse_type
    # SSoT: warehouse_folder on overview tab = warehouse_type base folder
    find_or_create_by!(warehouse_type: 'task_attachments', tab_key: 'overview') do |tab|
      tab.display_name = 'Overview'
      tab.tab_group = 'overview'
      tab.order_position = 0
      tab.enabled = true
      tab.is_system_tab = true
      tab.icon_name = 'FolderOpen'  # Using FolderOpen for Overview (Paperclip reserved for Attachments)
      tab.warehouse_enabled = true
      tab.warehouse_folder = 'Tasks'  # SSoT: Base folder for task_attachments warehouse_type
    end

    # Document folder tabs for task attachments
    task_attachment_tabs = [
      { tab_key: 'attachments', display_name: 'Attachments', icon: 'Paperclip', folder: 'Attachments' },
      { tab_key: 'documents', display_name: 'Documents', icon: 'FileText', folder: 'Documents' },
      { tab_key: 'photos', display_name: 'Photos', icon: 'Image', folder: 'Photos', is_photo: true }
    ]

    task_attachment_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(warehouse_type: 'task_attachments', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'documents'
        tab.order_position = idx + 10
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.warehouse_enabled = true
        tab.warehouse_folder = attrs[:folder]
        tab.is_photo_category = attrs[:is_photo] || false
      end
    end

    Rails.logger.info "[EntityTab] Seeded #{where(warehouse_type: 'task_attachments').count} task_attachments tabs"
  end

  # Callable individually for task attachments seeding
  def self.seed_task_attachments_tabs_only!
    send(:seed_task_attachments_tabs!)
  end

  # Task Response tabs (for task responses - separate from attachments)
  # SSoT: Defines the folder structure for task response documents
  # Base folder: "Tasks" (stored on overview tab)
  # Template: "Tasks/{{TaskId}}/Responses"
  private_class_method def self.seed_task_responses_tabs!
    # Overview/root tab - defines the base folder for this warehouse_type
    # SSoT: warehouse_folder on overview tab = warehouse_type base folder
    find_or_create_by!(warehouse_type: 'task_responses', tab_key: 'overview') do |tab|
      tab.display_name = 'Overview'
      tab.tab_group = 'overview'
      tab.order_position = 0
      tab.enabled = true
      tab.is_system_tab = true
      tab.icon_name = 'FolderOpen'  # Using FolderOpen for Overview (FileOutput reserved for Responses)
      tab.warehouse_enabled = true
      tab.warehouse_folder = 'Tasks'  # SSoT: Base folder for task_responses warehouse_type
    end

    # Document folder tabs for task responses
    task_response_tabs = [
      { tab_key: 'responses', display_name: 'Responses', icon: 'FileOutput', folder: 'Responses' },
      { tab_key: 'documents', display_name: 'Documents', icon: 'FileText', folder: 'Documents' }
    ]

    task_response_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(warehouse_type: 'task_responses', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'documents'
        tab.order_position = idx + 10
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.warehouse_enabled = true
        tab.warehouse_folder = attrs[:folder]
      end
    end

    Rails.logger.info "[EntityTab] Seeded #{where(warehouse_type: 'task_responses').count} task_responses tabs"
  end

  # Callable individually for task responses seeding
  def self.seed_task_responses_tabs_only!
    send(:seed_task_responses_tabs!)
  end

  # Email document folder tabs
  # SSoT: Defines the folder structure for email storage
  # Base folder: "Emails" (stored on overview tab)
  # Template: "Emails/{{Mailbox}}/{{Year}}/{{Month}}"
  private_class_method def self.seed_email_tabs!
    # Overview/root tab - defines the base folder for this warehouse_type
    # SSoT: warehouse_folder on overview tab = warehouse_type base folder
    find_or_create_by!(warehouse_type: 'email', tab_key: 'overview') do |tab|
      tab.display_name = 'Overview'
      tab.tab_group = 'overview'
      tab.order_position = 0
      tab.enabled = true
      tab.is_system_tab = true
      tab.icon_name = 'Mail'
      tab.warehouse_enabled = true
      tab.warehouse_folder = 'Emails'  # SSoT: Base folder for email warehouse_type
    end

    # Document folder tabs for email storage
    # These represent the subfolders within the email base folder
    email_document_tabs = [
      { tab_key: 'email-body', display_name: 'Email Body', icon: 'FileText', folder: 'Email Body' },
      { tab_key: 'attachments', display_name: 'Attachments', icon: 'Paperclip', folder: 'Attachments' }
    ]

    email_document_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(warehouse_type: 'email', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'documents'
        tab.order_position = idx + 10
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.warehouse_enabled = true
        tab.warehouse_folder = attrs[:folder]
      end
    end

    Rails.logger.info "[EntityTab] Seeded #{where(warehouse_type: 'email').count} email tabs"
  end

  # Callable individually for email tabs seeding
  def self.seed_email_tabs_only!
    send(:seed_email_tabs!)
  end

  # Legacy storage paths migration
  # SSoT: Migrates all legacy scope_folders to EntityTab entries
  # These tabs use tab_key as the storage lookup key (not warehouse_type)
  #
  # Legacy scope_folders keys mapped to EntityTab:
  # - Users group: users, user_photos, user_contracts, my_docs
  # - Warehousing group: bill_inbox, chat, notes, templates, bank_statements, contracts, pricebook_photos
  # - Document types: excel_documents, word_documents, powerpoint_documents, pdf_documents
  # - Other: active_storage, custom, email_attachments
  #
  private_class_method def self.seed_legacy_storage_tabs!
    # Warehouse root tab - defines the base folder for warehouse warehouse_type
    # Note: Using 'Root' as display_name to avoid tab_key sync changing 'root' to 'warehouse'
    find_or_create_by!(warehouse_type: 'warehouse', tab_key: 'root') do |tab|
      tab.display_name = 'Root'
      tab.tab_group = 'system'
      tab.order_position = -1
      tab.enabled = true
      tab.is_system_tab = true
      tab.icon_name = nil  # No icon to avoid conflicts
      tab.warehouse_enabled = true
      tab.warehouse_folder = 'Warehousing'  # SSoT: Base folder for warehouse warehouse_type
    end

    # Users storage paths (separate root folder "Users")
    # Note: These are under warehouse warehouse_type but with their own base folder
    # Using unique icons to avoid icon_uniqueness_for_root_tabs validation conflict
    users_storage_tabs = [
      { tab_key: 'users', folder: 'Users', display_name: 'Users', icon: 'UserCircle' },
      { tab_key: 'user_photos', folder: 'Users/Photos', display_name: 'User Photos', icon: 'Camera' },
      { tab_key: 'user_contracts', folder: 'Users/Contracts', display_name: 'User Contracts', icon: 'ScrollText' },
      { tab_key: 'my_docs', folder: 'Users/MyDocs', display_name: 'My Documents', icon: 'FolderHeart' }
    ]

    users_storage_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(warehouse_type: 'warehouse', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'system'
        tab.order_position = idx + 100
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.warehouse_enabled = true
        tab.warehouse_folder = attrs[:folder]
      end
    end

    # Warehousing sub-folders
    # Using unique icons to avoid icon_uniqueness_for_root_tabs validation conflict
    warehousing_storage_tabs = [
      { tab_key: 'bill_inbox', folder: 'Warehousing/BillInbox', display_name: 'Bill Inbox', icon: 'ReceiptText' },
      { tab_key: 'chat', folder: 'Warehousing/Chat', display_name: 'Chat', icon: 'MessagesSquare' },
      { tab_key: 'notes', folder: 'Warehousing/Notes', display_name: 'Notes', icon: 'NotebookText' },
      { tab_key: 'templates', folder: 'Warehousing/Templates', display_name: 'Templates', icon: 'LayoutTemplate' },
      { tab_key: 'bank_statements', folder: 'Warehousing/Templates/Bank Statements', display_name: 'Bank Statements', icon: 'Building2' },
      { tab_key: 'contracts', folder: 'Warehousing/Templates/Contracts', display_name: 'Contracts', icon: 'FilePen' },
      { tab_key: 'pricebook_photos', folder: 'Warehousing/Pricebook Photos', display_name: 'Pricebook Photos', icon: 'Images' }
    ]

    warehousing_storage_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(warehouse_type: 'warehouse', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'system'
        tab.order_position = idx + 200
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.warehouse_enabled = true
        tab.warehouse_folder = attrs[:folder]
      end
    end

    # Document type storage paths (file type specific folders)
    # Using unique icons to avoid icon_uniqueness_for_root_tabs validation conflict
    document_type_tabs = [
      { tab_key: 'excel_documents', folder: 'Warehousing/Excel', display_name: 'Excel Documents', icon: 'Table2' },
      { tab_key: 'word_documents', folder: 'Warehousing/Word', display_name: 'Word Documents', icon: 'FileEdit' },
      { tab_key: 'powerpoint_documents', folder: 'Warehousing/PowerPoint', display_name: 'PowerPoint Documents', icon: 'ScreenShare' },
      { tab_key: 'pdf_documents', folder: 'Warehousing/PDF', display_name: 'PDF Documents', icon: 'FileCheck' }
    ]

    document_type_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(warehouse_type: 'warehouse', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'system'
        tab.order_position = idx + 300
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.warehouse_enabled = true
        tab.warehouse_folder = attrs[:folder]
      end
    end

    # Other storage paths
    # Using unique icons to avoid conflicts
    other_storage_tabs = [
      { tab_key: 'active_storage', folder: 'ActiveStorage', display_name: 'Active Storage', icon: 'Database' },
      { tab_key: 'custom', folder: 'Documents', display_name: 'Custom Documents', icon: 'FolderArchive' },
      { tab_key: 'email_attachments', folder: 'Emails', display_name: 'Email Attachments', icon: 'FileArchive' }
    ]

    other_storage_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(warehouse_type: 'warehouse', tab_key: attrs[:tab_key]) do |tab|
        tab.display_name = attrs[:display_name]
        tab.tab_group = 'system'
        tab.order_position = idx + 400
        tab.enabled = true
        tab.is_system_tab = true
        tab.icon_name = attrs[:icon]
        tab.warehouse_enabled = true
        tab.warehouse_folder = attrs[:folder]
      end
    end

    Rails.logger.info "[EntityTab] Seeded #{where(warehouse_type: 'warehouse', tab_group: 'system').count} legacy storage tabs"
  end

  # Callable individually for legacy storage tabs seeding
  def self.seed_legacy_storage_tabs_only!
    send(:seed_legacy_storage_tabs!)
  end

  # SSoT: Get effective icon name (child tabs inherit from parent)
  def effective_icon_name
    icon_name.presence || parent&.effective_icon_name || 'Folder'
  end

  private

  # SSoT: Auto-inherit warehouse folder settings from parent
  # When a tab has document types AND has a parent with warehouse_enabled: true,
  # automatically enable warehouse_enabled for this tab
  def inherit_warehouse_from_parent
    return if warehouse_enabled  # Already enabled, skip

    # Check if parent has warehouse enabled
    if parent&.warehouse_enabled
      self.warehouse_enabled = true
      Rails.logger.info "[EntityTab] Auto-inherited warehouse_enabled from parent '#{parent.display_name}' for tab '#{display_name}'"
    end
  end

  # Legacy alias
  alias_method :inherit_storage_from_parent, :inherit_warehouse_from_parent

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

  # SSoT: When display_name changes, update virtual folder paths in database
  # Phase 3 Blob Architecture: Files are stored at content-hash paths (Blobs/{hash}/...)
  # and NEVER physically move. "Folder" is just a virtual path in WarehouseDocument.folder.
  # This is now a synchronous call since it's just DB updates (instant).
  def rename_folders_in_database_if_needed
    return unless warehouse_enabled
    return unless saved_change_to_display_name?

    old_name, new_name = saved_change_to_display_name
    return if old_name.blank? || new_name.blank? || old_name == new_name

    # Synchronous call - it's just DB updates, fast enough to run inline
    EntityTabFolderRenameService.new(
      entity_tab: self,
      old_display_name: old_name,
      new_display_name: new_name
    ).execute
  end

  # SSoT: Root tabs must have unique icons within the same warehouse_type
  # Child tabs can inherit parent's icon OR have their own unique icon
  def icon_uniqueness_for_root_tabs
    return if parent_id.present?  # Child tabs can share/inherit icons
    return if icon_name.blank?    # No icon set, skip validation

    existing = EntityTab.where(warehouse_type: warehouse_type, parent_id: nil, icon_name: icon_name)
                        .where.not(id: id)

    if existing.exists?
      errors.add(:icon_name, "is already used by another root tab in this warehouse type")
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
