class XeroInvoiceSyncJob < ApplicationJob
  queue_as :default

  # Perform incremental sync of invoices from Xero
  # Can accept options:
  # - incremental: true (default) - only sync since last sync
  # - incremental: false - full sync
  # - tenant_id: specific tenant to sync
  def perform(options = {})
    options = options.with_indifferent_access if options.is_a?(Hash)

    incremental = options[:incremental] != false
    tenant_id = options[:tenant_id]

    Rails.logger.info("XeroInvoiceSyncJob started at #{Time.current} (incremental: #{incremental})")

    begin
      service = ExternalInvoiceSyncService.new(
        source: "xero",
        tenant_id: tenant_id
      )

      result = if incremental
                 service.sync_incremental
      else
                 service.sync
      end

      Rails.logger.info("XeroInvoiceSyncJob completed: #{result[:stats].inspect}")

      # Store last sync result for health monitoring
      Rails.cache.write(
        "xero_invoice_sync_last_result",
        {
          success: result[:success],
          synced_at: Time.current.iso8601,
          stats: result[:stats],
          incremental: incremental
        },
        expires_in: 24.hours
      )

      result
    rescue StandardError => e
      Rails.logger.error("XeroInvoiceSyncJob failed: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))

      # Store error for health monitoring
      Rails.cache.write(
        "xero_invoice_sync_last_result",
        {
          success: false,
          synced_at: Time.current.iso8601,
          error: e.message,
          incremental: incremental
        },
        expires_in: 24.hours
      )

      raise
    end
  end
end
