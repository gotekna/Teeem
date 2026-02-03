# frozen_string_literal: true

# Phase 1: Add composite indexes for Xero sync stats performance
#
# Problem: sync_stats endpoint runs 15N+13 queries for N credentials,
# which becomes 2.45M queries at 15,000 connections.
#
# Solution: Add composite indexes to reduce query time by 60-80%
# These indexes support the batch queries in XeroSyncStatsService.
#
# SSoT: Part of "Scale Xero Sync to 15k" plan
class AddXeroSyncStatsIndexes < ActiveRecord::Migration[8.0]
  disable_ddl_transaction! # Required for CONCURRENTLY

  def change
    # ============================================
    # contact_external_links indexes
    # ============================================

    # Index for filtering by xero_org_id + sync_enabled
    # Supports: tenant_links.enabled.count queries
    add_index :contact_external_links,
              [:xero_org_id, :sync_enabled],
              algorithm: :concurrently,
              name: "idx_cel_xero_org_sync_enabled",
              if_not_exists: true

    # Index for match_type breakdown queries
    # Supports: tenant_links.group(:match_type).count
    add_index :contact_external_links,
              [:xero_org_id, :match_type],
              algorithm: :concurrently,
              name: "idx_cel_xero_org_match_type",
              if_not_exists: true

    # Index for last_synced_at queries
    # Supports: tenant_links.maximum(:last_synced_at)
    add_index :contact_external_links,
              [:xero_org_id, :last_synced_at],
              algorithm: :concurrently,
              name: "idx_cel_xero_org_last_synced",
              if_not_exists: true

    # Index for needs_review filter by xero_org
    # Supports: tenant_links.pending_review.count
    add_index :contact_external_links,
              [:xero_org_id, :needs_review],
              algorithm: :concurrently,
              name: "idx_cel_xero_org_needs_review",
              if_not_exists: true

    # Index for sync_error filter by xero_org
    # Supports: tenant_links.with_errors.count
    add_index :contact_external_links,
              [:xero_org_id, :sync_error],
              algorithm: :concurrently,
              name: "idx_cel_xero_org_sync_error",
              if_not_exists: true

    # ============================================
    # external_invoices indexes
    # ============================================

    # Composite index for invoice type + status filtering
    # Supports: tenant_invoices.sales_invoices.count, .bills.count, etc.
    add_index :external_invoices,
              [:xero_org_id, :invoice_type, :status],
              algorithm: :concurrently,
              name: "idx_ext_inv_xero_org_type_status",
              if_not_exists: true

    # Index for last_synced_at queries
    # Supports: tenant_invoices.maximum(:last_synced_at)
    add_index :external_invoices,
              [:xero_org_id, :last_synced_at],
              algorithm: :concurrently,
              name: "idx_ext_inv_xero_org_last_synced",
              if_not_exists: true

    # Partial index for active invoices (excludes soft-deleted)
    # Supports: ExternalInvoice.xero.active.for_xero_org(tenant_id)
    add_index :external_invoices,
              [:xero_org_id, :source],
              where: "deleted_at IS NULL",
              algorithm: :concurrently,
              name: "idx_ext_inv_xero_org_active",
              if_not_exists: true
  end
end
