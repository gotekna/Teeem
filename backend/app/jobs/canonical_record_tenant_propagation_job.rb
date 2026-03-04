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

    if local.nil?
      # FRC: Record doesn't exist in target tenant yet — CREATE it.
      # This was the architectural gap: propagation only updated, never created.
      # New tasks created in any bidirectional tenant now appear in all others.
      create_from_canonical(canonical, tenant_id)
      return
    end

    # Only update fields NOT in field_overrides
    overrides = local.field_overrides || []
    fields_to_update = changed_fields - overrides
    return if fields_to_update.empty?

    attrs = CanonicalTaskResolver.resolve(canonical, tenant_id, only: fields_to_update)
    attrs[:canonical_version] = canonical.version

    # Use assign_attributes + save! to run validations but skip canonical callbacks
    # (saved_change_to_canonical_version? guard in model prevents re-propagation)
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
      "[CanonicalSync] Error propagating canonical #{canonical.id} to tenant #{tenant_id}: #{e.message}"
    )
    raise # Re-raise so SolidQueue retries
  end

  # Create a new local record from a canonical record in the target tenant.
  # Resolves all FK fields (sync_keys → tenant-local IDs) via CanonicalTaskResolver.
  def create_from_canonical(canonical, tenant_id)
    model = canonical.record_type.constantize

    # Resolve all fields for the target tenant (simple + FK)
    attrs = CanonicalTaskResolver.resolve(canonical, tenant_id)
    attrs[:canonical_record_id] = canonical.id
    attrs[:canonical_version] = canonical.version

    record = model.new(attrs)

    if record.save
      Rails.logger.info(
        "[CanonicalSync] Created #{canonical.record_type} '#{canonical.name}' " \
        "for tenant #{tenant_id} from canonical #{canonical.id}"
      )
    else
      Rails.logger.warn(
        "[CanonicalSync] Failed to create #{canonical.record_type} '#{canonical.name}' " \
        "for tenant #{tenant_id}: #{record.errors.full_messages.join(', ')}"
      )
    end
  rescue => e
    Rails.logger.error(
      "[CanonicalSync] Error creating from canonical #{canonical.id} for tenant #{tenant_id}: #{e.message}"
    )
  end
end
