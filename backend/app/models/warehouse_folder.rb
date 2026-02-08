# frozen_string_literal: true

# WarehouseFolder - SSoT for folder configuration per warehouse type (tenant-scoped)
#
# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║  SSoT: THE ONE Table for Folder Configuration (Feb 2026)                       ║
# ║                                                                                ║
# ║  This is THE ONE source for all folder configuration. Each tenant has their   ║
# ║  own folder structure via acts_as_tenant.                                      ║
# ║                                                                                ║
# ║  Path Computation (NOT stored, computed at runtime):                           ║
# ║    warehouse_type.folder_path_template + parent_chain + folder_segment + suffix║
# ║    = "Job/{{JobCode}}/{{JobName}}" + "/Photo" + "/Supervisor" + "/{{Date}}"    ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝
#
# Usage:
#   WarehouseFolder.for_warehouse_type("job").first.name  # => "Jobs"
#   warehouse_folder.full_folder_path                     # => "Job/{{JobCode}}/{{JobName}}/Photo"
#   warehouse_folder.document_types                       # => [DocumentType, ...]
#
# Dynamic Tokens:
#   Some warehouse folders use dynamic tokens that expand at runtime:
#   - {{Mailbox}} - Expands to show all active synced mailboxes
#
class WarehouseFolder < ApplicationRecord
  # Multi-tenancy - REQUIRED for all warehouse_folders
  acts_as_tenant :tenant

  # Dynamic tokens that generate virtual folder structure from database
  DYNAMIC_TOKENS = {
    '{{Mailbox}}' => :mailbox
  }.freeze

  # SSoT: Tab types - THE ONE field for folder behavior
  TAB_TYPES = %w[system document mailbox revit photo].freeze

  # Valid tab groups (from warehouse_folders)
  TAB_GROUPS = %w[documents data overview reports setup main system].freeze

  # Display modes for tabs
  DISPLAY_MODES = %w[both icon_only text_only].freeze

  # Valid xero_scope values
  XERO_SCOPES = %w[primary].freeze

  # Associations
  belongs_to :warehouse_type
  belongs_to :parent, class_name: 'WarehouseFolder', optional: true
  belongs_to :job, optional: true  # job_id: null = global template, job_id: X = job-specific override
  has_many :children, class_name: 'WarehouseFolder', foreign_key: :parent_id, dependent: :destroy

  # Document type associations (SSoT)
  has_many :warehouse_folder_document_types, dependent: :destroy
  has_many :document_types, through: :warehouse_folder_document_types

  # Validations
  validates :name, presence: true
  validates :name, uniqueness: { scope: [:tenant_id, :warehouse_type_id, :parent_id], message: "already exists for this warehouse type and parent" }
  validates :folder_segment, presence: true
  validates :tab_type, inclusion: { in: TAB_TYPES }
  validates :tab_group, inclusion: { in: TAB_GROUPS }, allow_blank: true
  validates :display_mode, inclusion: { in: DISPLAY_MODES }, allow_blank: true
  validates :xero_scope, inclusion: { in: XERO_SCOPES }, allow_blank: true
  validate :parent_not_self
  validate :parent_same_warehouse_type
  validate :no_circular_reference
  validate :parent_tabs_must_be_system

  # Callbacks
  before_validation :sync_display_name_and_folder_segment
  before_validation :sync_tab_key_from_display_name
  before_validation :enforce_parent_system_type
  before_validation :enforce_leaf_document_type
  before_save :sync_booleans_from_tab_type
  after_create :ensure_parent_is_system
  before_destroy :prevent_system_deletion

  # Materialized Path: Increment template_version and queue path recompute
  # when folder structure changes (segment rename, parent move, suffix change)
  after_commit :queue_template_recompute,
    if: -> { saved_change_to_folder_segment? || saved_change_to_parent_id? || saved_change_to_folder_path_suffix? }

  # Scopes
  scope :enabled, -> { where(enabled: true) }
  scope :system_folders, -> { where(is_system: true) }
  scope :custom_folders, -> { where(is_system: false) }
  scope :ordered, -> { order(:order_position, :name) }
  scope :root_folders, -> { where(parent_id: nil) }
  scope :for_warehouse_type, ->(code) {
    if code.blank?
      all  # Return all folders when no warehouse_type specified
    else
      joins(:warehouse_type).where(warehouse_types: { code: code.to_s.downcase })
    end
  }
  scope :with_document_types, -> { where(warehouse_enabled: true) }
  scope :for_tab_group, ->(group) { where(tab_group: group) }
  scope :for_entity_type, ->(entity_type) {
    where("entity_filters @> ARRAY[?]::varchar[] OR entity_filters = '{}'", entity_type)
  }

  # Convenience scopes for common warehouse types (backwards compatibility)
  scope :for_jobs, -> { for_warehouse_type('job') }
  scope :for_job, -> { for_warehouse_type('job') }
  scope :for_contacts, -> { for_warehouse_type('contact') }
  scope :for_contact, -> { for_warehouse_type('contact') }
  scope :for_corporate, -> { for_warehouse_type('corporate') }
  scope :for_people, -> { for_warehouse_type('people') }
  scope :for_tasks, -> { for_warehouse_type('task') }

  # Delegation
  delegate :code, to: :warehouse_type, prefix: true, allow_nil: true

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: Path Computation (THE ONE way to get full folder paths)
  # ════════════════════════════════════════════════════════════════════════════════

  # Compute full folder path by walking up parent chain - NO FALLBACKS
  # @return [String] Full path like "Job/{{JobCode}}/{{JobName}}/Photo/Supervisor"
  def full_folder_path
    parts = []

    # 1. Warehouse type base template (REQUIRED)
    parts << warehouse_type.folder_path_template if warehouse_type&.folder_path_template.present?

    # 2. Walk up parent chain to collect segments
    ancestors = ancestor_segment_chain
    parts.concat(ancestors)

    # 3. Add user suffix if present
    parts << folder_path_suffix if folder_path_suffix.present?

    # Join - remove duplicates from overlap
    path = parts.compact.join('/')
    path.gsub(%r{//+}, '/')
  end

  # Just the segment chain (without warehouse_type prefix)
  # @return [String] Path like "Photo/Supervisor"
  def segment_path
    ancestors = ancestor_segment_chain
    ancestors << folder_path_suffix if folder_path_suffix.present?
    ancestors.join('/')
  end

  # Get ancestor chain including self
  # @return [Array<String>] Array of folder segments from root to self
  def ancestor_segment_chain
    segments = []
    current = self
    while current
      segments.unshift(current.folder_segment) if current.folder_segment.present?
      current = current.parent
    end
    segments
  end

  # Get ancestor chain for breadcrumbs (excluding self)
  # @return [Array<WarehouseFolder>] Array of ancestor folders
  def ancestor_chain
    chain = []
    current = parent
    while current
      chain.unshift(current)
      current = current.parent
    end
    chain
  end

  # Build full ancestor path by name (for display)
  # @return [String] Path like "Photo/Supervisor"
  def full_ancestor_path
    ancestor_segment_chain.join('/')
  end

  # Full path template including warehouse type prefix and ancestor hierarchy
  # @return [String] Full path like "Job/{{JobCode}}/{{JobName}}/Photo/Supervisor"
  def full_path_template
    full_folder_path
  end

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: Document Type Methods
  # ════════════════════════════════════════════════════════════════════════════════

  # Set document types by IDs
  def document_type_ids=(ids)
    ids = Array(ids).map(&:to_i).reject(&:zero?)
    existing_ids = warehouse_folder_document_types.pluck(:document_type_id)

    # Remove old assignments (only secondary ones)
    warehouse_folder_document_types
      .where.not(document_type_id: ids)
      .where(is_primary: false)
      .destroy_all

    # Add new assignments as secondary
    (ids - existing_ids).each do |doc_type_id|
      warehouse_folder_document_types.create(document_type_id: doc_type_id, is_primary: false)
    end
  end

  # Get document type IDs
  def document_type_ids
    warehouse_folder_document_types.pluck(:document_type_id)
  end

  # Get all document types with their effective templates
  # @return [Array<Hash>] Document types with template info
  def document_types_with_templates
    warehouse_folder_document_types.includes(:document_type).map do |join|
      dt = join.document_type
      {
        id: dt.id,
        name: dt.name,
        abbreviation: dt.abbreviation,
        is_primary: join.is_primary,
        ui_name_template: join.ui_name_template,
        download_name_template: join.download_name_template,
        effective_ui_name_template: join.effective_ui_name_template,
        effective_download_name_template: join.effective_download_name_template,
        has_template_overrides: join.has_template_overrides?
      }
    end
  end

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: UI Methods
  # ════════════════════════════════════════════════════════════════════════════════

  # Get effective icon name (inherits from parent)
  def effective_icon_name
    icon_name.presence || parent&.effective_icon_name || 'Folder'
  end

  # Check if this is a dynamic folder (contains dynamic tokens)
  def dynamic?
    return false if folder_segment.blank?

    DYNAMIC_TOKENS.keys.any? { |token| folder_segment.include?(token) }
  end

  # Get the type of dynamic content this folder generates
  # SSoT: Check tab_type first, then fallback to token detection
  def dynamic_type
    return :mailbox if tab_type == 'mailbox'

    return nil if folder_segment.blank?

    DYNAMIC_TOKENS.each do |token, type|
      return type if folder_segment.include?(token)
    end
    nil
  end

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: Tab Type Helpers (THE ONE way to check folder behavior)
  # ════════════════════════════════════════════════════════════════════════════════

  def system_tab?;   tab_type == 'system'; end
  def document_tab?; tab_type == 'document'; end
  def mailbox_tab?;  tab_type == 'mailbox'; end
  def revit_tab?;    tab_type == 'revit'; end
  def photo_tab?;    tab_type == 'photo'; end

  # Check if this folder can be deleted
  def can_delete?
    return false if is_system
    return false if children.exists?
    return false if warehouse_folder_document_types.exists?

    true
  end

  # Get the reason why deletion is blocked
  def deletion_blocked_reason
    return nil if can_delete?
    return "System folders cannot be deleted" if is_system

    reasons = []
    reasons << "#{children.count} sub-folders" if children.exists?
    reasons << "#{warehouse_folder_document_types.count} linked document types" if warehouse_folder_document_types.exists?

    "Cannot delete: has #{reasons.join(' and ')}"
  end

  # Get the full display path preview (replaces template tokens with examples)
  def path_preview
    template = full_path_template.presence
    return name if template.blank?

    preview = template.dup
    preview.gsub!("{{JobCode}}", "J-001")
    preview.gsub!("{{JobName}}", "Smith Residence")
    preview.gsub!("{{ContactName}}", "John Smith")
    preview.gsub!("{{CompanyCode}}", "ABC")
    preview.gsub!("{{CompanyGroup}}", "ABC Group")
    preview.gsub!("{{TaskId}}", "123")
    preview.gsub!("{{TaskName}}", "Site Inspection")
    preview.gsub!("{{CaseId}}", "456")
    preview.gsub!("{{CaseName}}", "Insurance Claim")
    preview.gsub!("{{UserName}}", "John Doe")
    preview.gsub!("{{TabName}}", "Sales")
    preview.gsub!("{{Year}}", Time.current.year.to_s)
    preview.gsub!("{{Month}}", Time.current.strftime("%B"))
    preview.gsub!("{{Mailbox}}", "inbox@example.com")
    preview.gsub!("{{Date}}", Time.current.strftime("%Y-%m-%d"))
    preview
  end

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: Class Methods
  # ════════════════════════════════════════════════════════════════════════════════

  # Get all enabled tabs for a warehouse type, ordered
  def self.tabs_for_warehouse_type(warehouse_type_name, entity_type: nil)
    tabs = for_warehouse_type(warehouse_type_name).enabled.ordered

    if entity_type.present?
      tabs = tabs.for_entity_type(entity_type)
    end

    tabs
  end

  # Get nested tabs structure for a warehouse type
  def self.nested_tabs_for_warehouse_type(warehouse_type_name, entity_type: nil)
    tabs = tabs_for_warehouse_type(warehouse_type_name, entity_type: entity_type)
                .root_folders
                .includes(children: { children: :children }, document_types: [])

    tabs.map(&:as_nested_json)
  end

  # Find by warehouse type code and name
  def self.find_by_type_and_name(type_code, name)
    for_warehouse_type(type_code).find_by(name: name)
  end

  # Get warehouse folders for UI dropdown (grouped by warehouse type)
  def self.grouped_options_for_select
    enabled.ordered.includes(:warehouse_type).group_by { |wf| wf.warehouse_type&.display_name }.transform_values do |folders|
      folders.map { |wf| { value: wf.id, label: wf.display_name || wf.name } }
    end
  end

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: Methods for WarehouseProvider integration
  # ════════════════════════════════════════════════════════════════════════════════

  # Get the warehouse folder for a warehouse type (root folder)
  # @param type_key [String] The warehouse type code (e.g., "job", "contact")
  # @return [WarehouseFolder, nil] The root folder for the warehouse type
  def self.warehouse_folder_for(type_key)
    for_warehouse_type(type_key).root_folders.first
  end

  # Get mapping of warehouse type codes to warehouse folder names
  # @return [Hash] { "job" => "Jobs", "contact" => "Contacts", ... }
  def self.warehouse_type_to_warehouse_folder
    result = {}
    root_folders.includes(:warehouse_type).each do |folder|
      next unless folder.warehouse_type
      result[folder.warehouse_type.code] = folder.display_name || folder.name
    end
    result
  end

  # Get list of available warehouse type codes
  # @return [Array<String>] ["job", "contact", "corporate", ...]
  def self.available_warehouse_types
    root_folders.includes(:warehouse_type).map { |f| f.warehouse_type&.code }.compact.uniq
  end

  # Get folder display name for a specific tab_key within a warehouse type
  # Returns the default_name if no matching folder is found
  # @param warehouse_type [String] e.g., "job", "corporate"
  # @param tab_key [String] e.g., "plans", "contracts"
  # @param default_name [String] fallback name if folder not found
  # @return [String] folder display name or default
  def self.folder_name_for(warehouse_type, tab_key, default_name)
    folder = for_warehouse_type(warehouse_type)
              .where(tab_key: tab_key)
              .enabled
              .first
    folder&.display_name || folder&.name || default_name
  end

  # Get mapping of warehouse types to base folder path templates
  # SSoT: Returns warehouse_type.folder_path_template (the BASE path), not any tab's full_folder_path
  # FRC (Feb 2026): Was returning full_folder_path from last root tab, causing wrong base paths
  # (e.g., "Contacts/{{ContactName}}/Cases" instead of "Contacts/{{ContactName}}")
  # @return [Hash] { "job" => "Job/{{JobCode}}/{{JobName}}", "contact" => "Contacts/{{ContactName}}", ... }
  def self.warehouse_folders_mapping
    result = {}
    WarehouseType.enabled.each do |wt|
      next if wt.folder_path_template.blank?
      result[wt.code] = wt.folder_path_template
    end
    result
  end

  # Get mapping of warehouse types to download name templates
  # @return [Hash] { "job" => "{JobCode} {DocType}.pdf", ... }
  def self.download_names_mapping
    result = {}
    root_folders.includes(:warehouse_type).each do |folder|
      next unless folder.warehouse_type
      result[folder.warehouse_type.code] = folder.download_name_template
    end
    result
  end

  # Get mapping of warehouse types to UI name templates
  # @return [Hash] { "job" => "{JobCode} - {DocType}", ... }
  def self.ui_names_mapping
    result = {}
    root_folders.includes(:warehouse_type).each do |folder|
      next unless folder.warehouse_type
      result[folder.warehouse_type.code] = folder.ui_name_template
    end
    result
  end

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: Folder Navigation (used by documents_controller for File Warehouse)
  # ════════════════════════════════════════════════════════════════════════════════

  # Given a root folder name (e.g., "Jobs"), return the warehouse_type code (e.g., "job")
  # @param folder_name [String] Root folder display name
  # @return [String, nil] Warehouse type code
  def self.warehouse_type_code_for_root_folder(folder_name)
    warehouse_type_to_warehouse_folder.invert[folder_name]
  end

  # Given a warehouse type code (e.g., "job"), return the root folder name (e.g., "Jobs")
  # @param type_code [String] Warehouse type code
  # @return [String, nil] Root folder display name
  def self.root_folder_name_for(type_code)
    warehouse_type_to_warehouse_folder[type_code.to_s]
  end

  # Given a root folder name (e.g., "Jobs"), return its child tabs for UI display
  # @param folder_name [String] Root folder display name
  # @return [Array<Hash>] Child tab data for rendering
  def self.tabs_for_root_folder(folder_name)
    type_code = warehouse_type_code_for_root_folder(folder_name)
    return [] unless type_code

    root = warehouse_folder_for(type_code)
    return [] unless root

    root.children.enabled.ordered.map do |child|
      { name: child.display_name || child.name, path: "#{folder_name}/#{child.display_name || child.name}" }
    end
  end

  # Given a path like "Jobs/Photo", return child tabs at that level
  # @param path [String] Folder path with "/" separators
  # @return [Array<Hash>] Child tab data for rendering
  def self.child_tabs_for_path(path)
    segments = path.to_s.split("/")
    return [] if segments.empty?

    root_name = segments.first
    type_code = warehouse_type_code_for_root_folder(root_name)
    return [] unless type_code

    root = warehouse_folder_for(type_code)
    return [] unless root

    # Walk the tree to find the target folder
    current = root
    segments[1..].each do |segment|
      current = current.children.enabled.find_by("display_name = ? OR name = ?", segment, segment)
      return [] unless current
    end

    current.children.enabled.ordered.map do |child|
      { name: child.display_name || child.name, path: "#{path}/#{child.display_name || child.name}" }
    end
  end

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: JSON Serialization
  # ════════════════════════════════════════════════════════════════════════════════

  # JSON serialization for API (flat)
  def as_json(options = {})
    {
      id: id,
      warehouse_type_id: warehouse_type_id,
      warehouse_type_code: warehouse_type_code,
      warehouse_type_name: warehouse_type&.display_name,
      name: name,
      display_name: display_name || name,
      folder_segment: folder_segment,
      folder_path_suffix: folder_path_suffix,
      full_folder_path: full_folder_path,
      path_preview: path_preview,
      tab_key: tab_key,
      tab_type: tab_type,
      tab_group: tab_group,
      parent_id: parent_id,
      icon_name: icon_name,
      effective_icon_name: effective_icon_name,
      display_mode: display_mode || 'both',
      hidden_by_default: hidden_by_default,
      warehouse_enabled: warehouse_enabled,
      is_photo_category: is_photo_category,
      is_cad_category: is_cad_category,
      is_system: is_system,
      is_mailbox: is_mailbox,
      enabled: enabled,
      order_position: order_position,
      entity_filters: entity_filters || [],
      xero_scope: xero_scope,
      visibility_rule: visibility_rule,
      ui_name_template: ui_name_template,
      download_name_template: download_name_template,
      can_delete: can_delete?,
      is_dynamic: dynamic?,
      dynamic_type: dynamic_type,
      children_count: children.count,
      document_types_count: warehouse_folder_document_types.count,
      created_at: created_at,
      updated_at: updated_at
    }
  end

  # Convert to nested JSON for API (includes children and document types)
  def as_nested_json
    {
      id: id,
      warehouse_type: warehouse_type_code,
      warehouse_type_id: warehouse_type_id,
      warehouse_type_code: warehouse_type_code,
      warehouse_type_name: warehouse_type&.display_name,
      tab_key: tab_key,
      tab_type: tab_type,
      name: display_name || name,
      display_name: display_name || name,
      display_code: display_code,
      description: description,
      tab_group: tab_group,
      parent_id: parent_id,
      entity_filters: entity_filters || [],
      order_position: order_position,
      enabled: enabled,
      icon_name: icon_name,
      effective_icon_name: effective_icon_name,
      display_mode: display_mode || 'both',
      hidden_by_default: hidden_by_default,
      component_name: component_name,
      is_system: is_system,
      is_mailbox: is_mailbox,
      dynamic_type: dynamic_type,
      visibility_rule: visibility_rule,
      xero_scope: xero_scope,
      warehouse_enabled: warehouse_enabled,
      folder_path: full_folder_path,
      folder_segment: folder_segment,
      folder_path_suffix: folder_path_suffix,
      download_name: download_name_template,
      ui_name: ui_name_template,
      full_warehouse_path: full_folder_path,
      uses_custom_path: uses_custom_path,
      warehouse_type_override: warehouse_type_override,
      path_preview: path_preview,
      is_photo_category: is_photo_category,
      is_cad_category: is_cad_category,
      can_delete: can_delete?,
      children: children.enabled.ordered.map(&:as_nested_json),
      document_types: document_types_with_templates,
      scope: warehouse_type_code  # Legacy backwards compat
    }
  end

  private

  # Materialized Path: Increment template_version and queue path recomputation
  def queue_template_recompute
    increment!(:template_version)
    RecomputeWarehouseTypePathsJob.perform_later(warehouse_type_id, tenant_id) if tenant_id.present?
  rescue StandardError => e
    Rails.logger.warn "[WarehouseFolder] queue_template_recompute failed for ##{id}: #{e.message}"
  end

  def sync_display_name_and_folder_segment
    # If display_name is set but folder_segment is not, use display_name
    self.folder_segment ||= display_name if display_name.present?
    # If folder_segment is set but display_name is not, use folder_segment
    self.display_name ||= folder_segment if folder_segment.present?
    # If name is not set, use display_name
    self.name ||= display_name if display_name.present?
  end

  def sync_tab_key_from_display_name
    return if tab_key.present?
    return if display_name.blank?

    self.tab_key = display_name
      .downcase
      .gsub(/[^a-z0-9\s-]/, '')
      .gsub(/\s+/, '-')
      .gsub(/-+/, '-')
      .gsub(/^-|-$/, '')
  end

  # SSoT: Keep old boolean columns in sync with tab_type during transition
  def sync_booleans_from_tab_type
    return unless tab_type_changed?

    self.is_mailbox = (tab_type == 'mailbox')
    self.is_photo_category = (tab_type == 'photo')
    self.is_cad_category = (tab_type == 'revit')
    # SSoT: Auto-derive tab_group from tab_type (system → 'data', everything else → 'documents')
    self.tab_group = (tab_type == 'system') ? 'data' : 'documents'
  end

  # Rule 1: Parents with children MUST be tab_type='system'
  # Auto-converts on save so the user doesn't have to think about it.
  def enforce_parent_system_type
    if children.exists? && tab_type != 'system'
      self.tab_type = 'system'
      # sync_booleans_from_tab_type fires separately via before_save
    end
  end

  # Rule 1 validation: block saving a parent tab as non-system
  def parent_tabs_must_be_system
    return unless persisted? # only validate existing records (enforce_ handles new)
    if children.exists? && tab_type != 'system'
      errors.add(:tab_type, "must be 'system' for tabs with children")
    end
  end

  # Rule 2: Leaf system tabs with document types → auto-convert to 'document'
  # If a tab has no children and has linked document types, it stores files,
  # so it should be document/photo/revit/mailbox - NOT system.
  def enforce_leaf_document_type
    return unless tab_type == 'system'
    return if children.exists? # parents are allowed to be system
    if warehouse_folder_document_types.any?
      self.tab_type = 'document'
    end
  end

  # When a child is created, auto-convert the parent to system
  def ensure_parent_is_system
    return unless parent.present?
    return if parent.tab_type == 'system'

    parent.update_columns(
      tab_type: 'system',
      tab_group: 'data',
      is_photo_category: false,
      is_cad_category: false,
      is_mailbox: false
    )
  end

  def prevent_system_deletion
    if is_system
      errors.add(:base, "System folders cannot be deleted")
      throw(:abort)
    end
  end

  def parent_not_self
    return if parent_id.blank?
    errors.add(:parent_id, "cannot be self") if parent_id == id
  end

  def parent_same_warehouse_type
    return if parent_id.blank?
    if parent&.warehouse_type_id != warehouse_type_id
      errors.add(:parent_id, "must be from the same warehouse type")
    end
  end

  def no_circular_reference
    return if parent_id.blank?

    visited = Set.new([id])
    current = parent

    while current.present?
      if visited.include?(current.id)
        errors.add(:parent_id, "would create a circular reference")
        return
      end
      visited.add(current.id)
      current = current.parent
    end
  end
end
