# frozen_string_literal: true

# SSoT concern for memory monitoring in background jobs.
#
# Extracts the duplicated current_rss_mb + threshold check pattern from:
# - XeroAttachmentSyncJob
# - UploadEmailsToStorageJob
# - RetryPendingAttachmentBlobsJob
# - XeroBillPoMatchJob
#
# Usage:
#   class MyJob < ApplicationJob
#     include MemoryGuard
#     MEMORY_WARNING_MB = 700   # Force GC at this threshold
#     MEMORY_ABORT_MB = 800     # Abort job at this threshold
#   end
#
# Each job sets its own thresholds via class constants. Defaults: 700/800.
module MemoryGuard
  extend ActiveSupport::Concern

  # Get current RSS (Resident Set Size) in MB.
  # Linux (Heroku): reads /proc/self/status (instant, no subprocess).
  # macOS (dev): falls back to `ps` command.
  # Returns 0 on error (fail-open: never block processing due to monitoring failure).
  def current_rss_mb
    if File.exist?("/proc/self/status")
      status = File.read("/proc/self/status")
      match = status.match(/VmRSS:\s+(\d+)\s+kB/)
      return match[1].to_i / 1024 if match
    end

    `ps -o rss= -p #{Process.pid}`.strip.to_i / 1024
  rescue StandardError
    0
  end

  # Returns true if memory is critically high (caller should abort).
  # At warning threshold: forces GC and re-checks.
  # At abort threshold: returns true so caller can stop gracefully.
  def memory_critical?(label: self.class.name)
    warning = self.class.const_defined?(:MEMORY_WARNING_MB) ? self.class::MEMORY_WARNING_MB : 700
    abort_at = self.class.const_defined?(:MEMORY_ABORT_MB) ? self.class::MEMORY_ABORT_MB : 800

    rss = current_rss_mb
    return false if rss <= warning

    Rails.logger.warn("[#{label}] Memory high (#{rss}MB > #{warning}MB), forcing GC")
    GC.start(full_mark: true, immediate_sweep: true)
    rss = current_rss_mb

    if rss > abort_at
      Rails.logger.error("[#{label}] Memory still high after GC (#{rss}MB > #{abort_at}MB), aborting")
      return true
    end

    Rails.logger.info("[#{label}] GC freed memory to #{rss}MB, continuing")
    false
  end
end
