# SSoT: Unified Warehouse Folder Configuration
# This is THE SINGLE SOURCE OF TRUTH for all folder tabs across:
# - Corporate Entities (Companies, Trusts, Superfunds, Charities)
# - People (Contacts)
# - Jobs
# - Document Folders
#
# Xero tabs are children of the Xero tab in corporate warehouse_type (SSoT)
#
# Renamed: EntityTab → WarehouseFolder → WarehouseFolder (Jan 2026)
#
class WarehouseFolder < ApplicationRecord
  # Table renamed: entity_tabs → warehouse_folders (Jan 2026)
  # Model renamed: EntityTab → WarehouseFolder → WarehouseFolder (Jan 2026)
  self.table_name = 'warehouse_folders'

  # NOTE: Multi-tenancy REMOVED (Jan 2026)
  # WarehouseFolders are GLOBAL configuration shared across all tenants.
  # All WarehouseFolders have company_group_id=NULL by design.
  # The uniqueness validation still includes company_group_id for future per-tenant customization.
  #
  # Valid warehouse types (xero tabs are children of corporate/xero tab)
  # System warehouse types (email, warehouse, task, task_attachments, task_responses, user, case) are read-only in UI - is_system_tab: true
  # SSoT: 'contact' is THE ONE warehouse_type for all individuals (Jan 2026 - 'people' merged into 'contact')
  # SSoT: 'user' added for Teeem Docs personal user documents (Jan 2026)
  # SSoT: 'case' added for Case document management (Jan 2026)
  # SSoT: 'asset' added for Asset Register documents (Jan 2026)
  # SSoT: 'financial' added for Financial transaction receipts (Jan 2026)
  # SSoT: 'compliance' added for job compliance docs - permits, approvals (Jan 2026)
  # SSoT: 'payment' added for subcontractor payment docs (Jan 2026)
  # SSoT: 'bank_statement', 'template', 'esignature', 'plan' added (Jan 2026)
  WAREHOUSE_TYPES = %w[
    corporate job document contact email email_body email_attachments warehouse
    task task_attachments task_responses
    case case_documents case_emails
    asset asset_expenses asset_service asset_readings
    financial financial_transactions
    compliance payment payment_invoices payment_proof
    bank_statement balance_sheet template
    template_documents template_bank_statements template_invoices template_email_signatures template_pdf_fields
    esignature esignature_pending esignature_completed
    plan
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

  # SSoT: Literal folder name pattern (Jan 2026)
  # [[Name]] = literal folder name (strips brackets)
  # {{Name}} = dynamic placeholder (resolved elsewhere)
  LITERAL_FOLDER_PATTERN = /\A\[\[(.+)\]\]\z/.freeze


  # Associations
  belongs_to :parent, class_name: 'WarehouseFolder', optional: true
  belongs_to :job, optional: true  # For per-job tabs

  has_many :children, class_name: 'WarehouseFolder', foreign_key: :parent_id, dependent: :destroy

  # Document type links (SSoT for tab-to-document-type associations)
  has_many :warehouse_folder_document_types, dependent: :destroy
  has_many :document_types, through: :warehouse_folder_document_types

  # SSoT: Auto-inherit warehouse folder flag from parent when document types assigned
  before_save :inherit_warehouse_from_parent

  # SSoT: Auto-sync tab_key from display_name (display_name is the source of truth)
  before_validation :sync_tab_key_from_display_name

  # SSoT: When display_name changes, update virtual folder paths in database
  # Phase 3 Blob Architecture: No physical file movement, just DB updates (instant)
  after_update :rename_folders_in_database_if_needed

  # Set document types by IDs
  # SSoT: WarehouseFolder can only add/remove SECONDARY links (is_primary: false)
  # Primary links are controlled from DocumentType side only
  def document_type_ids=(ids)
    ids = Array(ids).map(&:to_i).reject(&:zero?)
    existing_ids = warehouse_folder_document_types.pluck(:document_type_id)

    # Remove old assignments - ONLY secondary ones!
    # Primary links cannot be removed from WarehouseFolder side
    warehouse_folder_document_types
      .where.not(document_type_id: ids)
      .where(is_primary: false)
      .destroy_all

    # Add new assignments as SECONDARY (is_primary: false)
    # Primary can only be set from DocumentType side
    (ids - existing_ids).each do |doc_type_id|
      warehouse_folder_document_types.create(document_type_id: doc_type_id, is_primary: false)
    end
  end

  # Get document type IDs
  def document_type_ids
    warehouse_folder_document_types.pluck(:document_type_id)
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
  scope :for_corporate, -> { for_warehouse_type('corporate') }
  scope :for_contacts, -> { for_warehouse_type('contact') }
  scope :for_people, -> { for_warehouse_type('contact') }  # DEPRECATED: Use for_contacts (Jan 2026)
  scope :for_jobs, -> { for_warehouse_type('job') }
  scope :for_documents, -> { for_warehouse_type('document') }
  # Note: Xero tabs are children of corporate/xero tab, not a separate warehouse_type

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

  # Filter by entity type (for corporate warehouse_type)
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

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: File Warehouse Folder Structure (THE ONE source)
  # These methods define the folder hierarchy for File Warehouse
  # ════════════════════════════════════════════════════════════════════════════════

  # SSoT: Map root folder names to warehouse_type
  # Derived from warehouse_type naming convention
  ROOT_FOLDER_TO_WAREHOUSE_TYPE = {
    'Jobs' => 'job',
    'Contacts' => 'contact',
    'Corporate' => 'corporate',
    'Tasks' => 'task',
    'Cases' => 'case',
    'Emails' => 'email',
    'Teeem Docs' => 'user',
    'Warehousing' => 'warehouse',
    'Templates' => 'template'
  }.freeze

  # Get warehouse_type for a root folder
  def self.warehouse_type_for_root_folder(root_folder)
    ROOT_FOLDER_TO_WAREHOUSE_TYPE[root_folder]
  end

  # Get root folder for a warehouse_type (inverse lookup)
  # @param warehouse_type [String] e.g., "job", "contact", "corporate"
  # @return [String, nil] e.g., "Jobs", "Contacts", "Corporate"
  def self.root_folder_for_warehouse_type(warehouse_type)
    ROOT_FOLDER_TO_WAREHOUSE_TYPE.key(warehouse_type.to_s)
  end

  # Get all root folders (for File Warehouse root level)
  def self.all_root_folders
    ROOT_FOLDER_TO_WAREHOUSE_TYPE.keys
  end

  # Get tabs (subfolders) for a root folder
  # @param root_folder [String] The root folder name (e.g., "Jobs", "Contacts")
  # @return [Array<Hash>] Array of {name:, path:, has_children:, etc.}
  def self.tabs_for_root_folder(root_folder)
    warehouse_type = warehouse_type_for_root_folder(root_folder)
    return [] unless warehouse_type

    for_warehouse_type(warehouse_type)
      .where(warehouse_enabled: true)
      .enabled
      .root_tabs
      .includes(:children)
      .ordered
      .map do |tab|
        has_children = tab.children.where(warehouse_enabled: true).exists?
        {
          name: tab.display_name,
          path: "#{root_folder}/#{tab.display_name}",
          tab_key: tab.tab_key,
          icon: tab.icon_name,
          warehouse_type: warehouse_type,
          warehouse_folder_id: tab.id,
          has_children: has_children,
          count: 0  # Enriched by controller with actual counts
        }
      end
  end

  # Get child tabs for a specific path (multi-level support)
  # @param path [String] The folder path (e.g., "Jobs/Photo", "Jobs/Photo/Supervisor")
  # @return [Array<Hash>] Array of child tabs
  def self.child_tabs_for_path(path)
    parts = path.split('/')
    return [] if parts.length < 2

    root_folder = parts[0]
    warehouse_type = warehouse_type_for_root_folder(root_folder)
    return [] unless warehouse_type

    # Walk the path to find the parent tab
    parent_tab = nil
    parts[1..].each do |folder_name|
      scope = parent_tab ? parent_tab.children : for_warehouse_type(warehouse_type).root_tabs
      parent_tab = scope.find_by(display_name: folder_name, warehouse_enabled: true)
      return [] unless parent_tab
    end

    return [] unless parent_tab

    parent_tab.children
      .where(warehouse_enabled: true)
      .enabled
      .includes(:children)
      .ordered
      .map do |tab|
        has_children = tab.children.where(warehouse_enabled: true).exists?
        {
          name: tab.display_name,
          path: "#{path}/#{tab.display_name}",
          tab_key: tab.tab_key,
          icon: tab.icon_name,
          warehouse_type: warehouse_type,
          warehouse_folder_id: tab.id,
          has_children: has_children,
          count: 0
        }
      end
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
  # @param warehouse_type [String] The warehouse type (job, corporate, etc.)
  # @param tab_key [String] The tab key (plans, documents, photos, etc.)
  # @param fallback [String] Fallback if tab not found (optional)
  # @return [String] The display_name to use as folder name
  #
  # Examples:
  #   WarehouseFolder.folder_name_for("job", "plans")     # => "04 Plans" (from WarehouseFolder)
  #   WarehouseFolder.folder_name_for("job", "documents") # => "Documents"
  #   WarehouseFolder.folder_name_for("job", "missing", "Fallback") # => "Fallback"
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

    # Count documents with any of our linked document types via WarehouseDocument
    WarehouseDocument
      .where("metadata->>'document_type_id' IN (?)", document_type_ids.map(&:to_s))
      .count
  end

  # ════════════════════════════════════════════════════════════════════════════════
  # RECURSIVE DESCENDANT METHODS
  # For cascade document views - get all documents in a folder AND its descendants
  # Uses PostgreSQL recursive CTE for efficient deep hierarchy traversal
  # ════════════════════════════════════════════════════════════════════════════════

  # Get all descendant IDs using PostgreSQL recursive CTE
  # Returns array including self.id and all child/grandchild/etc IDs
  # @return [Array<Integer>] Array of WarehouseFolder IDs
  def all_descendant_ids
    return [id] if children.empty?

    sql = <<~SQL
      WITH RECURSIVE descendants AS (
        SELECT id, parent_id FROM warehouse_folders WHERE id = ?
        UNION ALL
        SELECT wf.id, wf.parent_id FROM warehouse_folders wf
        INNER JOIN descendants d ON wf.parent_id = d.id
      )
      SELECT id FROM descendants
    SQL

    WarehouseFolder.connection.execute(
      WarehouseFolder.sanitize_sql([sql, id])
    ).pluck('id')
  end

  # Get all descendant hierarchy paths
  # @return [Array<String>] Array of hierarchy paths for self and all descendants
  def all_descendant_paths
    WarehouseFolder.where(id: all_descendant_ids).map(&:hierarchy_path)
  end

  # Get all descendant display names for folder path matching
  # Returns paths relative to this location (e.g., if this is "Insurance",
  # returns ["Insurance", "Insurance/General", "Insurance/Claims", ...])
  # @return [Array<String>] Array of folder paths for self and descendants
  def all_descendant_folder_paths
    descendants = WarehouseFolder.where(id: all_descendant_ids)
                                  .includes(:parent)
                                  .order(:parent_id, :order_position)

    descendants.map do |loc|
      build_relative_path(loc)
    end.compact
  end

  # Count documents including all descendants
  # @param include_descendants [Boolean] Whether to include descendant folders
  # @return [Integer] Total document count
  def document_count_cascade(include_descendants: false)
    return document_count unless include_descendants

    # Get all document_type_ids from self and all descendants
    all_type_ids = WarehouseFolder.where(id: all_descendant_ids)
                                   .joins(:warehouse_folder_document_types)
                                   .pluck('warehouse_folder_document_types.document_type_id')
                                   .uniq

    return 0 if all_type_ids.empty?

    WarehouseDocument
      .where("metadata->>'document_type_id' IN (?)", all_type_ids.map(&:to_s))
      .count
  end

  private

  # Build path relative to self for a descendant location
  def build_relative_path(descendant)
    return display_name if descendant.id == id

    # Build path from descendant back to self
    path_parts = []
    current = descendant
    while current && current.id != id
      path_parts.unshift(current.display_name)
      current = current.parent
    end

    # Prepend our own display_name
    path_parts.unshift(display_name)
    path_parts.join('/')
  end

  public

  # SSoT: Get the full warehouse path template for this tab
  # The warehouse_folder column stores the COMPLETE path template (Feb 2026 consolidation)
  # No derivation needed - warehouse_folders table is THE ONE SSoT
  def resolved_warehouse_path
    return nil unless warehouse_enabled

    # SSoT: warehouse_folder column stores complete path template
    # e.g., "Corporate/{{CompanyGroup}}/{{CompanyCode}}/Documents"
    read_attribute(:warehouse_folder)
  end

  # Get the full storage path for this tab
  # SSoT: root_path + resolved warehouse path (template with folder substituted)
  def full_warehouse_path
    path = resolved_warehouse_path
    return nil unless warehouse_enabled && path.present?

    config = WarehouseProvider.instance
    root = config&.root_path || ''
    "#{root}/#{path}".gsub(%r{//+}, '/')
  end

  # SSoT: Resolve folder tokens to physical folder names
  # [[Name]] = literal folder name (strips brackets) - e.g., [[TeeemXL]] → "TeeemXL"
  # {{Name}} = dynamic placeholder (left unchanged for template resolution)
  # Other values returned as-is
  def resolve_folder_token(value)
    return display_name.to_s if value.blank?

    # Check if it's a literal folder name [[Name]]
    if (match = value.match(LITERAL_FOLDER_PATTERN))
      match[1] # Return the name without brackets
    else
      # Return as-is (could be {{placeholder}} or plain text)
      value
    end
  end

  # SSoT: Template Inheritance for SharePoint Paths
  # ================================================

  # Valid path types for warehouse_type_override field
  PATH_TYPES = %w[corporate contacts].freeze

  # SSoT: Map WarehouseFolder to WarehouseProvider template warehouse type
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
    when 'corporate' then :corporate
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

  # Get the folder name for this tab
  # SSoT: warehouse_folders has full path pattern, tab just provides folder name
  def inherited_template
    return nil unless warehouse_enabled
    # Simply return the display_name - this is appended to warehouse_folders path
    display_name
  end

  # Get the warehouse base path for this tab (used in UI preview)
  def warehouse_base_path
    return nil unless warehouse_enabled
    config = WarehouseProvider.instance
    return nil unless config
    File.join(config.root_path, config.path_for(effective_warehouse_type))
  rescue => e
    Rails.logger.warn "[WarehouseFolder] Failed to get base path: #{e.message}"
    nil
  end


  # Get the EFFECTIVE warehouse path for this tab (for UI display)
  # SSoT: WarehouseFolder owns folder paths. Child tabs INHERIT from parent.
  # Note: This returns ONLY the tab's folder - identifier pattern is in warehouse_folders
  #
  # Inheritance chain:
  #   Photo (root tab) → "Photo"
  #   Site Photo (child) → "Photo/Site Photo"  ← inherits parent + adds own name
  def effective_warehouse_path
    return nil unless warehouse_enabled

    # SSoT: warehouse_folder column removed (Jan 2026) - use display_name for all paths
    if parent&.warehouse_enabled
      # SSoT: INHERIT FROM PARENT - child path = parent path + "/" + display_name
      parent_path = parent.effective_warehouse_path
      return nil unless parent_path.present?
      "#{parent_path}/#{display_name}"
    else
      # Root tab - just the display_name (identifier pattern is in warehouse_folders)
      display_name
    end
  end

  # Get the folder path for actual uploads
  # SSoT: effective_warehouse_path now returns just the tab's folder (e.g., "Plans")
  # The identifier pattern ({{JobCode}}) is in warehouse_folders, handled by resolve_path
  def upload_folder_path
    effective_warehouse_path
  end

  # Build hierarchy path - SSoT: Static path first, then dynamic tokens
  def hierarchy_path
    # SSoT: 'contact' is THE ONE for all individuals (Jan 2026 - 'people' merged into 'contact')
    # SSoT: 'corporate' is THE ONE for corporate entities (Jan 2026 - 'corporate_entity' renamed)
    prefix = case warehouse_type
    when 'corporate' then 'Corporate'
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

    # SSoT: warehouse_folder column removed (Jan 2026) - just use static path
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
      warehouse_folder: read_attribute(:warehouse_folder),  # SSoT: Raw value for editing (nil = use display_name default)
      download_name: read_attribute(:download_name),  # SSoT: "Document Download Name" in UI
      ui_name: read_attribute(:ui_name),  # SSoT: "Document UI Name" in UI
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
      document_count_cascade: document_count_cascade(include_descendants: true),  # SSoT: Count including all descendants
      is_photo_category: is_photo_category,  # SSoT: Explicit photo gallery flag
      can_delete: can_delete?,
      children: children.enabled.ordered.map(&:as_nested_json),
      document_types: document_types.map { |dt|
        join = warehouse_folder_document_types.find_by(document_type_id: dt.id)
        {
          id: dt.id,
          name: dt.name,
          display_name: dt.display_name,
          abbreviation: dt.abbreviation,
          file_name: dt.file_name,
          is_primary: join&.is_primary || false  # SSoT: Include primary/secondary flag
        }
      },
      # Legacy alias (scope only - SharePoint/storage aliases REMOVED Jan 2026, use warehouse_* instead)
      scope: warehouse_type
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

  # SSoT: Get warehouse folder paths from WarehouseFolder
  # Replaces scope_folders in WarehouseProvider
  #
  # Returns a hash that supports two lookup patterns:
  # 1. By warehouse_type: { "email" => "Emails", "job" => "Jobs", ... } (from overview/root tabs)
  # 2. By tab_key: { "users" => "Users", "user_photos" => "Users/Photos", ... } (from all warehouse tabs)
  #
  # This allows WarehouseProvider.path_for to work with both:
  # - path_for("email") => "Emails" (warehouse_type lookup)
  # - path_for("users") => "Users" (tab_key lookup for legacy storage keys)
  #
  # Note: Legacy scope_folders used underscores (user_photos), but WarehouseFolder tab_key uses hyphens (user-photos).
  # This method adds both underscore and hyphen versions for backward compatibility.
  #
  def self.warehouse_base_folders
    # SSoT: Delegate to WarehouseProvider.warehouse_folders
    # Legacy warehouse_folder is DEPRECATED - all paths now derived from SSoT
    WarehouseProvider.instance.effective_warehouse_folders
  rescue StandardError => e
    Rails.logger.warn "[WarehouseFolder.warehouse_base_folders] Error fetching from SSoT: #{e.message}"
    {}
  end


  # Seed task tabs only (callable individually)
  def self.seed_task_tabs_only!
    send(:seed_task_tabs!)
  end

  # Seed system tabs for all warehouse_types
  def self.seed_system_tabs!
    # Corporate Entity tabs
    seed_corporate_warehouse_folders!

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

    Rails.logger.info "[WarehouseFolder] Seeded #{count} total tabs"
  end

  # Corporate entity tabs
  # SSoT: Defines the folder structure for corporate entity documents
  # Base folder: "Corporate" (stored on root tab)
  private_class_method def self.seed_corporate_warehouse_folders!
    # Root tab - defines the base folder for this warehouse_type
    find_or_create_by!(warehouse_type: 'corporate', tab_key: 'root') do |tab|
      tab.display_name = 'Root'
      tab.tab_group = 'system'
      tab.order_position = -1
      tab.enabled = true
      tab.is_system_tab = true
      tab.warehouse_enabled = true
      # warehouse_folder removed - now derived from WarehouseProvider.warehouse_folders
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
      find_or_create_by!(warehouse_type: 'corporate', tab_key: attrs[:tab_key]) do |tab|
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
      find_or_create_by!(warehouse_type: 'corporate', tab_key: tab_key) do |tab|
        tab.display_name = name
        tab.tab_group = 'documents'
        tab.entity_filters = %w[Company Trust Superfund Charity]
        tab.order_position = idx + 100
        tab.enabled = true
        tab.is_system_tab = true
        tab.warehouse_enabled = true
        # warehouse_folder removed - derived from WarehouseProvider.warehouse_folders
      end
    end

    # Feature tabs (Documents browser, Data view, Activity log)
    feature_tabs = [
      { tab_key: 'documents', display_name: 'Documents', component_name: 'DocumentsTab' },
      { tab_key: 'data', display_name: 'Data', component_name: 'DataTab' },
      { tab_key: 'activity', display_name: 'Activity', component_name: 'ActivityTab' }
    ]

    feature_tabs.each_with_index do |attrs, idx|
      find_or_create_by!(warehouse_type: 'corporate', tab_key: attrs[:tab_key]) do |tab|
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
      # warehouse_folder removed - now derived from WarehouseProvider.warehouse_folders
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
      # warehouse_folder removed - now derived from WarehouseProvider.warehouse_folders
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
        # warehouse_folder removed - derived from WarehouseProvider.warehouse_folders
      end
    end
  end

  # Task document folder tabs
  # SSoT: Defines the folder structure for task-related documents
  # Base folder: "Tasks" (defined in WarehouseProvider.warehouse_folders)
  # Template: "Tasks/{{TaskId}}/{{TaskName}}/{{Category}}"
  private_class_method def self.seed_task_tabs!
    # NOTE: Overview tab NOT created for tasks (Jan 2026)
    # - Tasks only need Attachments and Responses tabs
    # - Base folder "Tasks" is defined in WarehouseProvider.warehouse_folders['task']
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
        # warehouse_folder removed - derived from WarehouseProvider.warehouse_folders
        tab.is_photo_category = attrs[:is_photo] || false
        tab.is_cad_category = attrs[:is_cad] || false
      end
    end

    Rails.logger.info "[WarehouseFolder] Seeded #{where(warehouse_type: 'task').count} task tabs"
  end

  # Task Attachments tabs (for task attachments - under Tasks)
  # SSoT: Defines the folder structure for task attachment documents
  # Base folder: "Tasks" (stored on overview tab)
  # Template: "Tasks/{{TaskId}}/{{TaskName}}/Attachments"
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
      # warehouse_folder removed - now derived from WarehouseProvider.warehouse_folders
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
        # warehouse_folder removed - derived from WarehouseProvider.warehouse_folders
        tab.is_photo_category = attrs[:is_photo] || false
      end
    end

    Rails.logger.info "[WarehouseFolder] Seeded #{where(warehouse_type: 'task_attachments').count} task_attachments tabs"
  end

  # Callable individually for task attachments seeding
  def self.seed_task_attachments_tabs_only!
    send(:seed_task_attachments_tabs!)
  end

  # Task Response tabs (for task responses - separate from attachments)
  # SSoT: Defines the folder structure for task response documents
  # Base folder: "Tasks" (stored on overview tab)
  # Template: "Tasks/{{TaskId}}/{{TaskName}}/Responses"
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
      # warehouse_folder removed - now derived from WarehouseProvider.warehouse_folders
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
        # warehouse_folder removed - derived from WarehouseProvider.warehouse_folders
      end
    end

    Rails.logger.info "[WarehouseFolder] Seeded #{where(warehouse_type: 'task_responses').count} task_responses tabs"
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
      # warehouse_folder removed - now derived from WarehouseProvider.warehouse_folders
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
        # warehouse_folder removed - derived from WarehouseProvider.warehouse_folders
      end
    end

    Rails.logger.info "[WarehouseFolder] Seeded #{where(warehouse_type: 'email').count} email tabs"
  end

  # Callable individually for email tabs seeding
  def self.seed_email_tabs_only!
    send(:seed_email_tabs!)
  end

  # Legacy storage paths migration
  # SSoT: Migrates all legacy scope_folders to WarehouseFolder entries
  # These tabs use tab_key as the storage lookup key (not warehouse_type)
  #
  # Legacy scope_folders keys mapped to WarehouseFolder:
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
      # warehouse_folder removed - now derived from WarehouseProvider.warehouse_folders
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
        # warehouse_folder removed - derived from WarehouseProvider.warehouse_folders
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
        # warehouse_folder removed - derived from WarehouseProvider.warehouse_folders
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
        # warehouse_folder removed - derived from WarehouseProvider.warehouse_folders
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
        # warehouse_folder removed - derived from WarehouseProvider.warehouse_folders
      end
    end

    Rails.logger.info "[WarehouseFolder] Seeded #{where(warehouse_type: 'warehouse', tab_group: 'system').count} legacy storage tabs"
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
      Rails.logger.info "[WarehouseFolder] Auto-inherited warehouse_enabled from parent '#{parent.display_name}' for tab '#{display_name}'"
    end
  end

  # SSoT: Only auto-generate tab_key for NEW records when tab_key is blank
  # display_name is now used for file display name templates (e.g., {{OriginalFileName}})
  # NOT for deriving tab_key - tab_key should remain stable once set
  def sync_tab_key_from_display_name
    return if tab_key.present?  # Only set tab_key if blank (new record)
    return if display_name.blank?

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
    WarehouseFolderRenameService.new(
      warehouse_folder: self,
      old_display_name: old_name,
      new_display_name: new_name
    ).execute
  end

  # SSoT: Root tabs must have unique icons within the same warehouse_type
  # Child tabs can inherit parent's icon OR have their own unique icon
  def icon_uniqueness_for_root_tabs
    return if parent_id.present?  # Child tabs can share/inherit icons
    return if icon_name.blank?    # No icon set, skip validation

    existing = WarehouseFolder.where(warehouse_type: warehouse_type, parent_id: nil, icon_name: icon_name)
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
