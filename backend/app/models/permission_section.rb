# frozen_string_literal: true

# SSoT: Catalog of all configurable permission sections
# Each row represents a permission that can be assigned to roles
# via RoleSectionPermission with a level (0-4)
class PermissionSection < ApplicationRecord
  # Validations
  validates :key, presence: true, uniqueness: true
  validates :section, presence: true
  validates :display_name, presence: true
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Scopes
  scope :ordered, -> { order(:section, :position) }
  scope :section_headers, -> { where(is_section_header: true) }
  scope :sub_features, -> { where(is_section_header: false) }

  # Permission levels
  LEVELS = {
    0 => "no_access",
    1 => "view_own",
    2 => "view_all",
    3 => "edit",
    4 => "full"
  }.freeze

  LEVEL_LABELS = {
    0 => "No Access",
    1 => "View Own",
    2 => "View All",
    3 => "Edit",
    4 => "Full"
  }.freeze

  def level_available?(level)
    available_levels.include?(level)
  end

  # Group all sections with their sub-features for UI display
  def self.grouped
    ordered.group_by(&:section).transform_values do |items|
      {
        header: items.find(&:is_section_header),
        sub_features: items.reject(&:is_section_header)
      }
    end
  end
end
