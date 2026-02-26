# frozen_string_literal: true

# QueueStatusCacheJob - Offloads queue_status computation from web dyno
#
# Problem: The /api/v1/system/queue_status endpoint ran 59 queries in 4.7s
# every 60s poll, all on the web dyno (448/512 MB). This bloated memory
# with PLUCKed arrays and object allocations.
#
# Solution: This job runs on the shared worker (1024 MB, currently ~91 MB)
# every 30 seconds, writing the full response payload to Rails.cache.
# The web endpoint becomes a single cache read (~0 queries, <50ms).
#
# Optimizations vs original controller code:
# - compute_throughput_history: 12 queries → 1 SQL with date_trunc GROUP BY
# - compute_backlog: PLUCK → subquery (avoids loading 100k+ IDs into memory)
# - auto_clear_stale_failures: moved here (DELETE doesn't belong on GET)
# - Single HerokuPlatformService.infrastructure call shared across methods
class QueueStatusCacheJob < ApplicationJob
  include DeduplicatableJob
  include CacheConstants

  CACHE_KEY = "system:queue_status"

  queue_as :default

  def perform
    start_time = Time.current

    # Auto-clear stale failed jobs (>24h old) - moved from GET endpoint
    auto_clear_stale_failures

    payload = compute_full_payload

    # Write with 2-minute TTL (job runs every 30s, so cache is always fresh)
    # If job stops, cache expires in 2 min and web endpoint falls back to inline
    Rails.cache.write(CACHE_KEY, payload, expires_in: CACHE_TTL_SHORT)

    elapsed = ((Time.current - start_time) * 1000).round(0)
    Rails.logger.info("[QueueStatusCacheJob] Cached queue_status in #{elapsed}ms")
  rescue StandardError => e
    Rails.logger.error("[QueueStatusCacheJob] Error: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    # Don't re-raise - stale cache is better than no cache
  end

  private

  def compute_full_payload
    alive_cutoff = 5.minutes.ago

    # Shared Heroku API call (used by both dynos and worker_apps)
    @heroku_infra = fetch_heroku_infrastructure

    # 1. Process breakdown by kind
    processes_raw = SolidQueue::Process
      .where("last_heartbeat_at > ?", alive_cutoff)
      .pluck(:id, :kind, :last_heartbeat_at, :hostname)

    alive_process_ids = processes_raw.map { |id, _, _, _| id }

    processes = processes_raw
      .group_by { |_, kind, _, _| kind }
      .transform_values { |rows| { count: rows.size, latestHeartbeat: rows.map { |_, _, hb, _| hb }.max&.iso8601 } }

    worker_count = processes.dig("Worker", :count) || 0

    # 2. Execution counts
    pending = SolidQueue::ReadyExecution.count
    running = alive_process_ids.any? ?
      SolidQueue::ClaimedExecution.where(process_id: alive_process_ids).count : 0
    failed = SolidQueue::FailedExecution.count
    scheduled = SolidQueue::ScheduledExecution.count
    blocked = SolidQueue::BlockedExecution.count

    # 3. Throughput (last 5 min)
    recent_completed = SolidQueue::Job.where("finished_at > ?", 5.minutes.ago).count
    completed_per_min = (recent_completed / 5.0).round(1)

    trend = compute_trend(running, pending, completed_per_min)

    # 4. Smart status
    status_result = compute_queue_status(
      worker_count: worker_count, pending: pending, running: running,
      failed: failed, trend: trend
    )

    # 5. Queue depth by queue
    queue_depth = SolidQueue::ReadyExecution
      .joins(:job)
      .group("solid_queue_jobs.queue_name")
      .count
      .map { |queue, count| { queue: queue, count: count } }
      .sort_by { |q| -q[:count] }

    # 6. Paused queues
    paused_queues = SolidQueue::Pause.pluck(:queue_name)

    # 7. Top failed (only if failed > 0)
    top_failed = if failed > 0
      SolidQueue::FailedExecution
        .joins(:job)
        .select("solid_queue_jobs.class_name, COUNT(*) as count")
        .group("solid_queue_jobs.class_name")
        .order("count DESC")
        .limit(5)
        .map { |r| { className: r.class_name.delete_suffix("Job"), count: r.count } }
    else
      []
    end

    # 8-13. Heavier computations
    {
      status: status_result[:level],
      statusMessage: status_result[:message],
      processes: processes,
      pending: pending,
      running: running,
      failed: failed,
      scheduled: scheduled,
      blocked: blocked,
      completedPerMin: completed_per_min,
      trend: trend,
      queueDepth: queue_depth,
      pausedQueues: paused_queues,
      topFailed: top_failed,
      watchdog: WorkerWatchdog.last_status.slice(:status, :last_heartbeat, :staleness_seconds, :circuit_breaker),
      backlog: compute_backlog,
      dbConnections: compute_db_connections,
      memory: compute_memory_usage,
      uptime: compute_uptime,
      xeroRateLimits: compute_xero_rate_limits,
      throughputHistory: compute_throughput_history,
      dynos: compute_worker_dynos,
      threadCapacity: compute_thread_capacity(processes_raw, alive_cutoff),
      workerApps: compute_worker_apps(processes_raw, alive_cutoff)
    }
  end

  def compute_trend(running, pending, completed_per_min)
    if running == 0 && pending == 0
      "idle"
    elsif running > 0 && (pending < 50 || completed_per_min > 0)
      pending > 100 ? "draining" : "idle"
    elsif pending > 50 && running == 0
      "stuck"
    else
      "stable"
    end
  end

  def compute_queue_status(worker_count:, pending:, running:, failed:, trend:)
    if worker_count == 0
      return { level: "error", message: "No workers running" }
    end

    if trend == "stuck"
      return { level: "error", message: "Queue stuck - #{pending} pending, none running" }
    end

    if failed > 50
      return { level: "degraded", message: "#{failed} jobs retrying - auto-clears in 24h" }
    end

    if pending > 50 && running > 0
      return { level: "busy", message: "Processing - #{running} running, #{pending} queued" }
    end

    if failed > 10
      return { level: "busy", message: "#{failed} jobs retrying" }
    end

    if running > 0
      msg = worker_count > 0 ? "#{worker_count} workers, #{running} running" : "#{running} jobs running"
    else
      msg = worker_count > 0 ? "#{worker_count} workers, idle" : "Idle"
    end
    { level: "healthy", message: msg }
  end

  def auto_clear_stale_failures
    cutoff = 24.hours.ago
    stale = SolidQueue::FailedExecution.where("created_at < ?", cutoff)
    count = stale.count
    if count > 0
      stale.delete_all
      Rails.logger.info("[QueueStatusCacheJob] Auto-cleared #{count} stale failed jobs (>24h old)")
    end
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] auto_clear_stale_failures failed: #{e.message}")
  end

  # Optimized: 12 queries → 1 SQL with date_trunc GROUP BY
  def compute_throughput_history
    now = Time.current
    start_time = now - 60.minutes

    # Single query: group finished jobs into 5-minute buckets
    rows = SolidQueue::Job
      .where("finished_at >= ?", start_time)
      .where("finished_at <= ?", now)
      .group("date_trunc('minute', finished_at) - (EXTRACT(minute FROM finished_at)::int % 5) * interval '1 minute'")
      .count

    # Build 12 buckets (0, 5, 10, ... 55 minutes ago)
    12.times.map do |i|
      bucket_end = now - (i * 5).minutes
      bucket_start = bucket_end - 5.minutes
      # Find matching rows within this bucket
      count = rows.select { |ts, _| ts >= bucket_start && ts < bucket_end }.values.sum
      { minutesAgo: i * 5, count: count }
    end.reverse
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] compute_throughput_history failed: #{e.message}")
    []
  end

  # Optimized: PLUCK → subquery (avoids loading 100k+ IDs into memory)
  def compute_backlog
    items = []

    # Email Bodies — SSoT: SyncedEmail.pending_storage_upload scope
    # FRC (Feb 2026): Previously used WarehouseDocument+verified blob check which diverged
    # from the upload job's actual query (storage_path check). Now all three locations
    # (popup, dashboard, upload job) use the same SSoT scope.
    email_missing = SyncedEmail.unscoped.pending_storage_upload.count
    imap_missing = SyncedEmail.unscoped.pending_imap_upload.count
    total_email_missing = email_missing + imap_missing
    items << { key: "email_uploads", label: "Email uploads", remaining: total_email_missing } if total_email_missing > 0

    # Xero Invoices
    if defined?(ExternalInvoice)
      xero_total = ExternalInvoice.where.not(status: "draft").where.not(contact_id: nil).count
      if xero_total > 0
        xero_with_file = WarehouseDocument
          .where(source_type: "xero")
          .joins(:storage_blob)
          .where("storage_blobs.verified_at IS NOT NULL")
          .count
        # Bills don't have auto-generated PDFs - exclude from "remaining" count
        xero_bills_processed = WarehouseDocument
          .where(source_type: "xero", documentable_type: "ExternalInvoice", storage_blob_id: nil)
          .where("warehouse_documents.metadata->>'is_bill_record' = 'true'")
          .count
        xero_missing = [xero_total - xero_with_file - xero_bills_processed, 0].max
        # Show row if PDFs remaining OR bills were processed (so user sees progress)
        if xero_missing > 0 || xero_bills_processed > 0
          items << { key: "xero_invoices", label: "Xero invoices", remaining: xero_missing, bills_processed: xero_bills_processed }
        end
      end
    end

    # Xero contacts pending review
    xero_pending = if MvXeroSyncStat.available?
      MvXeroSyncStat.sum(:pending_review).to_i
    else
      0
    end
    items << { key: "xero_contacts", label: "Xero contacts pending", remaining: xero_pending } if xero_pending > 0

    # Xero active sync sessions
    xero_active = XeroSyncSession.active.count
    items << { key: "xero_sync", label: "Xero sync sessions", remaining: xero_active } if xero_active > 0

    items
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] compute_backlog failed: #{e.message}")
    []
  end

  def compute_db_connections
    active = ActiveRecord::Base.connection.execute(
      "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
    ).first["count"].to_i
    max = ActiveRecord::Base.connection.execute(
      "SHOW max_connections"
    ).first["max_connections"].to_i
    { active: active, max: max }
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] compute_db_connections failed: #{e.message}")
    nil
  end

  def compute_memory_usage
    rss_kb = `ps -o rss= -p #{Process.pid}`.strip.to_i
    used_mb = rss_kb / 1024
    max_mb = ENV.fetch("DYNO_MEMORY_MB", 1024).to_i
    { usedMb: used_mb, maxMb: max_mb }
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] compute_memory_usage failed: #{e.message}")
    nil
  end

  # Boot time for the worker process running this job
  def compute_uptime
    # Use the SolidQueue process's own boot time if available, else fallback
    uptime_seconds = (Time.current - process_boot_time).to_i
    {
      bootedAt: process_boot_time.iso8601,
      uptimeSeconds: uptime_seconds,
      uptimeHuman: humanize_duration(uptime_seconds)
    }
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] compute_uptime failed: #{e.message}")
    nil
  end

  def process_boot_time
    @process_boot_time ||= begin
      # Try to get the oldest alive SolidQueue::Process boot time for consistency
      oldest = SolidQueue::Process.order(:created_at).first
      oldest&.created_at || Time.current
    end
  end

  def humanize_duration(seconds)
    days = seconds / 86400
    hours = (seconds % 86400) / 3600
    mins = (seconds % 3600) / 60
    parts = []
    parts << "#{days}d" if days > 0
    parts << "#{hours}h" if hours > 0
    parts << "#{mins}m" if mins > 0
    parts.empty? ? "<1m" : parts.join(" ")
  end

  def compute_xero_rate_limits
    credentials = XeroCredential.where(status: %w[connected degraded])
    credentials.map do |cred|
      lockout = XeroRateLimitTracker.current_lockout(tenant_id: cred.tenant_id)
      remaining_s = lockout ? XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: cred.tenant_id) : 0
      usage = XeroRateLimitTracker.usage_for(cred.tenant_id)

      org = cred.organization
      invoice_count = org ? ExternalInvoice.where(organization_id: org.id).count : 0
      synced_count = org ? WarehouseDocument.where(source_type: "xero")
        .joins("JOIN external_invoices ON external_invoices.id = warehouse_documents.documentable_id AND warehouse_documents.documentable_type = 'ExternalInvoice'")
        .where("external_invoices.organization_id = ?", org.id)
        .joins(:storage_blob)
        .where("storage_blobs.verified_at IS NOT NULL")
        .count : 0

      {
        tenantName: cred.tenant_name,
        lockedOut: lockout.present?,
        remainingSeconds: remaining_s,
        lockedUntil: lockout&.dig(:locked_until),
        dailyUsed: usage&.dig(:daily, :used) || 0,
        dailyLimit: usage&.dig(:daily, :limit) || 5000,
        minuteUsed: usage&.dig(:minute, :used) || 0,
        invoiceCount: invoice_count,
        syncedCount: synced_count
      }
    end.sort_by { |o| o[:lockedOut] ? 1 : 0 }
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] compute_xero_rate_limits failed: #{e.message}")
    []
  end

  # Reuses processes_raw from caller to avoid duplicate query
  def compute_thread_capacity(processes_raw, alive_cutoff)
    workers = processes_raw.select { |_, kind, _, _| kind == "Worker" }
    # We need metadata for thread_pool_size, so query Worker processes
    worker_records = SolidQueue::Process
      .where("last_heartbeat_at > ?", alive_cutoff)
      .where(kind: "Worker")

    total = worker_records.sum { |w| w.metadata&.dig("thread_pool_size").to_i }
    alive_worker_ids = worker_records.pluck(:id)
    used = alive_worker_ids.any? ?
      SolidQueue::ClaimedExecution.where(process_id: alive_worker_ids).count : 0

    { total: total, used: used }
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] compute_thread_capacity failed: #{e.message}")
    nil
  end

  # Heroku dyno info constants (same as controller)
  DYNO_MEMORY_LIMITS = {
    "Eco" => 512, "Basic" => 512, "Standard-1X" => 512,
    "Standard-2X" => 1024, "Performance-M" => 2560, "Performance-L" => 14_336
  }.freeze

  ALL_APPS = [
    { name: "teeem-shared-worker", label: "Shared Worker", type: "worker" },
    { name: "teeem-email-worker",  label: "Email Worker",  type: "worker" },
    { name: "teeem-production",    label: "Production",    type: "web" },
    { name: "teeem-staging",       label: "Staging",       type: "web" },
    { name: "teeem-beta",          label: "Beta",          type: "web" },
  ].freeze

  def fetch_heroku_infrastructure
    return {} unless HerokuPlatformService.api_key?
    HerokuPlatformService.infrastructure
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] fetch_heroku_infrastructure failed: #{e.message}")
    {}
  end

  def compute_worker_dynos
    return nil unless @heroku_infra[:dynos].present?

    relevant_apps = %w[teeem-shared-worker teeem-email-worker teeem-production teeem-staging teeem-beta]
    @heroku_infra[:dynos]
      .select { |d| d[:app].in?(relevant_apps) }
      .map do |d|
        {
          app: d[:app],
          environment: d[:environment],
          dyno: d[:dyno],
          size: d[:size],
          quantity: d[:quantity],
          running: d[:quantity] > 0,
          cost: d[:cost]
        }
      end
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] compute_worker_dynos failed: #{e.message}")
    nil
  end

  def compute_worker_apps(processes_raw, alive_cutoff)
    # SolidQueue worker processes (need metadata for thread/queue info)
    sq_workers = SolidQueue::Process
      .where("last_heartbeat_at > ?", alive_cutoff)
      .where(kind: "Worker")

    shared_procs = []
    email_procs = []
    sq_workers.each do |w|
      raw_queues = w.metadata&.dig("queues").to_s
      queue_list = raw_queues.split(",").map(&:strip).reject(&:blank?)
      if queue_list == ["email_sync"]
        email_procs << w
      else
        shared_procs << w
      end
    end
    procs_by_app = {
      "teeem-shared-worker" => shared_procs,
      "teeem-email-worker" => email_procs
    }

    # Dyno info from shared Heroku API call
    dyno_info = compute_dyno_info_by_app

    # Boot times from infrastructure cache (piggybacked on existing Heroku fetch)
    boot_times = @heroku_infra[:bootTimes] || {}

    # Per-app memory from cache
    cached_memories = ALL_APPS.to_h { |a|
      [a[:name], Rails.cache.read("worker_memory:#{a[:name]}")]
    }

    # Per-app DB connections
    db_by_app = compute_db_connections_by_app

    ALL_APPS.map do |app_def|
      app_name = app_def[:name]
      label = app_def[:label]
      app_type = app_def[:type]
      dyno = dyno_info[app_name]
      procs = procs_by_app[app_name] || []
      cached_mem = cached_memories[app_name]

      max_mb = dyno ? (DYNO_MEMORY_LIMITS[dyno[:size]] || 512) : ENV.fetch("DYNO_MEMORY_MB", 1024).to_i

      threads = if app_type == "worker"
        total = procs.sum { |w| w.metadata&.dig("thread_pool_size").to_i }
        process_ids = procs.map(&:id)
        used = process_ids.any? ? SolidQueue::ClaimedExecution.where(process_id: process_ids).count : 0
        { total: total, used: used }
      end

      running = if app_type == "worker"
        procs.any?
      else
        dyno ? dyno[:quantity].to_i > 0 : nil
      end

      result = {
        name: app_name,
        label: label,
        type: app_type,
        running: running,
        dynoSize: dyno&.dig(:size),
        bootedAt: boot_times[app_name],
        memory: {
          usedMb: cached_mem&.dig(:usedMb),
          maxMb: max_mb,
          live: cached_mem.present?
        },
        dbConnections: db_by_app[app_name] || 0
      }

      if threads
        result[:threads] = threads
        result[:queues] = procs.flat_map { |w| w.metadata&.dig("queues").to_s.split(",").map(&:strip) }.uniq.sort
      end

      result
    end
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] compute_worker_apps failed: #{e.message}")
    nil
  end

  def compute_dyno_info_by_app
    return {} unless @heroku_infra[:dynos].present?

    app_names = ALL_APPS.map { |a| a[:name] }
    @heroku_infra[:dynos]
      .select { |d| d[:app].in?(app_names) && d[:dyno].in?(%w[web worker]) && d[:quantity].to_i > 0 }
      .to_h { |d| [d[:app], { size: d[:size], quantity: d[:quantity] }] }
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] compute_dyno_info_by_app failed: #{e.message}")
    {}
  end

  def compute_db_connections_by_app
    rows = ActiveRecord::Base.connection.execute(<<~SQL)
      SELECT application_name, count(*) AS cnt
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND application_name != ''
      GROUP BY application_name
    SQL
    rows.to_h { |r| [r["application_name"], r["cnt"].to_i] }
  rescue StandardError => e
    Rails.logger.debug("[QueueStatusCacheJob] compute_db_connections_by_app failed: #{e.message}")
    {}
  end
end
