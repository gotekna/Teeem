# frozen_string_literal: true

# CanonicalRecordPropagationJob - Fan-out job that triggers per-tenant propagation
#
# When a canonical record is updated (from any connected tenant), this job
# finds all other connected tenants and enqueues a per-tenant propagation job
# for each one.
#
class CanonicalRecordPropagationJob < ApplicationJob
  queue_as :default

  def perform(canonical_record_id, changed_fields, source_tenant_id)
    canonical = SmCanonicalRecord.find_by(id: canonical_record_id)
    return unless canonical

    target_tenant_ids = CanonicalSyncGroupMember.propagation_targets(
      exclude_tenant_id: source_tenant_id
    )

    return if target_tenant_ids.empty?

    target_tenant_ids.each do |tenant_id|
      CanonicalRecordTenantPropagationJob.perform_later(
        canonical_record_id, tenant_id, changed_fields
      )
    end

    canonical.update_column(:last_propagated_at, Time.current)
  end
end
