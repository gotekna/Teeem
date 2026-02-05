# frozen_string_literal: true

# BaseFolder - SSoT for base folder configuration per warehouse type
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Database-Driven Base Folders (Feb 2026)                    ║
# ║                                                                   ║
# ║  Each WarehouseType has one or more BaseFolders                   ║
# ║  e.g., "job" type has "Jobs" base folder                          ║
# ║                                                                   ║
# ║  Stores folder path templates, download name templates, etc.      ║
# ║  System folders (is_system: true) are protected from deletion     ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   BaseFolder.for_warehouse_type("job").first.name  # => "Jobs"
#   base_folder.folder_path_template                 # => "Jobs/{{JobCode}}"
#
# Dynamic Tokens:
#   Some base folders use dynamic tokens that expand at runtime:
#   - {{Mailbox}} - Expands to show all active synced mailboxes
#
#   Dynamic base folders don't represent real folders - they generate
#   virtual folder structure from database data.
#
class BaseFolder < ApplicationRecord
  # Dynamic tokens that generate virtual folder structure from database
  # When folder_path_template contains one of these, the folder is "dynamic"
  # and its contents are generated at runtime instead of being stored
  DYNAMIC_TOKENS = {
    '{{Mailbox}}' => :mailbox  # Generates folders from SyncedEmail.mailbox_owner_email
  }.freeze
  # Associations
  belongs_to :warehouse_type
  belongs_to :parent, class_name: 'BaseFolder', optional: true
  has_many :children, class_name: 'BaseFolder', foreign_key: :parent_id, dependent: :destroy
  has_many :warehouse_folders, dependent: :nullify

  # Validations
  validates :name, presence: true
  validates :name, uniqueness: { scope: :warehouse_type_id, message: "already exists for this warehouse type" }
  validate :parent_not_self
  validate :parent_same_warehouse_type
  validate :no_circular_reference

  # Scopes
  scope :enabled, -> { where(enabled: true) }
  scope :system_folders, -> { where(is_system: true) }
  scope :custom_folders, -> { where(is_system: false) }
  scope :ordered, -> { order(:order_position, :name) }
  scope :for_warehouse_type, ->(code) {
    joins(:warehouse_type).where(warehouse_types: { code: code.to_s.downcase })
  }

  # Callbacks
  before_save :compute_full_path_template
  before_destroy :prevent_system_deletion
  after_save :update_children_paths, if: :saved_change_to_folder_path_template?

  # Delegation
  delegate :code, to: :warehouse_type, prefix: true, allow_nil: true

  # Class methods

  # Find by warehouse type code and name
  # @param type_code [String] The warehouse type code (e.g., "job")
  # @param name [String] The folder name (e.g., "Jobs")
  # @return [BaseFolder, nil]
  def self.find_by_type_and_name(type_code, name)
    for_warehouse_type(type_code).find_by(name: name)
  end

  # Get base folders for UI dropdown (grouped by warehouse type)
  # @return [Hash<String, Array<Hash>>] Grouped options
  def self.grouped_options_for_select
    enabled.ordered.includes(:warehouse_type).group_by { |bf| bf.warehouse_type&.display_name }.transform_values do |folders|
      folders.map { |bf| { value: bf.id, label: bf.name } }
    end
  end

  # Instance methods

  # Check if this is a dynamic folder (contains dynamic tokens like {{Mailbox}})
  # Dynamic folders generate their structure from database data at runtime
  # @return [Boolean]
  def dynamic?
    return false if folder_path_template.blank?

    DYNAMIC_TOKENS.keys.any? { |token| folder_path_template.include?(token) }
  end

  # Get the type of dynamic content this folder generates
  # @return [Symbol, nil] :mailbox for {{Mailbox}}, nil if not dynamic
  def dynamic_type
    return nil if folder_path_template.blank?

    DYNAMIC_TOKENS.each do |token, type|
      return type if folder_path_template.include?(token)
    end
    nil
  end

  # Check if this folder can be deleted
  def can_delete?
    return false if is_system
    return false if warehouse_folders.exists?

    true
  end

  # Build full path by walking up parent hierarchy
  # e.g., Statement → Balance Sheet → Xero = "Xero/Balance Sheet/Statement"
  def full_ancestor_path
    path_parts = []
    current = self

    while current.present?
      path_parts.unshift(current.name)
      current = current.parent
    end

    path_parts.join('/')
  end

  # Full path template including warehouse type prefix and ancestor hierarchy
  # e.g., "Corporate/{{CompanyGroup}}/{{CompanyCode}}/Xero/Balance Sheet/Statement"
  def full_path_template
    wt_template = warehouse_type&.folder_path_template.presence
    ancestor_path = full_ancestor_path

    if wt_template.blank?
      ancestor_path
    else
      # FRC (Feb 2026): Compare first FOLDER exactly, not string prefix
      # "Assets".start_with?("Asset") was returning true incorrectly
      scope_root = wt_template.split('/').first
      first_folder = ancestor_path.split('/').first
      if first_folder == scope_root
        ancestor_path
      else
        "#{wt_template}/#{ancestor_path}"
      end
    end
  end

  # Get the full display path preview
  # Replaces template tokens with example values
  # SSoT: Uses full_path_template to include ancestor hierarchy
  def path_preview
    # FRC (Feb 2026): Use full_path_template to include ancestor hierarchy
    # Was using folder_path_template which doesn't include parent folders
    # e.g., "Expenses" under "Assets" now shows "Corporate/.../Assets/Expenses" not just "Expenses"
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
    preview
  end

  # JSON serialization for API
  def as_json(options = {})
    {
      id: id,
      warehouse_type_id: warehouse_type_id,
      warehouse_type_code: warehouse_type_code,
      warehouse_type_name: warehouse_type&.display_name,
      name: name,
      folder_path_template: folder_path_template,
      path_preview: path_preview,
      is_system: is_system,
      enabled: enabled,
      order_position: order_position,
      warehouse_folders_count: warehouse_folders.count,
      can_delete: can_delete?,
      is_dynamic: dynamic?,
      dynamic_type: dynamic_type,
      created_at: created_at,
      updated_at: updated_at
    }
  end

  private

  # SSoT (Feb 2026): Compute and store full path in folder_path_template
  # This eliminates runtime computation - the stored value IS the full path
  # e.g., "Corporate/{{CompanyGroup}}/{{CompanyCode}}/Xero/Bills & POs"
  def compute_full_path_template
    wt_template = warehouse_type&.folder_path_template.presence
    ancestor_path = full_ancestor_path

    self.folder_path_template = if wt_template.blank?
      ancestor_path
    else
      # FRC: Compare first FOLDER exactly, not string prefix
      scope_root = wt_template.split('/').first
      first_folder = ancestor_path.split('/').first
      if first_folder == scope_root
        ancestor_path
      else
        "#{wt_template}/#{ancestor_path}"
      end
    end
  end

  # Cascade path changes to children when parent path changes
  def update_children_paths
    children.find_each(&:save)  # Triggers compute_full_path_template on each child
  end

  def prevent_system_deletion
    if is_system
      errors.add(:base, "System base folders cannot be deleted")
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

    # Walk up the parent chain to detect cycles
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
