# frozen_string_literal: true

# WarehouseType - SSoT for warehouse type definitions (tenant-scoped)
#
# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║  SSoT: Database-Driven Warehouse Types (Feb 2026)                              ║
# ║                                                                                ║
# ║  Replaces hardcoded WAREHOUSE_TYPES constant with database table               ║
# ║  Each tenant has their own warehouse types via acts_as_tenant                  ║
# ║                                                                                ║
# ║  System types (is_system: true) are protected from deletion                    ║
# ║  Custom types can be added via UI settings                                     ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝
#
# Usage:
#   WarehouseType.enabled.ordered.pluck(:code)  # => ["job", "contact", "email", ...]
#   WarehouseType.find_by_code("job")           # => WarehouseType instance
#   WarehouseType.codes                         # => Array of all enabled codes
#
class WarehouseType < ApplicationRecord
  # Multi-tenancy - optional to allow global templates
  acts_as_tenant :tenant, optional: true
  include ConfigSyncable
  self.sync_key_source = :code

  # Constants
  UNASSIGNED_CODE = "unassigned".freeze

  # Associations
  has_many :warehouse_folders, dependent: :destroy
  has_many :document_types, dependent: :nullify

  # Validations
  validates :code, presence: true
  validates :code, uniqueness: { scope: :tenant_id, case_sensitive: false }
  validates :code, format: { with: /\A[a-z][a-z0-9_]*\z/, message: "must be lowercase letters, numbers, and underscores only, starting with a letter" }
  validates :display_name, presence: true
  validate :validate_source_model
  validate :validate_records_config_completeness

  # Scopes
  scope :enabled, -> { where(enabled: true).where.not(code: UNASSIGNED_CODE) }
  scope :visible, -> { where.not(code: UNASSIGNED_CODE) }
  scope :system_types, -> { where(is_system: true).where.not(code: UNASSIGNED_CODE) }
  scope :custom_types, -> { where(is_system: false) }
  scope :ordered, -> { order(:order_position, :display_name) }

  # Callbacks
  before_validation :normalize_code
  before_validation :normalize_folder_path_template
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

  # Get the unassigned warehouse type (used for orphaned base folders)
  # @return [WarehouseType]
  def self.unassigned
    find_by!(code: UNASSIGNED_CODE)
  end

  # Get IDs for UI dropdown (base folders use warehouse_type_id FK)
  # @return [Array<Hash>] Array of {value:, label:, code:, base_path:} hashes
  def self.options_for_select
    enabled.ordered.map do |wt|
      # Build base_path: display_name is the root folder, then folder_path_template adds tokens
      # e.g., display_name="Compliance" + template="" → "Compliance"
      # e.g., display_name="Job" + template="{{JobCode}}/{{JobName}}" → "Job/{{JobCode}}/{{JobName}}"
      base_path = if wt.folder_path_template.present?
        "#{wt.display_name}/#{wt.folder_path_template}"
      else
        wt.display_name
      end

      { value: wt.id, label: wt.display_name, code: wt.code, base_path: base_path }
    end
  end

  # Instance methods

  # Check if this is the unassigned type
  def unassigned?
    code == UNASSIGNED_CODE
  end

  # Check if this type can be deleted
  # System types and types with folders cannot be deleted
  def can_delete?
    return false if is_system
    return false if warehouse_folders.exists?
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
      folder_path_template: folder_path_template,
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

  def normalize_code
    self.code = code.to_s.downcase.strip if code.present?
  end

  # Fail fast: if source_model is set, it MUST resolve to a real ActiveRecord class
  def validate_source_model
    return if source_model.blank?

    klass = source_model.constantize
    unless klass < ActiveRecord::Base
      errors.add(:source_model, "#{source_model} is not an ActiveRecord model")
    end
  rescue NameError
    errors.add(:source_model, "#{source_model} is not a valid model class")
  end

  # Fail fast: if source_model is set, records_config MUST have display.name, search, and order
  def validate_records_config_completeness
    return if source_model.blank?

    config = records_config || {}
    display = config['display'] || {}
    errors.add(:records_config, "display.name is required when source_model is set") if display['name'].blank?
    errors.add(:records_config, "search is required when source_model is set") if (config['search'] || []).empty?
    errors.add(:records_config, "order is required when source_model is set") if config['order'].blank?
  end

  # Clean double slashes but don't force separators between adjacent tokens
  # Users may intentionally want {{JobCode}}{{JobName}} as a single folder segment
  def normalize_folder_path_template
    return if folder_path_template.blank?

    self.folder_path_template = folder_path_template.gsub(%r{//+}, "/")
  end

  def prevent_system_deletion
    if is_system
      errors.add(:base, "System warehouse types cannot be deleted")
      throw(:abort)
    end
  end
end
