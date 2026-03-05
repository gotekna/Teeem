# frozen_string_literal: true

# Concern for config records that can be shared globally across all tenants.
#
# Include this in any model that uses `acts_as_tenant :tenant, has_global_records: true`.
# Records with tenant_id = NULL are "global" (shared) and visible to all tenants.
# Internal tenants (TEEEM, Tekna, Pilgrim) can edit/delete global records.
# External (customer) tenants are blocked from modifying shared records.
#
# IMPORTANT: Must be included AFTER acts_as_tenant declaration so it can
# override the belongs_to :tenant to be optional.
#
# Usage:
#   class SmTrade < ApplicationRecord
#     acts_as_tenant :tenant, has_global_records: true
#     include GlobalConfigRecord
#   end
module GlobalConfigRecord
  extend ActiveSupport::Concern

  included do
    # Override belongs_to :tenant (from acts_as_tenant) to allow NULL tenant_id
    # for global/shared records. This MUST come after acts_as_tenant declaration.
    #
    # ⚠️ DO NOT SIMPLIFY - Rails belongs_to validator persistence (Mar 2026)
    # ════════════════════════════════════════════════════════════════
    # Why: acts_as_tenant declares `belongs_to :tenant` (required by default in Rails 8),
    #      which registers a PresenceValidator. Re-declaring with `optional: true` updates
    #      the association but does NOT remove the already-registered validator.
    # ❌ WRONG: Just `belongs_to :tenant, optional: true` — old validator persists
    # ❌ WRONG: `_validate_callbacks.each { delete }` — unreliable in production
    # ✅ CORRECT: Re-declare as optional + after_validation safety net
    # ════════════════════════════════════════════════════════════════
    belongs_to :tenant, optional: true

    after_validation :clear_stale_tenant_errors
    before_create :auto_globalize_master_record
    before_save :prevent_non_master_edit_of_global_record
    before_destroy :prevent_non_master_destroy_of_global_record
  end

  # Is this a shared/global record visible to all tenants?
  def shared_record?
    tenant_id.nil?
  end

  class_methods do
    # Check if this model uses global (shared) config records
    def uses_global_records?
      true
    end
  end

  private

  # Clear stale PresenceValidator errors on :tenant for shared records.
  # acts_as_tenant's belongs_to validator persists even after re-declaring
  # with optional: true. This safely removes those errors for records
  # that are intentionally global (tenant_id = NULL).
  def clear_stale_tenant_errors
    errors.delete(:tenant) if tenant_id.nil?
  end

  # When master tenant creates a config record, auto-set tenant_id=NULL
  # so it's immediately shared globally. Customer tenants keep normal tenant_id.
  def auto_globalize_master_record
    return if ActsAsTenant.current_tenant.nil?
    return unless ActsAsTenant.current_tenant.respond_to?(:is_master_tenant?) && ActsAsTenant.current_tenant.is_master_tenant?

    self.tenant_id = nil
  end

  def prevent_non_master_edit_of_global_record
    # Only protect existing global records (tenant_id was already NULL)
    return unless tenant_id.nil? && tenant_id_was.nil?
    # Allow unscoped context (migrations, console, background jobs without tenant)
    return if ActsAsTenant.current_tenant.nil?
    # Internal tenants (TEEEM, Tekna, Pilgrim) can edit shared records
    return if ActsAsTenant.current_tenant.respond_to?(:internal_tenant?) && ActsAsTenant.current_tenant.internal_tenant?

    raise ActiveRecord::ReadOnlyRecord, "Cannot modify shared config record"
  end

  def prevent_non_master_destroy_of_global_record
    return unless tenant_id.nil?
    return if ActsAsTenant.current_tenant.nil?
    # Internal tenants (TEEEM, Tekna, Pilgrim) can delete shared records
    return if ActsAsTenant.current_tenant.respond_to?(:internal_tenant?) && ActsAsTenant.current_tenant.internal_tenant?

    raise ActiveRecord::ReadOnlyRecord, "Cannot delete shared config record"
  end
end
