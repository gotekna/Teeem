# frozen_string_literal: true

# BaseFolder - SSoT for folder configuration per warehouse type (tenant-scoped)
#
# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║  SSoT: THE ONE Table for Folder Configuration (Feb 2026)                       ║
# ║                                                                                ║
# ║  This table REPLACES warehouse_folders. All folder config is now here.         ║
# ║  Each tenant has their own folder structure via acts_as_tenant.                ║
# ║                                                                                ║
# ║  Path Computation (NOT stored, computed at runtime):                           ║
# ║    warehouse_type.folder_path_template + parent_chain + folder_segment + suffix║
# ║    = "Job/{{JobCode}}/{{JobName}}" + "/Photo" + "/Supervisor" + "/{{Date}}"    ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝
#
# Usage:
#   BaseFolder.for_warehouse_type("job").first.name  # => "Jobs"
#   base_folder.full_folder_path                     # => "Job/{{JobCode}}/{{JobName}}/Photo"
#   base_folder.document_types                       # => [DocumentType, ...]
#
# Dynamic Tokens:
#   Some base folders use dynamic tokens that expand at runtime:
#   - {{Mailbox}} - Expands to show all active synced mailboxes
#
class BaseFolder < ApplicationRecord
  # Multi-tenancy - REQUIRED for all base_folders
  acts_as_tenant :tenant

  # Dynamic tokens that generate virtual folder structure from database
  DYNAMIC_TOKENS = {
    '{{Mailbox}}' => :mailbox
  }.freeze

  # Valid tab groups (from warehouse_folders)
  TAB_GROUPS = %w[documents data overview reports setup main system].freeze

  # Display modes for tabs
  DISPLAY_MODES = %w[both icon_only text_only].freeze

  # Valid xero_scope values
  XERO_SCOPES = %w[primary].freeze

  # Associations
  belongs_to :warehouse_type
  belongs_to :parent, class_name: 'BaseFolder', optional: true
  belongs_to :job, optional: true  # job_id: null = global template, job_id: X = job-specific override
  has_many :children, class_name: 'BaseFolder', foreign_key: :parent_id, dependent: :destroy

  # Document type associations (SSoT - replaces warehouse_folder_document_types)
  has_many :base_folder_document_types, dependent: :destroy
  has_many :document_types, through: :base_folder_document_types

  # Validations
  validates :name, presence: true
  validates :name, uniqueness: { scope: [:tenant_id, :warehouse_type_id, :parent_id], message: "already exists for this warehouse type and parent" }
  validates :folder_segment, presence: true
  validates :tab_group, inclusion: { in: TAB_GROUPS }, allow_blank: true
  validates :display_mode, inclusion: { in: DISPLAY_MODES }, allow_blank: true
  validates :xero_scope, inclusion: { in: XERO_SCOPES }, allow_blank: true
  validate :parent_not_self
  validate :parent_same_warehouse_type
  validate :no_circular_reference

  # Callbacks
  before_validation :sync_display_name_and_folder_segment
  before_validation :sync_tab_key_from_display_name
  before_destroy :prevent_system_deletion

  # Scopes
  scope :enabled, -> { where(enabled: true) }
  scope :system_folders, -> { where(is_system: true) }
  scope :custom_folders, -> { where(is_system: false) }
  scope :ordered, -> { order(:order_position, :name) }
  scope :root_folders, -> { where(parent_id: nil) }
  scope :for_warehouse_type, ->(code) {
    joins(:warehouse_type).where(warehouse_types: { code: code.to_s.downcase })
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
  # @return [Array<BaseFolder>] Array of ancestor folders
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
  # SSoT: Document Type Methods (replaces warehouse_folder methods)
  # ════════════════════════════════════════════════════════════════════════════════

  # Set document types by IDs
  def document_type_ids=(ids)
    ids = Array(ids).map(&:to_i).reject(&:zero?)
    existing_ids = base_folder_document_types.pluck(:document_type_id)

    # Remove old assignments (only secondary ones)
    base_folder_document_types
      .where.not(document_type_id: ids)
      .where(is_primary: false)
      .destroy_all

    # Add new assignments as secondary
    (ids - existing_ids).each do |doc_type_id|
      base_folder_document_types.create(document_type_id: doc_type_id, is_primary: false)
    end
  end

  # Get document type IDs
  def document_type_ids
    base_folder_document_types.pluck(:document_type_id)
  end

  # Get all document types with their effective templates
  # @return [Array<Hash>] Document types with template info
  def document_types_with_templates
    base_folder_document_types.includes(:document_type).map do |join|
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
  # SSoT: UI Methods (replaces warehouse_folder methods)
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
  def dynamic_type
    return nil if folder_segment.blank?

    DYNAMIC_TOKENS.each do |token, type|
      return type if folder_segment.include?(token)
    end
    nil
  end

  # Check if this folder can be deleted
  def can_delete?
    return false if is_system || is_system_tab
    return false if children.exists?
    return false if base_folder_document_types.exists?

    true
  end

  # Get the reason why deletion is blocked
  def deletion_blocked_reason
    return nil if can_delete?
    return "System folders cannot be deleted" if is_system || is_system_tab

    reasons = []
    reasons << "#{children.count} sub-folders" if children.exists?
    reasons << "#{base_folder_document_types.count} linked document types" if base_folder_document_types.exists?

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
  # SSoT: Class Methods (replaces warehouse_folder class methods)
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

  # Get base folders for UI dropdown (grouped by warehouse type)
  def self.grouped_options_for_select
    enabled.ordered.includes(:warehouse_type).group_by { |bf| bf.warehouse_type&.display_name }.transform_values do |folders|
      folders.map { |bf| { value: bf.id, label: bf.display_name || bf.name } }
    end
  end

  # ════════════════════════════════════════════════════════════════════════════════
  # SSoT: Methods for WarehouseProvider integration
  # These replace WarehouseFolder class methods (Feb 2026)
  # ════════════════════════════════════════════════════════════════════════════════

  # Get the base folder for a warehouse type (root folder)
  # @param type_key [String] The warehouse type code (e.g., "job", "contact")
  # @return [BaseFolder, nil] The root folder for the warehouse type
  def self.base_folder_for(type_key)
    for_warehouse_type(type_key).root_folders.first
  end

  # Get mapping of warehouse type codes to base folder names
  # @return [Hash] { "job" => "Jobs", "contact" => "Contacts", ... }
  def self.warehouse_type_to_base_folder
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

  # Get mapping of warehouse types to full folder path templates
  # @return [Hash] { "job" => "Job/{{JobCode}}/{{JobName}}", ... }
  def self.warehouse_folders_mapping
    result = {}
    root_folders.includes(:warehouse_type).each do |folder|
      next unless folder.warehouse_type
      result[folder.warehouse_type.code] = folder.full_folder_path
    end
    result
  end

  # Alias for backwards compatibility
  def self.folder_templates_mapping
    warehouse_folders_mapping
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
      is_system_tab: is_system_tab,
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
      document_types_count: base_folder_document_types.count,
      created_at: created_at,
      updated_at: updated_at
    }
  end

  # Convert to nested JSON for API (includes children and document types)
  def as_nested_json
    {
      id: id,
      warehouse_type: warehouse_type_code,
      tab_key: tab_key,
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
      is_system_tab: is_system_tab,
      is_system: is_system,
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

  def prevent_system_deletion
    if is_system || is_system_tab
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
