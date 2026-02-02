# frozen_string_literal: true

# Job to sync attachments from Xero invoices/bills to WarehouseDocument
# Uses XeroRateLimitTracker to go as fast as possible while respecting limits
#
# SSoT Architecture (Jan 2026):
# - WarehouseDocument is THE ONE for all Xero document metadata
# - StorageBlob handles deduplication and flat Blobs/ storage
# - WarehouseFolder + DocumentType define folder structure (no hardcoding)
#
# Rate Limit Handling:
# - Checks XeroRateLimitTracker for Xero-enforced lockouts before processing
# - When Xero returns 429, records lockout and schedules retry after lockout expires
# - Uses cache-based lock to prevent multiple parallel batch jobs
#
class XeroAttachmentSyncJob < ApplicationJob
  include XeroJobBase
  queue_as :xero_bulk

  # Xero rate limits
  MINUTE_LIMIT = 60
  DAILY_LIMIT = 5000
  # Leave headroom for other operations
  SAFE_MINUTE_LIMIT = 50
  SAFE_DAILY_LIMIT = 4500

  # Cache key for batch job lock
  BATCH_LOCK_KEY = "xero:attachment_sync:batch_lock"
  BATCH_LOCK_TTL = 30.minutes

  # Sync attachments for a single invoice or batch
  # Multi-org support: If no tenant_id specified, syncs ALL connected orgs
  def perform(external_invoice_id = nil, **options)
    if external_invoice_id.present?
      sync_single_invoice(external_invoice_id)
    elsif options[:tenant_id].present?
      # Specific tenant requested - sync just that one
      sync_batch_with_rate_limiting(options)
    else
      # No tenant specified - sync ALL connected orgs (multi-org support)
      sync_all_tenants(options)
    end
  end

  private

  # SSoT: Sync ALL connected Xero orgs, not just the primary
  # This ensures multi-org setups get their PDFs synced
  def sync_all_tenants(options)
    # SELF-HEALING (Feb 2026): Clear any stale lockouts before starting
    # This ensures expired lockouts don't block progress
    healed = XeroRateLimitTracker.heal_all_lockouts!
    Rails.logger.info("[XeroAttachmentSync] Self-healed #{healed} stale lockouts") if healed > 0

    credentials = XeroCredential.where(status: %w[connected degraded])

    if credentials.empty?
      Rails.logger.warn("[XeroAttachmentSync] No connected Xero credentials found")
      return { processed: 0, success: 0, failed: 0, no_credentials: true }
    end

    Rails.logger.info("[XeroAttachmentSync] Syncing #{credentials.count} connected org(s)")

    combined_results = {
      processed: 0,
      success: 0,
      failed: 0,
      tenants_processed: 0,
      tenant_results: []
    }

    credentials.find_each do |credential|
      Rails.logger.info("[XeroAttachmentSync] Processing org: #{credential.tenant_name} (#{credential.tenant_id})")

      # Check if this tenant is locked out before processing
      if XeroRateLimitTracker.current_lockout(tenant_id: credential.tenant_id).present?
        Rails.logger.info("[XeroAttachmentSync] Skipping #{credential.tenant_name} - rate limited")
        combined_results[:tenant_results] << { tenant_id: credential.tenant_id, skipped_lockout: true }
        next
      end

      result = sync_batch_with_rate_limiting(options.merge(tenant_id: credential.tenant_id))
      combined_results[:processed] += result[:processed] || 0
      combined_results[:success] += result[:success] || 0
      combined_results[:failed] += result[:failed] || 0
      combined_results[:tenants_processed] += 1
      combined_results[:tenant_results] << result.merge(tenant_id: credential.tenant_id)

      # FRC (Feb 2026): Each Xero org has its OWN rate limit - don't stop other orgs!
      # Previous code: break if result[:rate_limited] - WRONG, killed throughput
      # Now we just log and continue to next tenant
      if result[:rate_limited] || result[:blocked_by_lockout]
        Rails.logger.info("[XeroAttachmentSync] #{credential.tenant_name} rate limited, continuing to next org")
      end
    end

    Rails.logger.info("[XeroAttachmentSync] All orgs complete: #{combined_results.slice(:tenants_processed, :processed, :success, :failed)}")
    combined_results
  end

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
    # tenant_id is now always provided (either explicitly or from sync_all_tenants)
    tenant_id = options[:tenant_id]

    unless tenant_id.present?
      Rails.logger.warn("[XeroAttachmentSync] No tenant_id provided, skipping")
      return { processed: 0, success: 0, failed: 0, error: "No tenant_id provided" }
    end

    # SSoT: Check for Xero-enforced rate limit lockout FIRST
    lockout = XeroRateLimitTracker.current_lockout(tenant_id: tenant_id)
    if lockout
      lockout_remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: tenant_id)
      Rails.logger.warn("[XeroAttachmentSync] BLOCKED: Xero rate limit lockout active for #{lockout_remaining} more seconds")
      # Schedule retry after lockout expires (with 60 second buffer)
      retry_at = lockout_remaining + 60
      XeroAttachmentSyncJob.set(wait: retry_at.seconds).perform_later(**options)
      return { processed: 0, success: 0, failed: 0, blocked_by_lockout: true, retry_in_seconds: retry_at }
    end

    # SSoT: Acquire batch lock to prevent parallel processing
    unless acquire_batch_lock!
      Rails.logger.warn("[XeroAttachmentSync] SKIPPED: Another batch job is already running")
      return { processed: 0, success: 0, failed: 0, skipped_lock_held: true }
    end

    # Mark sync as in progress (global and per-tenant)
    XeroSyncStatus.start_sync!("pdfs", tenant_id: nil)
    XeroSyncStatus.start_sync!("pdfs", tenant_id: tenant_id) if tenant_id.present?

    begin
      results = smart_batch_sync(options)

      # Calculate next sync based on how much work is left
      # FRC (Feb 2026): Use per-tenant count for follow-up decisions, global for status
      remaining_global = count_remaining_invoices
      remaining_tenant = tenant_id.present? ? count_remaining_invoices_for_tenant(tenant_id) : remaining_global

      next_sync = if remaining_global.zero?
                    30.minutes.from_now  # Stay near-live when caught up
      elsif remaining_global < 100
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

      # FRC (Feb 2026): Only queue follow-up if THIS TENANT has remaining work
      # Previous bug: Used global count, so orgs with 0 remaining kept getting jobs
      # while orgs with work were starved
      if remaining_tenant > 0 && can_continue_syncing?(tenant_id)
        Rails.logger.info("[XeroAttachmentSync] #{remaining_tenant} remaining for tenant, queuing next batch")
        XeroAttachmentSyncJob.set(wait: 1.minute).perform_later(**options)
      end

      results
    rescue XeroApiClient::RateLimitError => e
      # SSoT: When Xero rate-limits us, record the lockout and schedule retry
      retry_after = extract_retry_after(e.message)
      XeroRateLimitTracker.record_lockout!(retry_after, tenant_id: tenant_id)

      Rails.logger.warn("[XeroAttachmentSync] RATE LIMITED by Xero: Scheduling retry in #{retry_after + 60} seconds")
      XeroSyncStatus.fail_sync!("pdfs", tenant_id: nil, error: "Rate limited by Xero - retry in #{retry_after}s")
      XeroSyncStatus.fail_sync!("pdfs", tenant_id: tenant_id, error: "Rate limited by Xero - retry in #{retry_after}s") if tenant_id.present?

      # Schedule retry after lockout expires (with 60 second buffer)
      XeroAttachmentSyncJob.set(wait: (retry_after + 60).seconds).perform_later(**options)
      { processed: 0, success: 0, failed: 0, rate_limited: true, retry_in_seconds: retry_after + 60 }
    rescue StandardError => e
      Rails.logger.error("[XeroAttachmentSync] Batch failed: #{e.message}")
      XeroSyncStatus.fail_sync!("pdfs", tenant_id: nil, error: e.message)
      XeroSyncStatus.fail_sync!("pdfs", tenant_id: tenant_id, error: e.message) if tenant_id.present?
      raise
    ensure
      release_batch_lock!
    end
  end

  def smart_batch_sync(options)
    tenant_id = options[:tenant_id]
    invoice_type = options[:invoice_type]

    # Get current rate limit usage for the specific tenant
    usage = XeroRateLimitTracker.usage_for(tenant_id)

    # SSoT: Abort immediately if Xero has us locked out
    if usage && usage[:locked_out]
      Rails.logger.info("[XeroAttachmentSync] Xero lockout active, aborting batch")
      return { processed: 0, success: 0, failed: 0, aborted_lockout: true }
    end

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
      break if should_pause_for_rate_limit?(tenant_id)

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
      rescue XeroApiClient::RateLimitError => e
        # SSoT: Re-raise RateLimitError so outer handler can record lockout
        Rails.logger.warn("[XeroAttachmentSync] Rate limit hit during invoice #{invoice.id}: #{e.message}")
        raise e
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

  # FRC (Feb 2026): tenant_id param is now Xero UUID, not TEEEM integer
  # ExternalInvoice.tenant_id is TEEEM integer (fixed earlier today)
  # Filter by contact's external link which has the Xero tenant_id
  def find_invoices_needing_pdfs(limit, xero_tenant_id = nil, invoice_type = nil)
    # SSoT: Find invoices that DON'T already have PDF synced via WarehouseDocument
    # WarehouseDocument with source_type: "xero" and storage_blob_id present = synced
    already_synced_ids = WarehouseDocument
      .where(source_type: "xero")
      .where(documentable_type: "ExternalInvoice")
      .where("metadata->>'is_primary' = ?", "true")
      .where.not(storage_blob_id: nil)
      .pluck(:documentable_id)

    query = ExternalInvoice
      .active  # Exclude deleted/voided invoices
      .where.not(external_id: nil)
      .where.not(tenant_id: nil)
      .where.not(contact_id: nil)
      .where.not(id: already_synced_ids)
      .limit(limit)

    # FRC (Feb 2026): Filter by Xero org via contact's external link
    # ExternalInvoice.tenant_id is TEEEM integer, xero_tenant_id is Xero UUID
    if xero_tenant_id.present?
      contact_ids_for_xero_org = ContactExternalLink
        .where(source: "xero", tenant_id: xero_tenant_id)
        .pluck(:contact_id)
      query = query.where(contact_id: contact_ids_for_xero_org)
    end

    query = query.where(invoice_type: invoice_type) if invoice_type.present?

    query
  end

  def count_remaining_invoices
    # SSoT: Count invoices without synced WarehouseDocument
    already_synced_ids = WarehouseDocument
      .where(source_type: "xero")
      .where(documentable_type: "ExternalInvoice")
      .where("metadata->>'is_primary' = ?", "true")
      .where.not(storage_blob_id: nil)
      .pluck(:documentable_id)

    ExternalInvoice
      .active  # Exclude deleted/voided invoices
      .where.not(external_id: nil)
      .where.not(tenant_id: nil)
      .where.not(contact_id: nil)
      .where.not(id: already_synced_ids)
      .count
  end

  # FRC (Feb 2026): Count remaining invoices for a SPECIFIC Xero org
  # Used to decide whether to queue follow-up jobs for this tenant
  def count_remaining_invoices_for_tenant(xero_tenant_id)
    return 0 unless xero_tenant_id.present?

    already_synced_ids = WarehouseDocument
      .where(source_type: "xero")
      .where(documentable_type: "ExternalInvoice")
      .where("metadata->>'is_primary' = ?", "true")
      .where.not(storage_blob_id: nil)
      .pluck(:documentable_id)

    # Filter by Xero org via contact's external link
    contact_ids_for_xero_org = ContactExternalLink
      .where(source: "xero", tenant_id: xero_tenant_id)
      .pluck(:contact_id)

    ExternalInvoice
      .active
      .where(contact_id: contact_ids_for_xero_org)
      .where.not(external_id: nil)
      .where.not(tenant_id: nil)
      .where.not(contact_id: nil)
      .where.not(id: already_synced_ids)
      .count
  end

  def should_pause_for_rate_limit?(tenant_id)
    return false unless tenant_id

    # SSoT: Check Xero-enforced lockout first
    return true if XeroRateLimitTracker.current_lockout(tenant_id: tenant_id).present?

    usage = XeroRateLimitTracker.usage_for(tenant_id)
    return false unless usage

    # Also pause if Xero has us locked out
    return true if usage[:locked_out]

    # Pause if we've used 90% of minute or daily limit
    (usage.dig(:minute, :percentage) || 0) >= 90 ||
      (usage.dig(:daily, :percentage) || 0) >= 90
  end

  def can_continue_syncing?(tenant_id)
    return false unless tenant_id.present?

    # SSoT: Cannot continue if Xero has us locked out
    return false if XeroRateLimitTracker.current_lockout(tenant_id: tenant_id).present?

    usage = XeroRateLimitTracker.usage_for(tenant_id)
    return true unless usage

    # Cannot continue if locked out
    return false if usage[:locked_out]

    # Can continue if we have headroom
    (usage.dig(:minute, :percentage) || 0) < 80 &&
      (usage.dig(:daily, :percentage) || 0) < 80
  end

  # ========================================
  # LOCKING METHODS (prevent parallel batch jobs)
  # ========================================

  # Acquire a batch lock to prevent parallel processing
  # @return [Boolean] true if lock acquired, false if already held
  def acquire_batch_lock!
    # SELF-HEALING (Feb 2026): Check if existing lock is stale before giving up
    # A lock is stale if:
    # 1. It's been held for > 10 minutes AND
    # 2. No documents have been synced in the last 5 minutes
    # This prevents crashed jobs from blocking sync for the full 30-min TTL
    existing = Rails.cache.read(BATCH_LOCK_KEY)
    if existing
      locked_at = Time.parse(existing[:locked_at]) rescue nil
      lock_age_minutes = locked_at ? ((Time.current - locked_at) / 60).round : 0

      if lock_age_minutes > 10
        # Check for recent sync activity
        last_sync = WarehouseDocument.where(source_type: "xero").order(created_at: :desc).first
        last_sync_minutes = last_sync ? ((Time.current - last_sync.created_at) / 60).round : 999

        if last_sync_minutes > 5
          # Lock is stale - clear it and proceed
          Rails.cache.delete(BATCH_LOCK_KEY)
          Rails.logger.warn("[XeroAttachmentSync] SELF-HEAL: Cleared stale batch lock (held #{lock_age_minutes} min, last sync #{last_sync_minutes} min ago)")
        end
      end
    end

    # Try to set the lock key only if it doesn't exist
    # Returns true if we set it, false if it already existed
    acquired = Rails.cache.write(
      BATCH_LOCK_KEY,
      { locked_at: Time.current.iso8601, job_id: job_id },
      expires_in: BATCH_LOCK_TTL,
      unless_exist: true
    )

    if acquired
      Rails.logger.info("[XeroAttachmentSync] Batch lock acquired")
    else
      existing = Rails.cache.read(BATCH_LOCK_KEY)
      Rails.logger.info("[XeroAttachmentSync] Batch lock held by another job: #{existing.inspect}")
    end

    acquired
  end

  # Release the batch lock
  def release_batch_lock!
    Rails.cache.delete(BATCH_LOCK_KEY)
    Rails.logger.info("[XeroAttachmentSync] Batch lock released")
  end

  # Extract retry_after seconds from RateLimitError message
  # @param message [String] Error message like "Rate limit exceeded. Retry after 55494 seconds"
  # @return [Integer] Seconds to wait, defaults to 3600 (1 hour) if not parseable
  def extract_retry_after(message)
    # Try to extract number from "Retry after X seconds"
    match = message.match(/retry after (\d+)/i)
    if match
      match[1].to_i
    else
      # Default to 1 hour if we can't parse
      Rails.logger.warn("[XeroAttachmentSync] Could not parse retry_after from: #{message}, defaulting to 3600s")
      3600
    end
  end
end
