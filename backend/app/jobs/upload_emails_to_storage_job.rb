# frozen_string_literal: true

# UploadEmailsToStorageJob - Background job to upload emails to current storage provider
#
# Uploads email .eml files from Microsoft Graph API to the configured storage provider
# (Wasabi/S3 or SharePoint). Uses parallel processing for S3-compatible providers.
#
# Usage:
#   UploadEmailsToStorageJob.perform_later(batch_size: 1000)  # Specific batch
#   UploadEmailsToStorageJob.perform_later                    # All missing emails (all tenants)
#   UploadEmailsToStorageJob.perform_later(tenant_id: 2)      # Specific tenant
#
# Progress tracking:
#   - Creates BackgroundJobProgress record for UI monitoring
#   - Visible in File Warehouse under background jobs
#
# FRC (Jan 2026): When no tenant_id specified, processes ALL tenants with pending emails.
# This prevents silent failures when Tenant.first doesn't have emails (e.g., TEEEM vs Tekna).
#
# ⚠️ DO NOT SIMPLIFY - Auto-continue loop replaced perform_later chain (Feb 2026)
# ════════════════════════════════════════════
# Why: Chaining perform_later from within a running job would create a second
#      instance while the current one is still executing. DeduplicatableJob
#      (now before_perform) would skip it since the current job is still claimed.
# ❌ WRONG: UploadEmailsToStorageJob.set(wait: 5.seconds).perform_later(...)
#           → DeduplicatableJob sees current job running → skips → chain breaks
# ✅ CORRECT: Loop within same job execution with time limit (10 min max for Heroku)
# ════════════════════════════════════════════
class UploadEmailsToStorageJob < ApplicationJob
  include DeduplicatableJob

  # FRC (Feb 2026): Moved to :email_enrichment so it runs on the EMAIL WORKER,
  # not the shared worker. This job downloads email MIME content from Microsoft
  # Graph API — that's email work. On the shared worker (1 thread, 1GB) it
  # monopolized the thread for 10 min and caused R14 from MIME content in memory.
  # Email worker has 2 threads and its own 1GB budget.
  # CRITICAL: recurring.yml queue setting OVERRIDES this — must match there too.
  queue_as :email_enrichment

  # Max runtime before yielding back to the scheduler.
  # FRC (Feb 2026): Reduced from 10min to 3min. Now runs on email worker (1 thread)
  # shared with sync + enrichment. 10min monopolized the thread, starving email sync.
  # 3min × batch_size 25 ≈ 4-5 batches = 100-125 emails per run. Runs every 10min,
  # so throughput = ~750/hour — enough for backfill without starving other email jobs.
  MAX_RUNTIME_SECONDS = 3 * 60  # 3 minutes

  # Memory guard: stop processing if THIS PROCESS (Worker) VmRSS exceeds this (MB)
  # Heroku's container-level metric is inaccessible from within (no cgroup usage files).
  # ps -eo rss= and /proc/[pid]/statm both double-count COW pages from SolidQueue forks.
  # Instead, we monitor just the Worker process (where jobs run) via /proc/self/status.
  # Worker baseline: ~350-400MB. Other processes (Supervisor, Dispatcher, Scheduler): ~300-400MB.
  # At Worker=550MB, total dyno ≈ 850-950MB (safe, under 1024MB R14 threshold).
  MEMORY_ABORT_MB = 550

  # Hard cap on batch_size regardless of what's passed in job args.
  # FRC (Feb 2026): Stale SolidQueue jobs with batch_size=200 survived deploys,
  # fetching 200 emails' MIME content into memory at once → R14 on 1024MB dyno.
  # Reduced to 25: Worker at 352MB baseline + 50 emails adds ~200MB = 988MB total → R14.
  # With 25 emails: ~100MB spike → ~860MB total (under 1024MB).
  MAX_BATCH_SIZE = 25

  def perform(batch_size: nil, tenant_id: nil)
    @started_at = Time.current
    batch_size = [batch_size, MAX_BATCH_SIZE].min if batch_size

    # If tenant specified, process just that tenant
    if tenant_id
      tenant = ActsAsTenant.without_tenant { Tenant.find(tenant_id) }
      process_tenant(tenant, batch_size: batch_size)
    else
      # FRC (Jan 2026): Process ALL tenants with pending emails
      # Previously used Tenant.first which caused silent failures when emails were in different tenant
      process_all_tenants(batch_size: batch_size)
    end
  end

  private

  def time_remaining?
    (Time.current - @started_at) < MAX_RUNTIME_SECONDS
  end

  # ⚠️ DO NOT SIMPLIFY - Must read Worker process VmRSS only (Feb 2026)
  # ════════════════════════════════════════════
  # Why: Heroku exposes NO container-level memory metrics from within the dyno.
  # - cgroup memory.usage_in_bytes → doesn't exist on Heroku
  # - `ps -eo rss=` → double-counts COW pages across SolidQueue forks (1261MB vs real 700MB)
  # - /proc/[pid]/statm → only deduplicates file-backed pages, not COW (1207MB vs 700MB)
  # ✅ CORRECT: /proc/self/status VmRSS → Worker process only, with per-process threshold
  # The Worker process is where blob downloads happen. Other SolidQueue processes
  # (Supervisor, Dispatcher, Scheduler) add ~300-400MB constant overhead.
  # MEMORY_ABORT_MB is calibrated for the Worker process alone (550MB).
  # At Worker=550MB, total dyno ≈ 850-950MB, safely under 1024MB R14 threshold.
  # ════════════════════════════════════════════
  def current_rss_mb
    File.read("/proc/self/status").match(/VmRSS:\s+(\d+)\s+kB/)[1].to_i / 1024
  rescue StandardError
    0
  end

  def process_all_tenants(batch_size:)
    # Find tenants that have emails needing sync — SSoT scope
    tenant_ids_with_pending = SyncedEmail.unscoped.pending_storage_upload
      .distinct
      .pluck(:tenant_id)
      .compact

    if tenant_ids_with_pending.empty?
      Rails.logger.info "[UploadEmailsToStorageJob] No tenants have pending emails"
      return { uploaded: 0, skipped: 0, tenants_processed: 0 }
    end

    Rails.logger.info "[UploadEmailsToStorageJob] Found #{tenant_ids_with_pending.count} tenant(s) with pending emails: #{tenant_ids_with_pending.inspect}"

    results = { uploaded: 0, skipped: 0, errors: [], tenants_processed: 0 }

    tenant_ids_with_pending.each do |tid|
      break unless time_remaining?

      # Unscoped find to avoid acts_as_tenant adding WHERE tenants."true"
      tenant = ActsAsTenant.without_tenant { Tenant.find(tid) }
      result = process_tenant(tenant, batch_size: batch_size)
      results[:uploaded] += result[:uploaded].to_i
      results[:skipped] += result[:skipped].to_i
      results[:errors].concat(result[:errors] || [])
      results[:tenants_processed] += 1
    end

    results
  end

  def process_tenant(tenant, batch_size:)
    progress = nil
    Rails.logger.info "[UploadEmailsToStorageJob] Processing tenant #{tenant.id} (#{tenant.name})"

    # ⚠️ DO NOT SIMPLIFY - BackgroundJobProgress MUST be created outside tenant scope (Feb 2026)
    # ════════════════════════════════════════════════════════════════════
    # Why: BackgroundJobProgress has no tenant_id column. When created/updated inside
    # ActsAsTenant.with_tenant, acts_as_tenant adds WHERE ""=$1 (empty column name)
    # causing PG::SyntaxError and MissingAttributeError.
    # ════════════════════════════════════════════════════════════════════
    progress = ActsAsTenant.without_tenant do
      BackgroundJobProgress.start(
        job_type: "email_storage_upload",
        metadata: { batch_size: batch_size, tenant_id: tenant.id }
      )
    end

    ActsAsTenant.with_tenant(tenant) do

      total_uploaded = 0
      total_skipped = 0
      total_errors = []
      batch_number = 0
      consecutive_zero_batches = 0

      # Loop within same job execution instead of chaining perform_later
      # (DeduplicatableJob blocks chained jobs since current job is still running)
      loop do
        batch_number += 1

        # Pre-batch memory check: don't start a new batch if already high
        rss = current_rss_mb
        if rss > MEMORY_ABORT_MB
          Rails.logger.warn "[UploadEmailsToStorageJob] Memory already high before batch #{batch_number} (#{rss}MB > #{MEMORY_ABORT_MB}MB), yielding"
          break
        end

        Rails.logger.info "[UploadEmailsToStorageJob] Batch #{batch_number} (batch_size: #{batch_size || 'all'}, rss: #{rss}MB) for tenant #{tenant.id}"

        service = EmailStorageUploadService.new(progress: progress, tenant: tenant)
        result = service.upload_missing_emails(batch_size: batch_size)

        uploaded = result[:uploaded].to_i
        skipped = result[:skipped].to_i
        errors = result[:errors] || []

        total_uploaded += uploaded
        total_skipped += skipped
        total_errors.concat(errors)

        Rails.logger.info "[UploadEmailsToStorageJob] Batch #{batch_number}: uploaded=#{uploaded}, skipped=#{skipped}, errors=#{errors.count}"

        # Stop conditions:
        # 1. No batch_size → processed everything in one go
        break unless batch_size.present?

        # 2. No uploads this batch → no forward progress.
        # ⚠️ DO NOT SIMPLIFY - This MUST break on uploaded==0 regardless of skipped/errors (Feb 2026)
        # ════════════════════════════════════════════
        # Why: When remaining emails are all unfetchable (no Graph credential, expired tokens,
        # content_unavailable not yet set), they get "skipped" every batch. Without this guard,
        # the loop runs 300-400+ iterations finding the same emails, skipping them, and repeating.
        # Each iteration creates service objects + DB queries → garbage accumulates → R14.
        # Observed: Batch 382+ with uploaded=0, skipped=4, errors=0 on every iteration.
        # ❌ WRONG: break if uploaded == 0 && skipped == 0 (misses skipped-only case)
        # ✅ CORRECT: Break if uploaded == 0 after allowing 3 retries for transient failures
        # ════════════════════════════════════════════
        if uploaded == 0
          consecutive_zero_batches += 1
          if consecutive_zero_batches >= 3
            Rails.logger.warn "[UploadEmailsToStorageJob] No progress for #{consecutive_zero_batches} consecutive batches (skipped=#{skipped}, errors=#{errors.count}), stopping"
            break
          end
          Rails.logger.info "[UploadEmailsToStorageJob] Zero uploads batch #{consecutive_zero_batches}/3, trying next batch..."
        else
          consecutive_zero_batches = 0  # Reset on any successful upload
        end

        # 4. Time limit reached
        unless time_remaining?
          Rails.logger.info "[UploadEmailsToStorageJob] Time limit reached (#{MAX_RUNTIME_SECONDS}s), yielding to scheduler"
          break
        end

        # 4b. Memory guard: force GC between batches and abort if too high.
        # Each batch downloads 50+ emails' MIME content (~10-40MB) which
        # accumulates faster than Ruby's GC collects across a 10-min run.
        GC.start
        rss = current_rss_mb
        if rss > MEMORY_ABORT_MB
          Rails.logger.warn "[UploadEmailsToStorageJob] Memory high after GC (#{rss}MB > #{MEMORY_ABORT_MB}MB), yielding to scheduler"
          break
        end

        # 5. Check if there are actually more processable emails — SSoT scope
        remaining = SyncedEmail.pending_storage_upload.count

        if remaining == 0
          Rails.logger.info "[UploadEmailsToStorageJob] All processable emails migrated for tenant #{tenant.id}!"
          break
        end

        Rails.logger.info "[UploadEmailsToStorageJob] #{remaining} emails remaining, continuing..."
      end

      Rails.logger.info "[UploadEmailsToStorageJob] Total for tenant #{tenant.id}: uploaded=#{total_uploaded}, skipped=#{total_skipped}, errors=#{total_errors.count}, batches=#{batch_number}"

      { uploaded: total_uploaded, skipped: total_skipped, errors: total_errors }
    end  # ActsAsTenant.with_tenant
  rescue StandardError => e
    Rails.logger.error "[UploadEmailsToStorageJob] Failed for tenant #{tenant&.id}: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
    progress&.fail!(message: e.message)
    # Return error result instead of raising, so other tenants can still be processed
    { uploaded: 0, skipped: 0, errors: [{ tenant_id: tenant&.id, error: e.message }] }
  end
end
