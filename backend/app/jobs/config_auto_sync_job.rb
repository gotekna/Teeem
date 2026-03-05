# frozen_string_literal: true

# ConfigAutoSyncJob - Nightly auto-sync for tables set to "two_way" mode
#
# True two-way sync:
#   1. Pull: master → tenant (new/updated records flow down)
#   2. Push: tenant → master (tenant-only records flow up to TEEEM)
#
# This ensures tenants with two-way sync stay in lockstep with TEEEM master
# in both directions — no local-only records remain unsynced.
#
# Run via solid_queue recurring schedule (3am Brisbane time daily)
class ConfigAutoSyncJob < ApplicationJob
  include DeduplicatableJob

  queue_as :low

  def perform
    master = Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
    unless master
      Rails.logger.warn "[ConfigAutoSync] No master tenant found — skipping"
      return
    end

    tenants = Tenant.where(is_master_tenant: false).to_a
    Rails.logger.info "[ConfigAutoSync] Starting nightly auto-sync for #{tenants.length} tenants"

    total_results = { tenants_synced: 0, tables_synced: 0, pulled: 0, pushed: 0, skipped: 0, errors: [] }

    tenants.each do |tenant|
      begin
        sync_tenant(tenant, master, total_results)
      rescue => e
        Rails.logger.error "[ConfigAutoSync] Error syncing tenant #{tenant.name} (#{tenant.id}): #{e.message}"
        total_results[:errors] << "#{tenant.name}: #{e.message}"
      end
    end

    Rails.logger.info "[ConfigAutoSync] Complete. " \
      "Tenants: #{total_results[:tenants_synced]}, " \
      "Tables: #{total_results[:tables_synced]}, " \
      "Pulled (master→tenant): #{total_results[:pulled]}, " \
      "Pushed (tenant→master): #{total_results[:pushed]}, " \
      "Skipped: #{total_results[:skipped]}, " \
      "Errors: #{total_results[:errors].length}"

    total_results
  end

  private

  def sync_tenant(tenant, master, total_results)
    modes = tenant.tenant_setting&.config_sync_table_modes || {}
    two_way_tables = modes.select { |_table, mode| mode == "two_way" }.keys

    return if two_way_tables.empty?

    Rails.logger.info "[ConfigAutoSync] Tenant #{tenant.name}: #{two_way_tables.length} two-way tables (#{two_way_tables.join(', ')})"

    service = TenantConfigSyncService.new(tenant)
    tenant_synced = false

    # Sync tables in dependency order (parents before children)
    ordered_tables = dependency_ordered(two_way_tables)

    ordered_tables.each do |table_key|
      begin
        table_sym = table_key.to_sym
        config = TenantConfigSyncService::CONFIG_TABLES[table_sym]
        next unless config

        model = config[:model].constantize

        # Skip tables using global records — they share data via tenant_id=NULL
        if model.respond_to?(:uses_global_records?) && model.uses_global_records?
          next
        end

        pulled = 0
        pushed = 0
        skipped = 0

        # ── Direction 1: Pull master → tenant ──
        master_ids = ActsAsTenant.with_tenant(master) do
          if config[:scope]
            model.instance_exec(&config[:scope]).pluck(:id)
          else
            model.all.pluck(:id)
          end
        end

        if master_ids.any?
          result = service.pull_from_master(
            table: table_key.to_s,
            record_ids: master_ids,
            mode: :replace_existing
          )
          pulled = (result[:imported]&.length || 0) + (result[:updated]&.length || 0)
          skipped += result[:skipped]&.length || 0
        end

        # ── Direction 2: Push tenant-only records → TEEEM (SSoT method) ──
        push_result = service.push_local_only_to_master(table: table_key.to_s)
        pushed = push_result[:pushed] || 0
        skipped += push_result[:skipped] || 0

        total_results[:tables_synced] += 1
        total_results[:pulled] += pulled
        total_results[:pushed] += pushed
        total_results[:skipped] += skipped
        tenant_synced = true

        if pulled > 0 || pushed > 0
          Rails.logger.info "[ConfigAutoSync] #{tenant.name}/#{table_key}: pulled=#{pulled}, pushed=#{pushed}, skipped=#{skipped}"
        end

        # Record per-table sync timestamp
        record_table_sync(tenant, table_key, pulled: pulled, pushed: pushed, skipped: skipped)
      rescue => e
        Rails.logger.error "[ConfigAutoSync] #{tenant.name}/#{table_key}: #{e.message}"
        total_results[:errors] << "#{tenant.name}/#{table_key}: #{e.message}"
      end
    end

    if tenant_synced
      total_results[:tenants_synced] += 1

      # Update last sync timestamp
      if tenant.tenant_setting
        tenant.tenant_setting.update_columns(
          last_config_sync_at: Time.current,
          last_config_sync_by: "auto-sync"
        )
      end
    end
  end

  # Order tables so dependencies are synced before dependents
  # e.g. job_types before job_type_statuses, sm_trades before sm_schedule_masters
  def dependency_ordered(table_keys)
    deps = TenantConfigSyncService.table_dependencies
    ordered = []
    remaining = table_keys.map(&:to_s)

    # Simple topological sort: add tables whose dependencies are already satisfied
    max_iterations = remaining.length * 2
    iterations = 0
    while remaining.any? && iterations < max_iterations
      iterations += 1
      added_this_round = false

      remaining.dup.each do |table|
        table_deps = (deps[table] || []).map(&:to_s)
        # Only wait for deps that are also in our sync list
        unmet = table_deps & remaining - ordered
        if unmet.empty?
          ordered << table
          remaining.delete(table)
          added_this_round = true
        end
      end

      # If no progress, add remaining (circular deps or external deps)
      unless added_this_round
        ordered.concat(remaining)
        remaining.clear
      end
    end

    ordered
  end

  def record_table_sync(tenant, table_key, pulled:, pushed:, skipped:)
    return unless tenant.tenant_setting

    timestamps = (tenant.tenant_setting.config_sync_table_timestamps || {}).dup
    timestamps[table_key.to_s] = {
      "synced_at" => Time.current.iso8601,
      "synced_by" => "auto-sync",
      "pulled" => pulled,
      "pushed" => pushed,
      "skipped" => skipped
    }
    tenant.tenant_setting.update_columns(config_sync_table_timestamps: timestamps)
  end
end
