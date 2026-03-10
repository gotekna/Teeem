# frozen_string_literal: true

# SSoT: Authorization concern for section-level permission enforcement
# Uses the role_section_permissions table (DB-driven, not hardcoded)
#
# Usage in controllers:
#   before_action -> { require_permission("jobs", :view_all) }, only: [:index, :show]
#   before_action -> { require_permission("jobs", :edit) }, only: [:create, :update]
#   before_action -> { require_permission("jobs", :full) }, only: [:destroy]
module Permissible
  extend ActiveSupport::Concern

  LEVEL_MAP = {
    no_access: 0,
    none: 0,
    view_own: 1,
    view_all: 2,
    view: 2,
    edit: 3,
    full: 4
  }.freeze

  # Check if current user has at least the required level for a permission key
  # Admin role bypasses all checks
  def require_permission(permission_key, required_level)
    return if current_user&.admin?

    level_int = LEVEL_MAP[required_level.to_sym] || required_level.to_i
    effective = effective_permission_level(permission_key)

    return if effective >= level_int

    render json: {
      success: false,
      error: "You don't have permission to perform this action",
      required_permission: permission_key,
      required_level: required_level.to_s
    }, status: :forbidden
  end

  # Get the effective permission level for current user on a given key
  # Multi-role: highest level across all user's roles wins
  def effective_permission_level(permission_key)
    return 4 if current_user&.admin?
    return 0 unless current_user

    @_permission_cache ||= {}
    return @_permission_cache[permission_key] if @_permission_cache.key?(permission_key)

    role_ids = current_user.roles.pluck(:id)
    return 0 if role_ids.empty?

    max_level = RoleSectionPermission
      .where(role_id: role_ids, permission_key: permission_key)
      .maximum(:level) || 0

    @_permission_cache[permission_key] = max_level
  end

  # Check permission without rendering error (returns boolean)
  def has_permission?(permission_key, required_level)
    return true if current_user&.admin?

    level_int = LEVEL_MAP[required_level.to_sym] || required_level.to_i
    effective_permission_level(permission_key) >= level_int
  end
end
