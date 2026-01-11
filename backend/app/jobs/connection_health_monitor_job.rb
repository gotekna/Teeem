# frozen_string_literal: true

# ConnectionHealthMonitorJob - Monitors database connection pool usage
#
# This job detects connection exhaustion BEFORE it causes failures.
# Created as part of Option C architectural refactor to fix Xero token
# refresh failures caused by "too many connections" errors.
#
# Runs every 5 minutes via SolidQueue recurring tasks.
#
# Thresholds:
# - 70%: Warning (logged, cached for other jobs to check)
# - 85%: Critical (logged as error, jobs may skip to avoid failure)
#
# Usage by other jobs:
#   connection_health = Rails.cache.read("connection_health")
#   if connection_health&.dig(:status) == :critical
#     # Skip or defer work to avoid connection exhaustion
#   end
#
class ConnectionHealthMonitorJob < ApplicationJob
  queue_as :low

  # Don't retry on failure - this is a monitoring job, next scheduled run will try again
  # Prevents queue clog when connection issues cause this job to fail repeatedly
  discard_on StandardError

  # Alert thresholds
  CONNECTION_WARNING_PERCENT = 70   # Warn at 70% pool usage
  CONNECTION_CRITICAL_PERCENT = 85  # Alert at 85% pool usage

  def perform
    health_data = check_all_pools

    # Cache for other jobs to check before running
    Rails.cache.write("connection_health", health_data, expires_in: 5.minutes)

    case health_data[:status]
    when :critical
      Rails.logger.error "[ConnectionHealth] CRITICAL: #{health_data[:message]}"
      # Future: Could integrate with Sentry or alerting system here
    when :warning
      Rails.logger.warn "[ConnectionHealth] WARNING: #{health_data[:message]}"
    else
      Rails.logger.debug "[ConnectionHealth] OK: All connection pools healthy"
    end

    health_data
  end

  private

  def check_all_pools
    pools = {}

    # Rails 8 API: use each_connection_pool instead of all_connection_pools
    ActiveRecord::Base.connection_handler.each_connection_pool do |pool|
      db_name = pool.db_config.name.to_s

      stats = {
        size: pool.size,
        connections: pool.connections.count,
        busy: pool.connections.count { |c| c.in_use? },
        dead: pool.connections.count { |c| !c.active? rescue true },
        waiting: pool.num_waiting_in_queue
      }
      stats[:available] = stats[:size] - stats[:busy]
      stats[:usage_percent] = stats[:size] > 0 ? (stats[:busy].to_f / stats[:size] * 100).round(1) : 0

      pools[db_name] = stats
    end

    # Determine overall status based on highest usage
    max_usage = pools.values.map { |p| p[:usage_percent] }.max || 0

    status = if max_usage >= CONNECTION_CRITICAL_PERCENT
               :critical
             elsif max_usage >= CONNECTION_WARNING_PERCENT
               :warning
             else
               :healthy
             end

    {
      status: status,
      pools: pools,
      max_usage_percent: max_usage,
      checked_at: Time.current,
      message: generate_message(pools, status)
    }
  end

  def generate_message(pools, status)
    high_usage = pools.select { |_, p| p[:usage_percent] >= CONNECTION_WARNING_PERCENT }

    if high_usage.empty?
      total_busy = pools.values.sum { |p| p[:busy] }
      total_size = pools.values.sum { |p| p[:size] }
      "All pools healthy: #{total_busy}/#{total_size} connections in use"
    else
      high_usage.map { |name, stats|
        "#{name}: #{stats[:busy]}/#{stats[:size]} (#{stats[:usage_percent]}%)"
      }.join(", ")
    end
  end
end
