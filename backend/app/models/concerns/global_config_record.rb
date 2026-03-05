# frozen_string_literal: true

# Concern for config records that can be shared globally across all tenants.
#
# Include this in any model that uses `acts_as_tenant :tenant, has_global_records: true`.
# Records with tenant_id = NULL are "global" (shared) and visible to all tenants.
# Only the master TEEEM tenant can create, edit, or delete global records.
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
    belongs_to :tenant, optional: true

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
    # Master tenant can do anything
    return if ActsAsTenant.current_tenant.respond_to?(:is_master_tenant?) && ActsAsTenant.current_tenant.is_master_tenant?

    raise ActiveRecord::ReadOnlyRecord, "Cannot modify shared config record"
  end

  def prevent_non_master_destroy_of_global_record
    return unless tenant_id.nil?
    return if ActsAsTenant.current_tenant.nil?
    return if ActsAsTenant.current_tenant.respond_to?(:is_master_tenant?) && ActsAsTenant.current_tenant.is_master_tenant?

    raise ActiveRecord::ReadOnlyRecord, "Cannot delete shared config record"
  end
end
