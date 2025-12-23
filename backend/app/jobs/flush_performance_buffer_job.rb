# frozen_string_literal: true

# Performance Observatory - Buffer Flush Job
# Flushes collected performance metrics from memory to database
#
# Runs every 30 seconds via recurring.yml to ensure metrics are persisted
# Also triggered automatically when buffer reaches 80% capacity
#
# This job is designed to be:
# - Idempotent (safe to run multiple times)
# - Quick (<1 second for normal loads)
# - Non-blocking (uses bulk insert)
#
class FlushPerformanceBufferJob < ApplicationJob
  queue_as :low  # Low priority - metrics can wait

  # Don't retry on failure - next scheduled run will pick up
  discard_on StandardError

  def perform
    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    # Log buffer stats before flush
    stats = Performance::Buffer.stats
    return if stats[:requests].zero? && stats[:vitals].zero? && stats[:slow_queries].zero?

    Rails.logger.info "[FlushPerformanceBufferJob] Starting flush - #{stats}"

    # Flush all buffers
    Performance::Buffer.flush!

    # Log completion time
    duration_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).round(1)
    Rails.logger.info "[FlushPerformanceBufferJob] Completed in #{duration_ms}ms"
  end
end
