# frozen_string_literal: true

# Job to sync attachments from Xero invoices/bills to CorporateCompanyDocuments
# Uses XeroRateLimitTracker to go as fast as possible while respecting limits
class XeroAttachmentSyncJob < ApplicationJob
  include XeroJobBase
  queue_as :xero_bulk

  # Xero rate limits
  MINUTE_LIMIT = 60
  DAILY_LIMIT = 5000
  # Leave headroom for other operations
  SAFE_MINUTE_LIMIT = 50
  SAFE_DAILY_LIMIT = 4500

  # Sync attachments for a single invoice or batch
  def perform(external_invoice_id = nil, **options)
    if external_invoice_id.present?
      sync_single_invoice(external_invoice_id)
    else
      sync_batch_with_rate_limiting(options)
    end
  end

  private

  def sync_single_invoice(external_invoice_id)
    invoice = ExternalInvoice.find_by(id: external_invoice_id)

    unless invoice
      Rails.logger.warn("[XeroAttachmentSync] Invoice #{external_invoice_id} not found")
      return { success: false, error: "Invoice not found" }
    end

    service = XeroAttachmentSyncService.new(invoice)
    result = service.sync!

    if result[:errors].any?
      Rails.logger.warn("[XeroAttachmentSync] Invoice #{external_invoice_id} had errors: #{result[:errors].join(', ')}")
    end

    result
  end

  def sync_batch_with_rate_limiting(options)
    # Get tenant_id for per-tenant status tracking
    tenant_id = options[:tenant_id] || XeroCredential.where(status: %w[connected degraded]).first&.tenant_id

    # Mark sync as in progress (global and per-tenant)
    XeroSyncStatus.start_sync!("pdfs", tenant_id: nil)
    XeroSyncStatus.start_sync!("pdfs", tenant_id: tenant_id) if tenant_id.present?

    begin
      results = smart_batch_sync(options)

      # Calculate next sync based on how much work is left
      remaining = count_remaining_invoices
      next_sync = if remaining.zero?
                    30.minutes.from_now  # Stay near-live when caught up
      elsif remaining < 100
                    10.minutes.from_now  # Almost caught up
      else
                    5.minutes.from_now   # Still catching up - go fast
      end

      # Update global status
      XeroSyncStatus.complete_sync!(
        "pdfs",
        tenant_id: nil,
        records_synced: results[:success],
        next_sync_at: next_sync
      )

      # Update per-tenant status (for self-healing to work)
      if tenant_id.present?
        XeroSyncStatus.complete_sync!(
          "pdfs",
          tenant_id: tenant_id,
          records_synced: results[:success],
          next_sync_at: next_sync
        )
      end

      # If there's more work and we have rate limit headroom, queue another batch
      if remaining > 0 && can_continue_syncing?
        Rails.logger.info("[XeroAttachmentSync] #{remaining} remaining, queuing next batch")
        XeroAttachmentSyncJob.set(wait: 1.minute).perform_later(**options)
      end

      results
    rescue StandardError => e
      Rails.logger.error("[XeroAttachmentSync] Batch failed: #{e.message}")
      XeroSyncStatus.fail_sync!("pdfs", tenant_id: nil, error: e.message)
      XeroSyncStatus.fail_sync!("pdfs", tenant_id: tenant_id, error: e.message) if tenant_id.present?
      raise
    end
  end

  def smart_batch_sync(options)
    tenant_id = options[:tenant_id]
    invoice_type = options[:invoice_type]

    # Get current rate limit usage
    credential = XeroCredential.where(status: %w[connected degraded]).first
    usage = XeroRateLimitTracker.usage_for(credential&.tenant_id)

    # Calculate how many we can safely process this batch
    minute_remaining = usage ? (SAFE_MINUTE_LIMIT - (usage.dig(:minute, :used) || 0)) : SAFE_MINUTE_LIMIT
    daily_remaining = usage ? (SAFE_DAILY_LIMIT - (usage.dig(:daily, :used) || 0)) : SAFE_DAILY_LIMIT

    # Each PDF sync uses ~3 API calls (get invoice, get attachment, download)
    api_calls_per_pdf = 3
    max_by_minute = (minute_remaining / api_calls_per_pdf).clamp(0, 20)  # Max 20 per minute
    max_by_daily = (daily_remaining / api_calls_per_pdf).clamp(0, 500)   # Max 500 per batch

    limit = [ max_by_minute, max_by_daily, options[:limit] || 100 ].min

    if limit <= 0
      Rails.logger.info("[XeroAttachmentSync] Rate limited, skipping batch")
      return { processed: 0, success: 0, failed: 0, skipped_rate_limit: true }
    end

    Rails.logger.info("[XeroAttachmentSync] Processing #{limit} PDFs (minute: #{minute_remaining} remaining, daily: #{daily_remaining} remaining)")

    # Find invoices needing PDFs
    invoices = find_invoices_needing_pdfs(limit, tenant_id, invoice_type)

    results = {
      processed: 0,
      success: 0,
      failed: 0,
      errors: []
    }

    invoices.find_each do |invoice|
      # Check rate limit before each invoice
      break if should_pause_for_rate_limit?(credential&.tenant_id)

      results[:processed] += 1

      begin
        service = XeroAttachmentSyncService.new(invoice)
        result = service.sync!

        if result[:errors].empty?
          results[:success] += 1
        else
          results[:failed] += 1
          results[:errors] << { invoice_id: invoice.id, errors: result[:errors] }
        end
      rescue StandardError => e
        results[:failed] += 1
        results[:errors] << { invoice_id: invoice.id, errors: [ e.message ] }
        Rails.logger.error("[XeroAttachmentSync] Error processing invoice #{invoice.id}: #{e.message}")
      end

      # Small delay to spread requests (1 second between PDFs)
      sleep(1)
    end

    Rails.logger.info("[XeroAttachmentSync] Batch complete: #{results.slice(:processed, :success, :failed)}")
    results
  end

  def find_invoices_needing_pdfs(limit, tenant_id = nil, invoice_type = nil)
    # Find invoices that DON'T already have PDF synced
    already_synced_ids = CorporateCompanyDocument
      .where(source: "xero")
      .where("external_id LIKE ?", "xero:%:pdf")
      .where(documentable_type: "ExternalInvoice")
      .pluck(:documentable_id)

    query = ExternalInvoice
      .where.not(external_id: nil)
      .where.not(tenant_id: nil)
      .where.not(contact_id: nil)
      .where.not(id: already_synced_ids)
      .limit(limit)

    query = query.where(tenant_id: tenant_id) if tenant_id.present?
    query = query.where(invoice_type: invoice_type) if invoice_type.present?

    query
  end

  def count_remaining_invoices
    already_synced_ids = CorporateCompanyDocument
      .where(source: "xero")
      .where("external_id LIKE ?", "xero:%:pdf")
      .where(documentable_type: "ExternalInvoice")
      .pluck(:documentable_id)

    ExternalInvoice
      .where.not(external_id: nil)
      .where.not(tenant_id: nil)
      .where.not(contact_id: nil)
      .where.not(id: already_synced_ids)
      .count
  end

  def should_pause_for_rate_limit?(tenant_id)
    return false unless tenant_id

    usage = XeroRateLimitTracker.usage_for(tenant_id)
    return false unless usage

    # Pause if we've used 90% of minute or daily limit
    (usage.dig(:minute, :percentage) || 0) >= 90 ||
      (usage.dig(:daily, :percentage) || 0) >= 90
  end

  def can_continue_syncing?
    credential = XeroCredential.where(status: %w[connected degraded]).first
    return false unless credential

    usage = XeroRateLimitTracker.usage_for(credential.tenant_id)
    return true unless usage

    # Can continue if we have headroom
    (usage.dig(:minute, :percentage) || 0) < 80 &&
      (usage.dig(:daily, :percentage) || 0) < 80
  end
end
