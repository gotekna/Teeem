# frozen_string_literal: true

require "net/http"
require "uri"

# WorkerWatchdog - Self-healing monitor for SolidQueue worker dyno
#
# Runs as a background thread on the web dyno. Checks SolidQueue process
# heartbeats every 2 minutes. If all heartbeats are stale (>5 min),
# calls Heroku API to restart the worker dyno.
#
# Circuit breaker prevents restart storms: max 3 restarts per 30 min.
# After circuit breaker cools down, retries ONE restart per window.
# Never gives up - keeps retrying with cooldown periods forever.
#
# Born from Feb 10 2026 incident: worker crashed, 1,815 jobs piled up,
# 24+ hours with no email sync because all monitors ran inside SolidQueue.
#
# ⚠️ DO NOT SIMPLIFY - Circuit breaker with retry (Feb 2026)
# ════════════════════════════════════════════════════════════
# Why: Original circuit breaker opened after 3 restarts and NEVER retried.
#   Worker stayed dead forever until manual intervention.
# ❌ WRONG: Open circuit breaker = give up permanently
# ✅ CORRECT: Open = cooldown 30 min, then retry ONE restart, repeat
# ════════════════════════════════════════════════════════════

class WorkerWatchdog
  HEARTBEAT_STALE_THRESHOLD = 5.minutes
  CHECK_INTERVAL = 2.minutes
  CIRCUIT_BREAKER_MAX_RESTARTS = 3
  CIRCUIT_BREAKER_WINDOW = 30.minutes
  CACHE_KEY_RESTART_TIMES = "worker_watchdog:restart_times".freeze
  CACHE_KEY_LAST_STATUS = "worker_watchdog:last_status".freeze
  CACHE_KEY_CIRCUIT_OPENED_AT = "worker_watchdog:circuit_opened_at".freeze

  # SSoT: The shared worker app processes ALL background jobs for all environments.
  # Individual apps (production, staging, beta) only run web dynos.
  SHARED_WORKER_APP = "teeem-shared-worker".freeze

  class << self
    def start!
      @thread = Thread.new do
        Rails.logger.info("[WorkerWatchdog] Started - checking every #{CHECK_INTERVAL.to_i}s")
        loop do
          begin
            tick
          rescue => e
            Rails.logger.error("[WorkerWatchdog] Error: #{e.message}")
            Sentry.capture_exception(e) if defined?(Sentry)
          end
          sleep CHECK_INTERVAL.to_i
        end
      end
      @thread.abort_on_exception = false
      @thread
    end

    def last_status
      Rails.cache.read(CACHE_KEY_LAST_STATUS) || { status: "unknown", checked_at: nil }
    end

    def tick
      status = assess_worker_health
      status[:circuit_breaker] = circuit_breaker_state
      Rails.cache.write(CACHE_KEY_LAST_STATUS, status, expires_in: 10.minutes)

      if status[:status] == "dead"
        Rails.logger.warn("[WorkerWatchdog] All worker heartbeats stale! Last: #{status[:last_heartbeat]}")
        attempt_restart(status)
      end
    end

    def assess_worker_health
      processes = SolidQueue::Process.order(last_heartbeat_at: :desc).limit(10)
      now = Time.current

      if processes.empty?
        return {
          status: "dead",
          process_count: 0,
          last_heartbeat: nil,
          staleness_seconds: nil,
          checked_at: now.iso8601,
          message: "No SolidQueue processes registered"
        }
      end

      latest_heartbeat = processes.first.last_heartbeat_at
      staleness = now - latest_heartbeat
      alive = staleness < HEARTBEAT_STALE_THRESHOLD

      {
        status: alive ? "healthy" : "dead",
        process_count: processes.size,
        last_heartbeat: latest_heartbeat.iso8601,
        staleness_seconds: staleness.round,
        checked_at: now.iso8601,
        message: alive ? "Workers healthy (#{processes.size} processes)" : "All heartbeats stale (#{staleness.round}s)"
      }
    end

    private

    def attempt_restart(status)
      if circuit_breaker_open?
        # Check if cooldown period has elapsed - if so, allow ONE retry
        if circuit_breaker_cooled_down?
          Rails.logger.warn("[WorkerWatchdog] Circuit breaker cooled down - attempting ONE retry restart")
          reset_circuit_breaker!
          # Fall through to restart below
        else
          cooldown_remaining = circuit_breaker_cooldown_remaining
          Rails.logger.error("[WorkerWatchdog] Circuit breaker OPEN - retry in #{cooldown_remaining.round}s")
          # Only send Sentry alert once per cooldown window (not every 2 min)
          if should_send_circuit_breaker_alert?
            Sentry.capture_message(
              "[WorkerWatchdog] Circuit breaker open - worker dyno unresponsive, retrying in #{(cooldown_remaining / 60).round}min",
              level: :fatal,
              extra: status.merge(cooldown_remaining_seconds: cooldown_remaining.round)
            ) if defined?(Sentry)
          end
          return
        end
      end

      # Worker dyno lives on the shared worker app, not on this app
      app_name = SHARED_WORKER_APP
      api_key = HerokuPlatformService.api_key

      Rails.logger.warn("[WorkerWatchdog] Restarting worker dyno on #{app_name} (triggered from #{ENV['HEROKU_APP_NAME']})")
      record_restart!

      uri = URI("https://api.heroku.com/apps/#{app_name}/dynos/worker")
      request = Net::HTTP::Delete.new(uri)
      request["Authorization"] = "Bearer #{api_key}"
      request["Accept"] = "application/vnd.heroku+json; version=3"

      response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
        http.open_timeout = 10
        http.read_timeout = 10
        http.request(request)
      end

      if response.code.to_i < 300
        Rails.logger.info("[WorkerWatchdog] Worker dyno restart triggered (HTTP #{response.code})")
        Sentry.capture_message(
          "[WorkerWatchdog] Auto-restarted worker dyno",
          level: :warning,
          extra: status.merge(restart_count: recent_restart_count)
        ) if defined?(Sentry)
      else
        Rails.logger.error("[WorkerWatchdog] Restart failed (HTTP #{response.code}): #{response.body}")
        Sentry.capture_message(
          "[WorkerWatchdog] Worker restart API call failed",
          level: :error,
          extra: status.merge(http_code: response.code, response_body: response.body)
        ) if defined?(Sentry)
      end
    rescue => e
      Rails.logger.error("[WorkerWatchdog] Restart error: #{e.message}")
      Sentry.capture_exception(e) if defined?(Sentry)
    end

    def circuit_breaker_open?
      recent_restart_count >= CIRCUIT_BREAKER_MAX_RESTARTS
    end

    def circuit_breaker_cooled_down?
      opened_at = Rails.cache.read(CACHE_KEY_CIRCUIT_OPENED_AT)
      return true unless opened_at
      Time.current - opened_at >= CIRCUIT_BREAKER_WINDOW
    end

    def circuit_breaker_cooldown_remaining
      opened_at = Rails.cache.read(CACHE_KEY_CIRCUIT_OPENED_AT)
      return 0 unless opened_at
      remaining = CIRCUIT_BREAKER_WINDOW - (Time.current - opened_at)
      [remaining, 0].max
    end

    def circuit_breaker_state
      if circuit_breaker_open?
        cooled = circuit_breaker_cooled_down?
        {
          open: true,
          cooled_down: cooled,
          cooldown_remaining_seconds: cooled ? 0 : circuit_breaker_cooldown_remaining.round,
          recent_restarts: recent_restart_count
        }
      else
        { open: false, recent_restarts: recent_restart_count }
      end
    end

    def reset_circuit_breaker!
      Rails.cache.delete(CACHE_KEY_RESTART_TIMES)
      Rails.cache.delete(CACHE_KEY_CIRCUIT_OPENED_AT)
    end

    # Only send Sentry alerts once per cooldown window, not every 2 minutes
    def should_send_circuit_breaker_alert?
      cache_key = "worker_watchdog:last_alert_at"
      last_alert = Rails.cache.read(cache_key)
      return true unless last_alert
      return false if Time.current - last_alert < CIRCUIT_BREAKER_WINDOW

      Rails.cache.write(cache_key, Time.current, expires_in: CIRCUIT_BREAKER_WINDOW)
      true
    end

    def recent_restart_count
      times = Rails.cache.read(CACHE_KEY_RESTART_TIMES) || []
      cutoff = Time.current - CIRCUIT_BREAKER_WINDOW
      times.count { |t| t > cutoff }
    end

    def record_restart!
      times = Rails.cache.read(CACHE_KEY_RESTART_TIMES) || []
      cutoff = Time.current - CIRCUIT_BREAKER_WINDOW
      times = times.select { |t| t > cutoff } # Prune old entries
      times << Time.current
      Rails.cache.write(CACHE_KEY_RESTART_TIMES, times, expires_in: 2.hours)

      # Record when circuit breaker first opens
      if times.size >= CIRCUIT_BREAKER_MAX_RESTARTS
        unless Rails.cache.read(CACHE_KEY_CIRCUIT_OPENED_AT)
          Rails.cache.write(CACHE_KEY_CIRCUIT_OPENED_AT, Time.current, expires_in: 2.hours)
        end
      end
    end
  end
end
