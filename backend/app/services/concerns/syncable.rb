# frozen_string_literal: true

# Syncable concern for DRYing up sync service patterns
#
# Provides:
# - Standard results hash tracking
# - Logging helpers with service-specific tags
# - Error tracking
# - Stats tracking (processed, created, updated, skipped, failed)
# - Rate limiting support
#
# Usage:
#   class MyService
#     include Syncable
#
#     def initialize(...)
#       init_sync_results
#       @log_tag = "MyService"
#     end
#
#     def sync!
#       with_sync_tracking do
#         items.each do |item|
#           process_with_tracking(item) do
#             # your logic here
#             :created # or :updated, :skipped
#           end
#         end
#       end
#     end
#   end
#
module Syncable
  extend ActiveSupport::Concern

  included do
    attr_reader :sync_results
  end

  # Initialize the standard results hash
  def init_sync_results
    @sync_results = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      started_at: nil,
      completed_at: nil
    }
  end

  # Wrap sync operation with timing and error handling
  def with_sync_tracking
    @sync_results[:started_at] = Time.current
    sync_log(:info, "Starting sync")

    yield

    @sync_results[:completed_at] = Time.current
    duration = (@sync_results[:completed_at] - @sync_results[:started_at]).round(2)
    sync_log(:info, "Completed in #{duration}s: #{sync_summary}")

    @sync_results
  rescue StandardError => e
    @sync_results[:completed_at] = Time.current
    record_sync_error(e.message, exception: e)
    sync_log(:error, "Failed: #{e.message}")
    raise
  end

  # Process a single item with stats tracking
  # Block should return :created, :updated, or :skipped
  def process_with_tracking(item, identifier: nil)
    @sync_results[:processed] += 1

    result = yield

    case result
    when :created
      @sync_results[:created] += 1
    when :updated
      @sync_results[:updated] += 1
    when :skipped
      @sync_results[:skipped] += 1
    end

    result
  rescue StandardError => e
    @sync_results[:failed] += 1
    record_sync_error("#{identifier || 'Item'}: #{e.message}", exception: e)
    nil
  end

  # Record an error with optional exception details
  def record_sync_error(message, exception: nil)
    error_entry = { message: message, at: Time.current }
    error_entry[:backtrace] = exception.backtrace.first(5) if exception && Rails.env.development?
    @sync_results[:errors] << error_entry
  end

  # Logging helper with service tag
  def sync_log(level, message)
    tag = @log_tag || self.class.name.demodulize
    Rails.logger.public_send(level, "[#{tag}] #{message}")
  end

  # Summary string for logging
  def sync_summary
    "processed=#{@sync_results[:processed]} " \
    "created=#{@sync_results[:created]} " \
    "updated=#{@sync_results[:updated]} " \
    "skipped=#{@sync_results[:skipped]} " \
    "failed=#{@sync_results[:failed]}"
  end

  # Check if sync had any errors
  def sync_had_errors?
    @sync_results[:failed] > 0 || @sync_results[:errors].any?
  end

  # Simple rate limiting helper
  # Usage: with_rate_limit(requests_per_minute: 60) { api.call }
  def with_rate_limit(requests_per_minute: 60)
    @rate_limit_delay ||= 60.0 / requests_per_minute
    @last_request_at ||= Time.current - @rate_limit_delay

    elapsed = Time.current - @last_request_at
    if elapsed < @rate_limit_delay
      sleep(@rate_limit_delay - elapsed)
    end

    result = yield
    @last_request_at = Time.current
    result
  end

  # Batch processing helper with progress logging
  def process_in_batches(items, batch_size: 100, name: "items")
    total = items.respond_to?(:count) ? items.count : items.size
    sync_log(:info, "Processing #{total} #{name} in batches of #{batch_size}")

    items.each_slice(batch_size).with_index do |batch, index|
      batch_num = index + 1
      sync_log(:debug, "Processing batch #{batch_num} (#{batch.size} #{name})")

      batch.each do |item|
        yield item
      end
    end
  end
end
