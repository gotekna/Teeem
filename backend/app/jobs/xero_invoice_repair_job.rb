# frozen_string_literal: true

# XeroInvoiceRepairJob - Self-healing repair for bills with empty line_items
#
# Root Cause (Feb 2026): The original Xero sync fetched invoices without pagination,
# which returns summary data (no LineItems, no Tracking). The pagination fix prevents
# new gaps, but existing bills need surgical repair.
#
# How it works:
# - Finds bills with empty line_items across ALL tenants
# - Fetches each invoice individually from Xero API (full data)
# - Updates line_items, tracking_data, and re-links to jobs
# - Rate-limit aware: processes BATCH_SIZE per run, respects lockouts
# - Runs every 30 minutes on xero_sync queue
#
# Self-healing: Once all bills are repaired, this job does nothing (fast no-op).
# No need to disable it - the query returns 0 results and exits immediately.
#
class XeroInvoiceRepairJob < ApplicationJob
  include XeroJobBase
  include DeduplicatableJob

  queue_as :xero_sync

  # Process 30 invoices per run (~36 seconds of API calls at 1.2s each)
  # At every 30 minutes: 30 invoices/run × 48 runs/day = 1,440 repairs/day
  # Pilgrim's 1,067 remaining = repaired in under 1 day
  BATCH_SIZE = 30

  # ⚠️ FRC (Feb 2026): Must iterate over tenants
  # Root cause: ExternalInvoice has acts_as_tenant. Without tenant context,
  # the service uses wrong Xero credentials and mixes tenant data during repair.
  # The without_tenant global check is kept for fast no-op detection.
  def perform(options = {})
    options = options.with_indifferent_access if options.is_a?(Hash)

    # Quick check: anything to repair across all tenants?
    needs_repair = ActsAsTenant.without_tenant do
      ExternalInvoice.where(invoice_type: "bill")
                     .where("line_items = '[]'::jsonb")
                     .where.not(external_id: nil)
                     .exists?
    end

    unless needs_repair
      Rails.logger.info("XeroInvoiceRepairJob: No bills need repair - healthy")
      return { success: true, repaired: 0, message: "No repairs needed" }
    end

    batch_size = options[:batch_size] || BATCH_SIZE
    total_repaired = 0
    total_errors = 0

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        service = ExternalInvoiceSyncService.new(
          source: "xero",
          tenant_id: tenant.id
        )

        result = service.repair_empty_line_items(batch_size: batch_size)
        total_repaired += (result[:repaired] || 0)
        total_errors += (result[:errors]&.size || 0)
      end
    end

    # Log summary for monitoring
    remaining = ActsAsTenant.without_tenant do
      ExternalInvoice.where(invoice_type: "bill")
                     .where("line_items = '[]'::jsonb")
                     .where.not(external_id: nil)
                     .count
    end

    Rails.logger.info(
      "XeroInvoiceRepairJob complete: " \
      "repaired=#{total_repaired}, " \
      "remaining=#{remaining}, " \
      "errors=#{total_errors}"
    )

    { success: true, repaired: total_repaired, remaining: remaining, errors: total_errors }
  end
end
