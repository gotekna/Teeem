# frozen_string_literal: true

# Reports current process memory to SolidCache every 30s.
# The queue_status API reads these values to show per-app memory in the UI.
#
# Runs on ALL Heroku apps (workers AND web dynos).
# Requires HEROKU_APP_NAME env var to be set on each Heroku app.
# Cache is SolidCache (database-backed), shared across all dynos.
#
# Key format: "worker_memory:<app_name>" e.g. "worker_memory:teeem-shared-worker"
# Value: { usedMb: 525, maxMb: 1024, pid: 2, at: "2026-02-18T02:00:00Z" }
if ENV["HEROKU_APP_NAME"].present?
  Rails.application.config.after_initialize do
    Thread.new do
      app_name = ENV["HEROKU_APP_NAME"]
      max_mb = ENV.fetch("DYNO_MEMORY_MB", 1024).to_i

      loop do
        sleep 30
        begin
          rss_kb = `ps -o rss= -p #{Process.pid}`.strip.to_i
          Rails.cache.write(
            "worker_memory:#{app_name}",
            { usedMb: rss_kb / 1024, maxMb: max_mb, pid: Process.pid, at: Time.current.iso8601 },
            expires_in: 2.minutes
          )
        rescue => e
          # Non-critical - don't crash the process over a memory report
        end
      end
    end
  end
end
