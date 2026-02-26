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
# 5. STAGGER: Jobs start 30s apart to avoid hitting Xero API simultaneously
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
  include DeduplicatableJob
  include XeroConstants  # For XERO_ATTACHMENT_SYNC_DELAY_SEC
  include XeroJobBase
  queue_as :xero_bulk

  # ⚠️ DO NOT SIMPLIFY - Per-variant concurrency keys (Feb 2026)
  # ════════════════════════════════════════════════════════════════
  # Why: DeduplicatableJob's default key (self.class.name) creates a GLOBAL lock
  # so only ONE XeroAttachmentSyncJob can run at a time. But the ULTRA Architecture
  # above says "each Xero org is INDEPENDENT, process IN PARALLEL". The global key
  # serialized all orgs → Pilgrim jobs got blocked behind Tekna → stuck at 4,824.
  # ❌ WRONG: limits_concurrency key: ->(*) { self.class.name }
  #           → All jobs share ONE slot → serial, not parallel
  # ✅ CORRECT: Per-variant keys → scheduler, each tenant, and single-invoice
  #             can all run independently
  # ════════════════════════════════════════════════════════════════
  limits_concurrency to: 1, key: ->(external_invoice_id = nil, **options) {
    if options[:tenant_id].present?
      "XeroAttachmentSyncJob:tenant:#{options[:tenant_id]}"
    elsif external_invoice_id.present?
      "XeroAttachmentSyncJob:invoice:#{external_invoice_id}"
    else
      "XeroAttachmentSyncJob:scheduler"
    end
  }

  # Override DeduplicatableJob's cleanup to be concurrency-key-aware.
  # The default cleanup deletes ALL blocked XeroAttachmentSyncJob instances
  # except the oldest, treating per-tenant jobs as "duplicates" of each other.
  # With per-variant keys, each tenant's job is independent work, not a duplicate.
  def self.cleanup_duplicate_copies!(excluding_job_id: nil)
    # Group blocked executions by concurrency_key, keep 1 per key
    blocked = SolidQueue::BlockedExecution
      .joins(:job)
      .where(solid_queue_jobs: { class_name: name, finished_at: nil })

    blocked.group(:concurrency_key).having("COUNT(*) > 1").count.each do |key, _count|
      key_blocked_ids = SolidQueue::BlockedExecution
        .joins(:job)
        .where(concurrency_key: key)
        .where(solid_queue_jobs: { class_name: name, finished_at: nil })
        .order("solid_queue_jobs.id ASC")
        .pluck(:job_id)

      next if key_blocked_ids.size <= 1

      excess_ids = key_blocked_ids[1..] # Keep oldest per key, remove rest
      Rails.logger.info "[DeduplicatableJob] Clearing #{excess_ids.count} excess blocked #{name} job(s) for key #{key}"
      SolidQueue::BlockedExecution.where(job_id: excess_ids).delete_all
      SolidQueue::Job.where(id: excess_ids).update_all(finished_at: Time.current)
    end

    # Also clean duplicate ready copies (same as default)
    duplicates = SolidQueue::Job.where(finished_at: nil, class_name: name)
    duplicates = duplicates.where.not(id: excluding_job_id) if excluding_job_id
    ready_ids = SolidQueue::ReadyExecution.where(job_id: duplicates.select(:id)).pluck(:job_id)
    if ready_ids.count > 1
      # Keep oldest ready, remove rest
      excess_ready = ready_ids.sort[1..]
      Rails.logger.info "[DeduplicatableJob] Clearing #{excess_ready.count} duplicate ready #{name} job(s)"
      SolidQueue::ReadyExecution.where(job_id: excess_ready).delete_all
      SolidQueue::Job.where(id: excess_ready).update_all(finished_at: Time.current)
    end
  end

  # Xero rate limits (per tenant)
  MINUTE_LIMIT = 60
  DAILY_LIMIT = 5000
  # Leave headroom for other operations (contacts sync, health monitor, etc.)
  SAFE_MINUTE_LIMIT = 55
  SAFE_DAILY_LIMIT = 4800

  # FRC (Feb 2026): Reduced from 4 to 2 for memory safety.
  # Each concurrent download creates a Tempfile + S3 upload stream.
  # With 4 threads × multipart chunk buffers, memory spikes on the 1024MB dyno.
  # 2 threads still gives good throughput for IO-bound work while keeping
  # peak memory ~535MB (489MB headroom). 3 remaining Xero slots for webhooks/other.
  CONCURRENT_DOWNLOADS = 2

  # Memory threshold (MB) — if RSS exceeds this, force GC before next batch
  MEMORY_WARNING_MB = 800
  # Hard abort threshold — if RSS exceeds this after GC, stop processing
  MEMORY_ABORT_MB = 900

  # Per-tenant lock TTL (must exceed MAX_RUNTIME to prevent overlap)
  TENANT_LOCK_TTL = 12.minutes

  # Max runtime before yielding to scheduler (leaves 1 min before next scheduler run)
  MAX_RUNTIME_SECONDS = 9 * 60

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

      # Queue a job for this tenant with STAGGER to prevent simultaneous API hits
      # ⚠️ DO NOT REMOVE STAGGER - All orgs hitting Xero at once = all rate limited at once (Feb 2026)
      # 30 second gap between each tenant's job start = spread load across the minute
      stagger_delay = (scheduled_count * 30).seconds
      XeroAttachmentSyncJob.set(wait: stagger_delay).perform_later(nil, tenant_id: tenant_id, limit: options[:limit] || 50)
      scheduled_count += 1
      Rails.logger.info("[XeroAttachmentSync] Scheduled job for #{credential.tenant_name} in #{stagger_delay.to_i}s (#{remaining} remaining)")
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
      # FRC (Feb 2026): Loop within same job execution until rate limit or time limit.
      # Previously processed 50 invoices then exited (300/hr max). Now processes
      # continuous batches of 50 until Xero rate limit is exhausted (~1,500/hr).
      # Same pattern as UploadEmailsToStorageJob.
      started_at = Time.current
      total_results = { processed: 0, success: 0, failed: 0, errors: [], batches: 0 }

      # FRC (Feb 2026): Stall detection — prevents tight spin when all remaining
      # invoices are on cooldown or the already_synced subquery disagrees with the
      # sync service (e.g. WarehouseDocument exists but missing is_primary metadata).
      # Without this, the loop re-processes the same already-synced invoices at
      # hundreds of batches/sec, burning CPU and flooding logs.
      last_remaining = nil
      consecutive_stall = 0

      loop do
        # Time limit: stop before next scheduler run (leaves 2 min headroom)
        elapsed = Time.current - started_at
        if elapsed > MAX_RUNTIME_SECONDS
          Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: Time limit reached (#{elapsed.round}s), yielding")
          break
        end

        # FRC (Feb 2026): Sleep instead of break when hitting minute rate limit.
        # The minute limit (60/min) resets on a rolling window, so 30s sleep is enough.
        # The outer time limit (MAX_RUNTIME_SECONDS) still caps total runtime.
        if should_pause_for_rate_limit?(tenant_id)
          Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: Rate limit approaching, sleeping 30s for window to roll...")
          sleep(30)
          if should_pause_for_rate_limit?(tenant_id)
            Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: Still rate limited after sleep, pausing")
            break
          end
          Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: Rate limit cleared, resuming")
        end

        # ⚠️ MEMORY GUARD (Feb 2026): Check RSS before each batch.
        # On 1024MB Heroku dyno, R14 triggers at 1024MB. We stop early to prevent crash.
        rss = current_rss_mb
        if rss > MEMORY_WARNING_MB
          Rails.logger.warn("[XeroAttachmentSync] #{tenant_name}: Memory high (#{rss}MB > #{MEMORY_WARNING_MB}MB), forcing GC")
          GC.start(full_mark: true, immediate_sweep: true)
          rss = current_rss_mb
          if rss > MEMORY_ABORT_MB
            Rails.logger.error("[XeroAttachmentSync] #{tenant_name}: Memory still high after GC (#{rss}MB > #{MEMORY_ABORT_MB}MB), aborting")
            break
          end
          Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: GC freed memory to #{rss}MB, continuing")
        end

        batch_results = process_tenant_batch(tenant_id, options)
        total_results[:processed] += batch_results[:processed]
        total_results[:success] += batch_results[:success]
        total_results[:failed] += batch_results[:failed]
        total_results[:errors].concat(batch_results[:errors] || [])
        total_results[:batches] += 1

        # Hard lockout from Xero 429 — can't retry
        break if batch_results[:aborted_lockout]

        # FRC (Feb 2026): Only sleep for RATE LIMIT, not for "no invoices found".
        # Previously also slept on (processed == 0 && total > 0) which caught the
        # "all on cooldown" case — sleeping 30s doesn't help when cooldown is 30 min.
        if batch_results[:skipped_rate_limit]
          Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: Minute rate exhausted after #{total_results[:processed]} invoices, sleeping 30s...")
          sleep(30)
          next
        end

        # No invoices returned at all — genuinely no more work (or all on cooldown)
        break if batch_results[:processed] == 0

        # ════════════════════════════════════════════════════════════════════════
        # STALL DETECTION: Stop spinning when no real progress is being made
        # ════════════════════════════════════════════════════════════════════════
        # FRC (Feb 2026): When find_invoices_needing_pdfs and the sync service
        # disagree on "already synced" (e.g. missing is_primary metadata on old
        # WarehouseDocuments), the loop finds the same invoices every batch,
        # "processes" them (counted as success), but remaining count never drops.
        # Without stall detection this spins for 8 min doing nothing useful.
        current_remaining = count_remaining_invoices_for_tenant(tenant_id)
        if last_remaining && current_remaining >= last_remaining
          consecutive_stall += 1
          if consecutive_stall >= 3
            Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: Stalled — remaining stuck at #{current_remaining} for #{consecutive_stall} batches (all on cooldown or already synced), stopping")
            break
          end
        else
          consecutive_stall = 0
        end
        last_remaining = current_remaining

        Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: Batch #{total_results[:batches]} done (#{batch_results[:success]}/#{batch_results[:processed]}), #{current_remaining} remaining, continuing...")
      end

      # Update status
      remaining = count_remaining_invoices_for_tenant(tenant_id)
      XeroSyncStatus.complete_sync!(
        "pdfs",
        tenant_id: tenant_id,
        records_synced: total_results[:success],
        next_sync_at: 10.minutes.from_now
      )

      Rails.logger.info("[XeroAttachmentSync] #{tenant_name}: Total #{total_results[:success]}/#{total_results[:processed]} in #{total_results[:batches]} batches, #{remaining} remaining")

      total_results
    rescue XeroApiClient::RateLimitError => e
      retry_after = extract_retry_after(e.message)
      XeroRateLimitTracker.record_lockout!(retry_after, tenant_id: tenant_id)
      Rails.logger.warn("[XeroAttachmentSync] #{tenant_name}: Rate limited for #{retry_after}s")
      XeroSyncStatus.fail_sync!("pdfs", tenant_id: tenant_id, error: "Rate limited - retry in #{retry_after}s")
      { processed: 0, rate_limited: true, retry_after: retry_after }
    rescue XeroApiClient::AuthenticationError => e
      # FRC (Feb 2026): Mark credential as disconnected so scheduler stops queuing it.
      # Without this, a dead token wastes API calls and worker capacity every cycle.
      Rails.logger.warn("[XeroAttachmentSync] #{tenant_name}: Auth failed, marking disconnected")
      credential&.mark_disconnected!
      XeroSyncStatus.fail_sync!("pdfs", tenant_id: tenant_id, error: "Auth failed - credential disconnected")
      { processed: 0, auth_failed: true }
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

    # FRC (Feb 2026): Average API calls per invoice:
    # - Any type with HasAttachments=false: 1 (PDF download only, skip list attachments)
    # - Any type with HasAttachments=true: 2 (PDF download + list attachments)
    # - Bill with HasAttachments=false: ~0 (local DB only, no PDF, no attachments)
    # Weighted average ≈ 1.5. The per-request throttler (XeroRateLimitTracker)
    # handles actual pacing, so this is just for batch size estimation.
    api_calls_per_pdf = 2
    max_by_minute = (minute_remaining / api_calls_per_pdf).clamp(0, SAFE_MINUTE_LIMIT)
    max_by_daily = (daily_remaining / api_calls_per_pdf).clamp(0, 500)

    limit = [max_by_minute, max_by_daily, options[:limit] || 50].min

    if limit <= 0
      return { processed: 0, success: 0, failed: 0, skipped_rate_limit: true }
    end

    # FRC (Feb 2026): Fair batch splitting — invoices and bills each get half the limit.
    # Without this, invoices (priority 0, ordered first) monopolize the queue and
    # bills (priority 1) get starved. If one type has fewer than its half, the other
    # gets the remainder so no capacity is wasted.
    if options[:invoice_type].present?
      # Explicit type requested - use full limit
      invoices_array = find_invoices_needing_pdfs(limit, tenant_id, options[:invoice_type]).to_a
    else
      half = (limit / 2.0).ceil
      non_bills = find_invoices_needing_pdfs(half, tenant_id, :non_bill).to_a
      remainder_for_bills = limit - non_bills.length
      bills = remainder_for_bills > 0 ? find_invoices_needing_pdfs(remainder_for_bills, tenant_id, "bill").to_a : []

      # If bills didn't fill their share, give remainder back to non-bills
      if bills.length < remainder_for_bills && non_bills.length == half
        extra_non_bills = find_invoices_needing_pdfs(remainder_for_bills - bills.length, tenant_id, :non_bill)
                            .where.not(id: non_bills.map(&:id)).to_a
        non_bills += extra_non_bills
      end

      invoices_array = non_bills + bills
    end

    results = { processed: 0, success: 0, failed: 0, errors: [] }

    # FRC (Feb 2026): Process PDFs concurrently using threads.
    # Xero allows 5 concurrent API calls per org — we use CONCURRENT_DOWNLOADS (4).
    # Ruby threads are ideal for IO-bound work (HTTP calls to Xero API).
    # Each thread gets its own DB connection via connection_pool.with_connection.
    # Source: https://developer.xero.com/faq/limits
    invoices_array.each_slice(CONCURRENT_DOWNLOADS) do |batch|
      break if should_pause_for_rate_limit?(tenant_id)

      # Spawn threads for concurrent downloads
      threads = batch.map do |invoice|
        Thread.new(invoice) do |inv|
          ActiveRecord::Base.connection_pool.with_connection do
            begin
              service = XeroAttachmentSyncService.new(inv)
              result = service.sync!
              { invoice_id: inv.id, result: result, error: nil }
            rescue XeroApiClient::RateLimitError => e
              { invoice_id: inv.id, result: nil, error: e, rate_limited: true }
            rescue StandardError => e
              Rails.logger.error("[XeroAttachmentSync] Invoice #{inv.id} failed: #{e.message}")
              { invoice_id: inv.id, result: nil, error: e }
            end
          end
        end
      end

      # Wait for all threads in this batch to complete
      thread_results = threads.map(&:value)

      # Collect results (back on main thread — no concurrency issues)
      thread_results.each do |tr|
        results[:processed] += 1

        if tr[:rate_limited]
          # Re-raise so sync_tenant records the lockout and stops
          raise tr[:error]
        elsif tr[:error]
          results[:failed] += 1
          results[:errors] << { invoice_id: tr[:invoice_id], errors: [tr[:error].message] }
          # FRC (Feb 2026): Put failed invoices on cooldown so they don't block the queue.
          # Without this, the same timing-out invoices sit at the front of the queue
          # (ordered by id ASC) and prevent newer invoices from being processed.
          add_to_cooldown!(tenant_id, tr[:invoice_id])
        elsif tr[:result][:errors].any?
          results[:failed] += 1
          results[:errors] << { invoice_id: tr[:invoice_id], errors: tr[:result][:errors] }
          add_to_cooldown!(tenant_id, tr[:invoice_id])
        else
          results[:success] += 1
          clear_cooldown!(tenant_id, tr[:invoice_id])
        end
      end

      # ⚠️ MEMORY-SAFE (Feb 2026): Nil out references and GC between thread batches.
      # Without this, completed thread objects and their closures (holding Tempfile refs,
      # service instances, API response data) accumulate across all 13+ batches.
      # GC.start is ~10-50ms — negligible compared to 0.3s sleep below.
      threads = nil
      thread_results = nil

      # Brief pause between batches to avoid burst-hammering Xero
      sleep(0.3)

      # Periodic GC every 3 batches to prevent memory creep
      if results[:processed] > 0 && results[:processed] % (CONCURRENT_DOWNLOADS * 3) == 0
        GC.start
      end
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
    # ⚠️ DO NOT use .pluck() here - it loads ALL synced IDs into Ruby memory (Feb 2026)
    # Use a SQL subquery instead to keep filtering in PostgreSQL
    #
    # FRC (Feb 2026): Two definitions of "already synced":
    # 1. Invoices/quotes/credit notes: WarehouseDocument with storage_blob (has actual PDF)
    # 2. Bills: WarehouseDocument with is_bill_record metadata (no auto-PDF, just a record)
    #
    # ⚠️ DO NOT SIMPLIFY to just "WarehouseDocument exists" — that would skip invoices
    # where the WarehouseDocument was created but PDF download failed (storage_blob_id nil).
    # Those invoices SHOULD be retried. Bills should NOT (they never get a blob).
    #
    # FRC (Feb 2026): DO NOT require is_primary metadata — some WarehouseDocuments
    # were created without it (older sync versions, attachment-only docs). The sync
    # service (XeroAttachmentSyncService) checks `find_by(documentable:, source_type:)`
    # WITHOUT is_primary. If the subquery here is stricter than the service, the same
    # invoice gets "found" by the query, "skipped" by the service, and loops forever.
    # SSoT: Match the service's definition of "already synced".
    already_synced_subquery = WarehouseDocument
      .where(source_type: "xero")
      .where(documentable_type: "ExternalInvoice")
      .where("storage_blob_id IS NOT NULL OR metadata->>'is_bill_record' = 'true'")
      .select(:documentable_id)

    # FRC (Feb 2026): Invoice types and their PDF availability:
    # - sales_invoice: Xero auto-generates PDF when approved/sent/paid
    # - quote: Xero auto-generates PDF when sent
    # - credit_note: Xero auto-generates PDF
    # - bill: NO auto-generated PDF, BUT can have supplier-uploaded attachments
    # - draft: No PDF until invoice is approved
    #
    # Bills ARE included - they don't have auto-PDFs but can have attachments.
    # The sync service handles this by skipping PDF download for bills.
    # FRC (Feb 2026): Order matters — process invoices/quotes/credit notes FIRST
    # (they have actual Xero-generated PDFs), then bills (only have attachments).
    # Without ordering, bills could monopolize the per-cycle limit.
    query = ExternalInvoice
      .active
      .where.not(status: "draft")       # Draft invoices have no PDF
      .where.not(external_id: nil)
      .where.not(tenant_id: nil)
      .where.not(contact_id: nil)
      .where("external_invoices.id NOT IN (?)", already_synced_subquery)
      # FRC (Feb 2026): Randomize within each type priority so different invoices are
      # attempted each run. Previously .order(..., id) meant the same failing invoices
      # sat at the front of the queue even after cooldown expired.
      .order(Arel.sql("CASE WHEN invoice_type = 'bill' THEN 1 ELSE 0 END, RANDOM()"))
      .limit(limit)

    if xero_tenant_id.present?
      contact_ids_for_xero_org = ContactExternalLink
        .where(source: "xero", xero_org_id: xero_tenant_id)
        .select(:contact_id)
      query = query.where(contact_id: contact_ids_for_xero_org)

      # FRC (Feb 2026): Exclude invoices on cooldown (recently failed PDF sync).
      # Without this, the same timing-out invoices block the front of the queue
      # and prevent newer invoices from being processed.
      cooldown_ids = get_cooldown_ids(xero_tenant_id)
      query = query.where.not(id: cooldown_ids) if cooldown_ids.any?
    end

    # FRC (Feb 2026): Support :non_bill filter for fair batch splitting
    if invoice_type == :non_bill
      query = query.where.not(invoice_type: "bill")
    elsif invoice_type.present?
      query = query.where(invoice_type: invoice_type)
    end

    query
  end

  def count_remaining_invoices_for_tenant(xero_tenant_id)
    return 0 unless xero_tenant_id.present?

    # ⚠️ DO NOT use .pluck() here - keeps all IDs in Ruby memory (Feb 2026)
    # FRC (Feb 2026): Must match find_invoices_needing_pdfs subquery EXACTLY
    # SSoT: Both subqueries use the same definition — no is_primary check
    already_synced_subquery = WarehouseDocument
      .where(source_type: "xero")
      .where(documentable_type: "ExternalInvoice")
      .where("storage_blob_id IS NOT NULL OR metadata->>'is_bill_record' = 'true'")
      .select(:documentable_id)

    contact_ids_subquery = ContactExternalLink
      .where(source: "xero", xero_org_id: xero_tenant_id)
      .select(:contact_id)

    # FRC (Feb 2026): Must match find_invoices_needing_pdfs filters
    # Bills included - no auto-PDF but can have supplier attachments
    ExternalInvoice
      .active
      .where.not(status: "draft")       # Draft invoices have no PDF
      .where("external_invoices.contact_id IN (?)", contact_ids_subquery)
      .where.not(external_id: nil)
      .where.not(tenant_id: nil)
      .where.not(contact_id: nil)
      .where("external_invoices.id NOT IN (?)", already_synced_subquery)
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

  # SSoT: extract_retry_after now in XeroJobBase concern

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

  # ════════════════════════════════════════════════════════════════════════════
  # COOLDOWN: Temporarily skip invoices that recently failed PDF sync
  # ════════════════════════════════════════════════════════════════════════════
  # FRC (Feb 2026): Without cooldown, the same timing-out invoices sit at the
  # front of the queue (ordered by id ASC) and block bills from being processed.
  # Cooldown puts them aside for 30 min so the queue can make progress.

  COOLDOWN_TTL = 30.minutes

  def cooldown_key(tenant_id, invoice_id)
    "xero:attachment_sync:cooldown:#{tenant_id}:#{invoice_id}"
  end

  def cooldown_set_key(tenant_id)
    "xero:attachment_sync:cooldown_set:#{tenant_id}"
  end

  def add_to_cooldown!(tenant_id, invoice_id)
    # Individual key for TTL-based expiry
    Rails.cache.write(cooldown_key(tenant_id, invoice_id), true, expires_in: COOLDOWN_TTL)

    # Maintain a set of cooled-down IDs for bulk lookup
    set = Rails.cache.read(cooldown_set_key(tenant_id)) || []
    set = (set + [invoice_id]).uniq
    Rails.cache.write(cooldown_set_key(tenant_id), set, expires_in: COOLDOWN_TTL)
  end

  def clear_cooldown!(tenant_id, invoice_id)
    Rails.cache.delete(cooldown_key(tenant_id, invoice_id))

    set = Rails.cache.read(cooldown_set_key(tenant_id)) || []
    set.delete(invoice_id)
    if set.any?
      Rails.cache.write(cooldown_set_key(tenant_id), set, expires_in: COOLDOWN_TTL)
    else
      Rails.cache.delete(cooldown_set_key(tenant_id))
    end
  end

  def get_cooldown_ids(tenant_id)
    set = Rails.cache.read(cooldown_set_key(tenant_id)) || []
    # Validate each ID is still in cooldown (individual keys may have expired)
    active = set.select { |id| Rails.cache.read(cooldown_key(tenant_id, id)) }

    # Clean up stale entries from the set
    if active.length != set.length
      if active.any?
        Rails.cache.write(cooldown_set_key(tenant_id), active, expires_in: COOLDOWN_TTL)
      else
        Rails.cache.delete(cooldown_set_key(tenant_id))
      end
    end

    # FRC (Feb 2026): Throttle log — only log once per 60s per tenant to avoid
    # flooding logs when fair batch splitting calls this twice per batch iteration.
    if active.any?
      throttle_key = "xero:cooldown_log:#{tenant_id}"
      unless Rails.cache.read(throttle_key)
        Rails.logger.info("[XeroAttachmentSync] Excluding #{active.length} cooled-down invoices for #{tenant_id[0..7]}")
        Rails.cache.write(throttle_key, true, expires_in: 60.seconds)
      end
    end

    active
  end

  # ════════════════════════════════════════════════════════════════════════════
  # MEMORY MONITORING
  # ════════════════════════════════════════════════════════════════════════════

  # Get current RSS (Resident Set Size) in MB.
  # Linux (Heroku): reads /proc/self/status (instant, no subprocess).
  # macOS (dev): falls back to `ps` command.
  # Returns 0 on error (fail-open: never block processing due to monitoring failure).
  def current_rss_mb
    if File.exist?("/proc/self/status")
      # Linux (Heroku): Parse VmRSS from /proc/self/status — no subprocess needed
      status = File.read("/proc/self/status")
      match = status.match(/VmRSS:\s+(\d+)\s+kB/)
      return match[1].to_i / 1024 if match
    end

    # macOS fallback: use ps command
    `ps -o rss= -p #{Process.pid}`.strip.to_i / 1024
  rescue StandardError
    0
  end
end
