# frozen_string_literal: true

# WarehouseType - SSoT for warehouse type definitions
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Database-Driven Warehouse Types (Feb 2026)                 ║
# ║                                                                   ║
# ║  Replaces hardcoded WAREHOUSE_TYPES constant with database table  ║
# ║  Allows users to create/edit warehouse types via UI               ║
# ║                                                                   ║
# ║  System types (is_system: true) are protected from deletion       ║
# ║  Custom types can be added via UI settings                        ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   WarehouseType.enabled.ordered.pluck(:code)  # => ["job", "contact", "email", ...]
#   WarehouseType.find_by_code("job")           # => WarehouseType instance
#   WarehouseType.codes                         # => Array of all enabled codes
#
class WarehouseType < ApplicationRecord
  # Associations
  has_many :base_folders, dependent: :destroy
  has_many :warehouse_folders, through: :base_folders
  has_many :document_types, dependent: :nullify

  # Validations
  validates :code, presence: true, uniqueness: { case_sensitive: false }
  validates :code, format: { with: /\A[a-z][a-z0-9_]*\z/, message: "must be lowercase letters, numbers, and underscores only, starting with a letter" }
  validates :display_name, presence: true

  # Scopes
  scope :enabled, -> { where(enabled: true) }
  scope :system_types, -> { where(is_system: true) }
  scope :custom_types, -> { where(is_system: false) }
  scope :ordered, -> { order(:order_position, :display_name) }

  # Callbacks
  before_validation :normalize_code
  before_destroy :prevent_system_deletion

  # Class methods

  # Find by code (case-insensitive)
  # @param code [String] The warehouse type code (e.g., "job", "contact")
  # @return [WarehouseType, nil]
  def self.find_by_code(code)
    find_by("LOWER(code) = ?", code.to_s.downcase)
  end

  # Get all enabled codes (replacement for WAREHOUSE_TYPES constant)
  # @return [Array<String>]
  def self.codes
    enabled.ordered.pluck(:code)
  end

  # Check if a code is valid
  # @param code [String]
  # @return [Boolean]
  def self.valid_code?(code)
    enabled.where("LOWER(code) = ?", code.to_s.downcase).exists?
  end

  # Get codes for UI dropdown
  # @return [Array<Hash>] Array of {value:, label:} hashes
  def self.options_for_select
    enabled.ordered.map do |wt|
      { value: wt.code, label: wt.display_name }
    end
  end

  # Instance methods

  # Check if this type can be deleted
  # System types and types with folders cannot be deleted
  def can_delete?
    return false if is_system
    return false if base_folders.exists?
    return false if document_types.exists?

    true
  end

  # JSON serialization for API
  def as_json(options = {})
    {
      id: id,
      code: code,
      display_name: display_name,
      description: description,
      icon_name: icon_name,
      is_system: is_system,
      enabled: enabled,
      order_position: order_position,
      base_folders_count: base_folders.count,
      can_delete: can_delete?,
      created_at: created_at,
      updated_at: updated_at
    }
  end

  private

  def normalize_code
    self.code = code.to_s.downcase.strip if code.present?
  end

  def prevent_system_deletion
    if is_system
      errors.add(:base, "System warehouse types cannot be deleted")
      throw(:abort)
    end
  end
end
