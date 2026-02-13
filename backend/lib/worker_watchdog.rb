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
# When circuit breaker opens, sends Sentry alert for manual intervention.
#
# Born from Feb 10 2026 incident: worker crashed, 1,815 jobs piled up,
# 24+ hours with no email sync because all monitors ran inside SolidQueue.

class WorkerWatchdog
  HEARTBEAT_STALE_THRESHOLD = 5.minutes
  CHECK_INTERVAL = 2.minutes
  CIRCUIT_BREAKER_MAX_RESTARTS = 3
  CIRCUIT_BREAKER_WINDOW = 30.minutes
  CACHE_KEY_RESTART_TIMES = "worker_watchdog:restart_times"
  CACHE_KEY_LAST_STATUS = "worker_watchdog:last_status"

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
        Rails.logger.error("[WorkerWatchdog] Circuit breaker OPEN - skipping restart. Manual intervention needed!")
        Sentry.capture_message(
          "[WorkerWatchdog] Circuit breaker open - worker dyno unresponsive",
          level: :fatal,
          extra: status
        ) if defined?(Sentry)
        return
      end

      app_name = ENV["HEROKU_APP_NAME"]
      api_key = HerokuPlatformService.api_key

      Rails.logger.warn("[WorkerWatchdog] Restarting worker dyno on #{app_name}")
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
      Rails.cache.write(CACHE_KEY_RESTART_TIMES, times, expires_in: CIRCUIT_BREAKER_WINDOW)
    end
  end
end
