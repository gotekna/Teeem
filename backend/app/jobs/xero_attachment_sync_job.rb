# frozen_string_literal: true

# Job to sync attachments from Xero invoices/bills to WarehouseDocument
# Uses XeroRateLimitTracker to go as fast as possible while respecting limits
#
# ULTRA Architecture (Feb 2026):
# ════════════════════════════════════════════════════════════════════════════
# Each Xero org has its OWN rate limit (60/min, 5000/day). They are INDEPENDENT.
# Therefore we process all orgs IN PARALLEL, not sequentially.
#
# Flow:
# 1. Scheduler mode (no tenant_id): Queue a separate job for EACH tenant
# 2. Per-tenant mode (with tenant_id): Process that tenant's invoices
# 3. No global lock - each tenant has its own lock
# 4. No follow-up chains - scheduler runs every 10 min and re-queues all
#
# This scales to 15,000+ Xero orgs with linear throughput increase.
# ════════════════════════════════════════════════════════════════════════════
#
# SSoT Architecture (Jan 2026):
# - WarehouseDocument is THE ONE for all Xero document metadata
# - StorageBlob handles deduplication and flat Blobs/ storage
# - WarehouseFolder + DocumentType define folder structure (no hardcoding)
#
class XeroAttachmentSyncJob < ApplicationJob
  include XeroJobBase
  queue_as :xero_bulk

  # Xero rate limits (per tenant)
  MINUTE_LIMIT = 60
  DAILY_LIMIT = 5000
  # Leave headroom for other operations
  SAFE_MINUTE_LIMIT = 50
  SAFE_DAILY_LIMIT = 4500

  # Per-tenant lock TTL (shorter since jobs are smaller now)
  TENANT_LOCK_TTL = 10.minutes

  # Sync attachments for a single invoice or batch
  # - No args: Scheduler mode - queue parallel jobs for all tenants
  # - tenant_id: Process that specific tenant
  # - external_invoice_id: Process single invoice
  def perform(external_invoice_id = nil, **options)
    if external_invoice_id.present?
      sync_single_invoice(external_invoice_id)
    elsif options[:tenant_id].present?
      # Per-tenant mode: Process this tenant's invoices
      sync_tenant(options[:tenant_id], options)
    else
      # Scheduler mode: Queue parallel jobs for ALL tenants
      schedule_all_tenants(options)
    end
  end

  private

  # ════════════════════════════════════════════════════════════════════════════
  # SCHEDULER MODE: Queue parallel jobs for all tenants
  # ════════════════════════════════════════════════════════════════════════════

  def schedule_all_tenants(options)
    # SELF-HEALING: Clear any stale lockouts before scheduling
    healed = XeroRateLimitTracker.heal_all_lockouts!
    Rails.logger.info("[XeroAttachmentSync] Self-healed #{healed} stale lockouts") if healed > 0

    credentials = XeroCredential.where(status: %w[connected degraded])

    if credentials.empty?
      Rails.logger.warn("[XeroAttachmentSync] No connected Xero credentials found")
      return { scheduled: 0, no_credentials: true }
    end

    scheduled_count = 0
    skipped_count = 0

    credentials.find_each do |credential|
      tenant_id = credential.tenant_id

      # Skip if this tenant is locked out
      if XeroRateLimitTracker.current_lockout(tenant_id: tenant_id).present?
        Rails.logger.debug("[XeroAttachmentSync] Skipping #{credential.tenant_name} - rate limited")
        skipped_count += 1
        next
      end

      # Skip if this tenant already has a job running (per-tenant lock)
      if tenant_job_running?(tenant_id)
        Rails.logger.debug("[XeroAttachmentSync] Skipping #{credential.tenant_name} - job already running")
        skipped_count += 1
        next
      end

      # Skip if this tenant has no work
      remaining = count_remaining_invoices_for_tenant(tenant_id)
      if remaining.zero?
        Rails.logger.debug("[XeroAttachmentSync] Skipping #{credential.tenant_name} - no invoices to sync")
        next
      end

      # Queue a job for this tenant (runs in parallel with other tenants)
      XeroAttachmentSyncJob.perform_later(nil, tenant_id: tenant_id, limit: options[:limit] || 50)
      scheduled_count += 1
      Rails.logger.info("[XeroAttachmentSync] Scheduled job for #{credential.tenant_name} (#{remaining} remaining)")
    end

    Rails.logger.info("[XeroAttachmentSync] Scheduled #{scheduled_count} tenant jobs, skipped #{skipped_count}")
    { scheduled: scheduled_count, skipped: skipped_count }
  end

  # ════════════════════════════════════════════════════════════════════════════
  # PER-TENANT MODE: Process invoices for a specific tenant
  # ════════════════════════════════════════════════════════════════════════════

  def sync_tenant(tenant_id, options)
    credential = XeroCredential.find_by(tenant_id: tenant_id)
    tenant_name = credential&.tenant_name || tenant_id[0..7]

    # Check for Xero-enforced rate limit lockout
    lockout = XeroRateLimitTracker.current_lockout(tenant_id: tenant_id)
    if lockout
      lockout_remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: tenant_id)
      Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: Locked out for #{lockout_remaining}s more")
      return { processed: 0, blocked_by_lockout: true }
    end

    # Acquire per-tenant lock (prevents duplicate jobs for same tenant)
    unless acquire_tenant_lock!(tenant_id)
      Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: Another job already running")
      return { processed: 0, skipped_lock_held: true }
    end

    # Mark sync as in progress
    XeroSyncStatus.start_sync!("pdfs", tenant_id: tenant_id)

    begin
      results = process_tenant_batch(tenant_id, options)

      # Update status
      remaining = count_remaining_invoices_for_tenant(tenant_id)
      XeroSyncStatus.complete_sync!(
        "pdfs",
        tenant_id: tenant_id,
        records_synced: results[:success],
        next_sync_at: 10.minutes.from_now
      )

      Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: Processed #{results[:success]}/#{results[:processed]}, #{remaining} remaining")

      # NO FOLLOW-UP JOBS - Let the scheduler handle re-queuing
      # This prevents chain starvation and ensures fair scheduling

      results
    rescue XeroApiClient::RateLimitError => e
      retry_after = extract_retry_after(e.message)
      XeroRateLimitTracker.record_lockout!(retry_after, tenant_id: tenant_id)
      Rails.logger.warn("[XeroAttachmentSync] #{tenant_name}: Rate limited for #{retry_after}s")
      XeroSyncStatus.fail_sync!("pdfs", tenant_id: tenant_id, error: "Rate limited - retry in #{retry_after}s")
      { processed: 0, rate_limited: true, retry_after: retry_after }
    rescue StandardError => e
      Rails.logger.error("[XeroAttachmentSync] #{tenant_name}: Failed - #{e.message}")
      XeroSyncStatus.fail_sync!("pdfs", tenant_id: tenant_id, error: e.message)
      raise
    ensure
      release_tenant_lock!(tenant_id)
    end
  end

  def process_tenant_batch(tenant_id, options)
    # Get current rate limit usage
    usage = XeroRateLimitTracker.usage_for(tenant_id)

    if usage && usage[:locked_out]
      return { processed: 0, success: 0, failed: 0, aborted_lockout: true }
    end

    # Calculate how many we can safely process
    minute_remaining = usage ? (SAFE_MINUTE_LIMIT - (usage.dig(:minute, :used) || 0)) : SAFE_MINUTE_LIMIT
    daily_remaining = usage ? (SAFE_DAILY_LIMIT - (usage.dig(:daily, :used) || 0)) : SAFE_DAILY_LIMIT

    # Each PDF sync uses ~3 API calls
    api_calls_per_pdf = 3
    max_by_minute = (minute_remaining / api_calls_per_pdf).clamp(0, 20)
    max_by_daily = (daily_remaining / api_calls_per_pdf).clamp(0, 500)

    limit = [max_by_minute, max_by_daily, options[:limit] || 50].min

    if limit <= 0
      return { processed: 0, success: 0, failed: 0, skipped_rate_limit: true }
    end

    # Find invoices needing PDFs for this tenant
    invoices = find_invoices_needing_pdfs(limit, tenant_id, options[:invoice_type])

    results = { processed: 0, success: 0, failed: 0, errors: [] }

    invoices.find_each do |invoice|
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
      rescue XeroApiClient::RateLimitError
        raise # Re-raise to trigger lockout recording
      rescue StandardError => e
        results[:failed] += 1
        results[:errors] << { invoice_id: invoice.id, errors: [e.message] }
        Rails.logger.error("[XeroAttachmentSync] Invoice #{invoice.id} failed: #{e.message}")
      end

      # Small delay to spread requests
      sleep(1)
    end

    results
  end

  # ════════════════════════════════════════════════════════════════════════════
  # SINGLE INVOICE MODE
  # ════════════════════════════════════════════════════════════════════════════

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

  # ════════════════════════════════════════════════════════════════════════════
  # QUERY HELPERS
  # ════════════════════════════════════════════════════════════════════════════

  def find_invoices_needing_pdfs(limit, xero_tenant_id = nil, invoice_type = nil)
    already_synced_ids = WarehouseDocument
      .where(source_type: "xero")
      .where(documentable_type: "ExternalInvoice")
      .where("metadata->>'is_primary' = ?", "true")
      .where.not(storage_blob_id: nil)
      .pluck(:documentable_id)

    query = ExternalInvoice
      .active
      .where.not(external_id: nil)
      .where.not(tenant_id: nil)
      .where.not(contact_id: nil)
      .where.not(id: already_synced_ids)
      .limit(limit)

    if xero_tenant_id.present?
      contact_ids_for_xero_org = ContactExternalLink
        .where(source: "xero", tenant_id: xero_tenant_id)
        .pluck(:contact_id)
      query = query.where(contact_id: contact_ids_for_xero_org)
    end

    query = query.where(invoice_type: invoice_type) if invoice_type.present?

    query
  end

  def count_remaining_invoices_for_tenant(xero_tenant_id)
    return 0 unless xero_tenant_id.present?

    already_synced_ids = WarehouseDocument
      .where(source_type: "xero")
      .where(documentable_type: "ExternalInvoice")
      .where("metadata->>'is_primary' = ?", "true")
      .where.not(storage_blob_id: nil)
      .pluck(:documentable_id)

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

  # ════════════════════════════════════════════════════════════════════════════
  # RATE LIMIT HELPERS
  # ════════════════════════════════════════════════════════════════════════════

  def should_pause_for_rate_limit?(tenant_id)
    return false unless tenant_id

    return true if XeroRateLimitTracker.current_lockout(tenant_id: tenant_id).present?

    usage = XeroRateLimitTracker.usage_for(tenant_id)
    return false unless usage

    return true if usage[:locked_out]

    (usage.dig(:minute, :percentage) || 0) >= 90 ||
      (usage.dig(:daily, :percentage) || 0) >= 90
  end

  def extract_retry_after(message)
    match = message.match(/retry after (\d+)/i)
    match ? match[1].to_i : 3600
  end

  # ════════════════════════════════════════════════════════════════════════════
  # PER-TENANT LOCKING (replaces global batch lock)
  # ════════════════════════════════════════════════════════════════════════════

  def tenant_lock_key(tenant_id)
    "xero:attachment_sync:tenant_lock:#{tenant_id}"
  end

  def tenant_job_running?(tenant_id)
    Rails.cache.read(tenant_lock_key(tenant_id)).present?
  end

  def acquire_tenant_lock!(tenant_id)
    lock_key = tenant_lock_key(tenant_id)

    # Check for stale lock
    existing = Rails.cache.read(lock_key)
    if existing
      locked_at = Time.parse(existing[:locked_at]) rescue nil
      if locked_at && locked_at < 10.minutes.ago
        Rails.cache.delete(lock_key)
        Rails.logger.warn("[XeroAttachmentSync] Cleared stale tenant lock for #{tenant_id}")
      end
    end

    Rails.cache.write(
      lock_key,
      { locked_at: Time.current.iso8601, job_id: job_id },
      expires_in: TENANT_LOCK_TTL,
      unless_exist: true
    )
  end

  def release_tenant_lock!(tenant_id)
    Rails.cache.delete(tenant_lock_key(tenant_id))
  end
end
