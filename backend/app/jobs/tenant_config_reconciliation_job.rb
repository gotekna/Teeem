# frozen_string_literal: true

# Weekly reconciliation of system warehouse tabs across all tenants.
#
# FRC (Mar 2026): A migration used LIMIT 1 without tenant scoping, creating
# system tabs for only one tenant. This job is the second layer of defence
# (after deploy-time reconciliation in deploy.rake) — it catches any drift
# that might occur between deploys.
#
# What it does:
#   1. Ensures every non-master tenant has all system warehouse folders from master
#   2. Fixes orphaned children (parent_id pointing to another tenant's records)
#   3. Logs findings for monitoring
#
# Safe to run anytime — fully idempotent via sync_key matching.
class TenantConfigReconciliationJob < ApplicationJob
  include DeduplicatableJob

  queue_as :low

  def perform
    Rails.logger.info "[TenantConfigReconciliation] Starting weekly reconciliation"

    result = TenantConfigSyncService.reconcile_system_tabs!

    if result[:success]
      Rails.logger.info "[TenantConfigReconciliation] Complete: " \
        "#{result[:created]} created, #{result[:fixed]} fixed across #{result[:tenants]} tenants"
    else
      Rails.logger.warn "[TenantConfigReconciliation] Skipped: #{result[:error]}"
    end
  end
end
