# frozen_string_literal: true

# Runs cascade_push_table in background to avoid Heroku 30s web timeout.
# Enqueued by ConfigSyncController#cascade_push_table.
#
# Stores result in Rails.cache so the frontend can poll for completion.
# Cache key: "cascade_push:#{job_key}" — expires after 10 minutes.
class CascadePushTableJob < ApplicationJob
  queue_as :default

  def perform(table:, tenant_id:, job_key:, mode: "replace_existing")
    tenant = Tenant.find(tenant_id)
    unless tenant.is_master_tenant?
      store_result(job_key, { status: "failed", error: "Not master tenant" })
      return
    end

    table = table.to_sym
    table_config = TenantConfigSyncService::CONFIG_TABLES[table]
    unless table_config
      store_result(job_key, { status: "failed", error: "Unknown table: #{table}" })
      return
    end

    model = table_config[:model].constantize
    mode = mode.to_sym
    customer_tenants = Tenant.where(is_master_tenant: false).to_a
    has_sync_key = model.column_names.include?("sync_key")

    master_svc = TenantConfigSyncService.new(tenant)

    # ── Phase 0: Pull customer edits → TEEEM (two-way tables only) ──────
    # For two-way tables, pull customer edits back to TEEEM so name changes
    # etc. flow back. source_newer? ensures only genuinely newer edits win.
    #
    # ⚠️ ONLY pull records whose sync_key already exists in TEEEM.
    # This prevents importing customer records that were just pushed by a
    # previous sync (which would create duplicates in a feedback loop).
    # Customer-created records (with unique sync_keys) won't be pulled —
    # they stay local until manually promoted.
    if has_sync_key
      master_sync_key_set = ActsAsTenant.with_tenant(tenant) {
        scoped_model(model, table_config).where.not(sync_key: [nil, ""]).pluck(:sync_key)
      }

      customer_tenants.each do |t|
        t_mode = table_mode(table, t)
        next unless t_mode == "two_way"
        next if master_sync_key_set.empty?

        customer_record_ids = ActsAsTenant.with_tenant(t) {
          scoped_model(model, table_config).where(sync_key: master_sync_key_set).pluck(:id)
        }
        next if customer_record_ids.empty?

        master_svc.import_from_tenant(source_tenant: t, table: table.to_s, record_ids: customer_record_ids)
      end
    end

    # ── Step 1: Apply tombstones ──────────────────────────────────────────
    # Include master tenant tombstones too — records deleted in TEEEM
    # must propagate to all customers
    all_tenant_ids = [tenant.id] + customer_tenants.map(&:id)
    pending_tombstones = has_sync_key ? ConfigSyncDeletion.where(
      tenant_id: all_tenant_ids,
      model_type: table_config[:model],
      propagated_at: nil
    ).to_a : []

    if pending_tombstones.any?
      sync_keys_to_delete = pending_tombstones.map(&:sync_key).uniq

      cb_safe_destroy = lambda do |tenant_ctx, keys|
        ActsAsTenant.with_tenant(tenant_ctx) do
          model.where(sync_key: keys).find_each do |rec|
            rec.destroy
          rescue => e
            Rails.logger.warn "[ConfigSync] Tombstone destroy failed for #{model}##{rec.id}: #{e.message[0..100]}"
          end
        end
      end

      cb_safe_destroy.call(tenant, sync_keys_to_delete)
      customer_tenants.each { |t| cb_safe_destroy.call(t, sync_keys_to_delete) }
      ConfigSyncDeletion.where(id: pending_tombstones.map(&:id)).update_all(propagated_at: Time.current)
    end

    # ── Step 2 + 3: Push + orphan cleanup per customer ────────────────────
    master_record_ids = ActsAsTenant.with_tenant(tenant) { scoped_model(model, table_config).pluck(:id) }

    master_sync_keys = if has_sync_key
      ActsAsTenant.with_tenant(tenant) do
        base = table_config[:scope] ? model.instance_exec(&table_config[:scope]) : model.all
        base.where.not(sync_key: [nil, ""]).pluck(:sync_key)
      end
    else
      []
    end

    customer_tenants.each do |t|
      t_mode = table_mode(table, t)
      next if t_mode == "independent"

      svc = TenantConfigSyncService.new(t)

      unless master_record_ids.empty?
        svc.pull_from_master(table: table.to_s, record_ids: master_record_ids, mode: mode)
      end

      if master_sync_keys.any? && t_mode == "one_way"
        orphan_result = svc.delete_orphaned_from_master(table: table)
        if orphan_result[:skipped_orphans]&.any?
          promote_ids = orphan_result[:skipped_orphans].map { |o| o[:id] }.compact
          master_svc.import_from_tenant(source_tenant: t, table: table.to_s, record_ids: promote_ids) if promote_ids.any?
        end
      end
    end

    Rails.logger.info "[ConfigSync] CascadePushTableJob completed for #{table}"
    store_result(job_key, { status: "completed", table: table.to_s })
  rescue => e
    Rails.logger.error "[ConfigSync] CascadePushTableJob FAILED for #{table}: #{e.message}"
    store_result(job_key, { status: "failed", error: e.message }) if job_key
    raise
  end

  private

  def scoped_model(model, config)
    config[:scope] ? model.instance_exec(&config[:scope]) : model.all
  end

  def table_mode(table, tenant)
    modes = tenant.tenant_setting&.config_sync_table_modes || {}
    table_default_modes = TenantConfigSyncService::TABLE_DEFAULT_MODES rescue {}
    modes[table.to_s] || table_default_modes[table.to_s] || "two_way"
  end

  def store_result(job_key, result)
    return unless job_key.present?
    Rails.cache.write("cascade_push:#{job_key}", result, expires_in: 10.minutes)
  end
end
