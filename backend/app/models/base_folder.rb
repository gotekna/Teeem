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
class BaseFolder < ApplicationRecord
  # Associations
  belongs_to :warehouse_type
  has_many :warehouse_folders, dependent: :nullify

  # Validations
  validates :name, presence: true
  validates :name, uniqueness: { scope: :warehouse_type_id, message: "already exists for this warehouse type" }

  # Scopes
  scope :enabled, -> { where(enabled: true) }
  scope :system_folders, -> { where(is_system: true) }
  scope :custom_folders, -> { where(is_system: false) }
  scope :ordered, -> { order(:order_position, :name) }
  scope :for_warehouse_type, ->(code) {
    joins(:warehouse_type).where(warehouse_types: { code: code.to_s.downcase })
  }

  # Callbacks
  before_destroy :prevent_system_deletion

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

  # Check if this folder can be deleted
  def can_delete?
    return false if is_system
    return false if warehouse_folders.exists?

    true
  end

  # Get the full display path preview
  # Replaces template tokens with example values
  def path_preview
    return name if folder_path_template.blank?

    preview = folder_path_template.dup
    preview.gsub!("{{JobCode}}", "J-001")
    preview.gsub!("{{ContactName}}", "John Smith")
    preview.gsub!("{{CompanyCode}}", "ABC")
    preview.gsub!("{{CompanyGroup}}", "ABC Group")
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
      download_name_template: download_name_template,
      ui_name_template: ui_name_template,
      path_preview: path_preview,
      is_system: is_system,
      enabled: enabled,
      order_position: order_position,
      warehouse_folders_count: warehouse_folders.count,
      can_delete: can_delete?,
      created_at: created_at,
      updated_at: updated_at
    }
  end

  private

  def prevent_system_deletion
    if is_system
      errors.add(:base, "System base folders cannot be deleted")
      throw(:abort)
    end
  end
end
