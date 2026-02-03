# frozen_string_literal: true

# Background job to refresh Xero sync stats cache
#
# Purpose: Pre-warm the cache before users request stats,
# so they always get fast responses (<100ms)
#
# Schedule: Every 5 minutes (matches cache TTL)
#
# Part of "Scale Xero Sync to 15k" plan (Phase 3)
class RefreshXeroStatsCacheJob < ApplicationJob
  queue_as :low

  def perform
    start_time = Time.current
    refreshed_count = 0

    # Refresh global stats (master tenant cache)
    refresh_stats_for_tenant(nil)
    refreshed_count += 1

    # Refresh stats for each tenant that has users who accessed recently
    # This is a conservative approach - only warm cache for active tenants
    active_tenant_ids = XeroCredential.joins(:teeem_tenant)
                                      .where.not(teeem_tenant_id: nil)
                                      .distinct
                                      .pluck(:teeem_tenant_id)

    active_tenant_ids.each do |tenant_id|
      refresh_stats_for_tenant(tenant_id)
      refreshed_count += 1
    end

    elapsed = (Time.current - start_time).round(2)
    Rails.logger.info("[RefreshXeroStatsCacheJob] Refreshed #{refreshed_count} cache entries in #{elapsed}s")
  rescue StandardError => e
    Rails.logger.error("[RefreshXeroStatsCacheJob] Error: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    # Don't re-raise - this is a cache warmup, not critical
  end

  private

  def refresh_stats_for_tenant(tenant_id)
    cache_key = "xero:sync_stats:#{tenant_id || 'global'}"

    # Get credentials scoped by tenant
    credentials = if tenant_id.nil?
      # Global (master tenant) sees all
      XeroCredential.all
    else
      tenant = Tenant.find_by(id: tenant_id)
      return unless tenant
      XeroCredential.for_teeem_tenant(tenant)
    end

    return if credentials.empty?

    credentials_array = credentials.to_a

    # Batch compute all stats
    stats = XeroSyncStatsService.compute_all_stats(credentials_array)

    # Build per-tenant stats
    tenant_stats = credentials_array.map do |cred|
      XeroSyncStatsService.build_tenant_stats(cred, stats)
    end

    # Global statistics
    global_stats = XeroSyncStatsService.compute_global_stats(credentials_array)

    result = {
      tenant_count: credentials_array.count,
      tenants: tenant_stats,
      global: global_stats
    }

    # Write to cache with 10-minute TTL (longer than refresh interval)
    # This ensures cache doesn't expire between refreshes
    Rails.cache.write(cache_key, result, expires_in: 10.minutes)
  end
end
