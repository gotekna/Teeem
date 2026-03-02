# frozen_string_literal: true

# CanonicalRecordTenantPropagationJob - Propagates canonical changes to a single tenant
#
# Respects field_overrides: if a tenant has overridden a field locally, that field
# is NOT updated during propagation.
#
# Uses limits_concurrency to prevent race conditions when multiple canonical records
# update the same tenant simultaneously.
#
class CanonicalRecordTenantPropagationJob < ApplicationJob
  queue_as :default

  limits_concurrency to: 1, key: ->(canonical_record_id, tenant_id, *) {
    "canonical_propagate_#{canonical_record_id}_#{tenant_id}"
  }

  def perform(canonical_record_id, tenant_id, changed_fields)
    canonical = SmCanonicalRecord.find_by(id: canonical_record_id)
    return unless canonical

    tenant = Tenant.find_by(id: tenant_id)
    return unless tenant

    ActsAsTenant.with_tenant(tenant) do
      propagate_to_tenant(canonical, tenant_id, changed_fields)
    end
  end

  private

  def propagate_to_tenant(canonical, tenant_id, changed_fields)
    model = canonical.record_type.constantize
    local = model.find_by(canonical_record_id: canonical.id)
    return unless local

    # Only update fields NOT in field_overrides
    overrides = local.field_overrides || []
    fields_to_update = changed_fields - overrides
    return if fields_to_update.empty?

    attrs = CanonicalTaskResolver.resolve(canonical, tenant_id, only: fields_to_update)
    attrs[:canonical_version] = canonical.version

    # Use update_columns to skip callbacks (avoid re-triggering canonical sync)
    # But validate the data first
    local.assign_attributes(attrs)
    if local.valid?
      local.save!(validate: false)
    else
      Rails.logger.warn(
        "[CanonicalSync] Failed to propagate canonical #{canonical.id} (#{canonical.record_type}) " \
        "to tenant #{tenant_id}: #{local.errors.full_messages.join(', ')}"
      )
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[CanonicalSync] Record not found during propagation: #{e.message}")
  rescue => e
    Rails.logger.error(
      "[CanonicalSync] Error propagating canonical #{canonical_record_id} to tenant #{tenant_id}: #{e.message}"
    )
    raise # Re-raise so SolidQueue retries
  end
end
