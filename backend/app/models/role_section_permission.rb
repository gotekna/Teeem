# frozen_string_literal: true

# SSoT: What each role can do - links roles to permission sections with a level
# Level: 0=none, 1=view_own, 2=view_all, 3=edit, 4=full
class RoleSectionPermission < ApplicationRecord
  belongs_to :role

  validates :permission_key, presence: true
  validates :level, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 4 }
  validates :permission_key, uniqueness: { scope: :role_id }

  # Validate level is available for this permission section
  validate :level_must_be_available

  scope :for_key, ->(key) { where(permission_key: key) }
  scope :with_access, -> { where("level > 0") }

  private

  def level_must_be_available
    return if level.nil? || permission_key.blank?

    section = PermissionSection.find_by(key: permission_key)
    return unless section

    unless section.available_levels.include?(level)
      errors.add(:level, "#{level} is not available for permission '#{permission_key}'")
    end
  end
end
