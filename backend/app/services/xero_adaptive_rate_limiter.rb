# frozen_string_literal: true

# XeroAdaptiveRateLimiter: Smart rate limiting for batch operations
#
# Part of the Ultra-Scale Xero Sync Architecture (Feb 2026)
#
# Problem: Old sync used hardcoded 1.2s delays
#   20K contacts × 1.2s = 6.6 hours wasted on sleep
#
# Solution: Adaptive delays based on actual rate limit headroom
#   - No delay when plenty of headroom (45+ remaining)
#   - Light delay when moderate headroom (20-44 remaining)
#   - Moderate delay when low headroom (5-19 remaining)
#   - Wait for reset when near limit
#
# This integrates with existing XeroRateLimitTracker (SSoT for rate limits)
#
# Usage:
#   limiter = XeroAdaptiveRateLimiter.new(tenant_id)
#   result = limiter.with_rate_limit { xero_api.get('Contacts', page: 1) }
#
class XeroAdaptiveRateLimiter
  MINUTE_LIMIT = 60
  TARGET_UTILIZATION = 0.85  # Use 85% of limit safely
  SAFE_THRESHOLD = (MINUTE_LIMIT * TARGET_UTILIZATION).to_i  # 51

  # Delay tiers (in seconds) based on remaining capacity
  DELAYS = {
    plenty:   0.0,    # 45+ remaining - no delay
    moderate: 0.2,    # 20-44 remaining - 200ms
    low:      0.5,    # 5-19 remaining - 500ms
    critical: 1.0     # < 5 remaining - 1s (or wait for reset)
  }.freeze

  attr_reader :tenant_id, :stats

  def initialize(tenant_id)
    @tenant_id = tenant_id
    @stats = {
      requests: 0,
      delays: 0,
      total_delay_ms: 0,
      resets_waited: 0
    }
  end

  # Execute block with rate limiting
  # @yield Block that makes the API request
  # @return Result of the block
  def with_rate_limit
    wait_if_needed
    @stats[:requests] += 1

    result = yield

    # Record the request for tracking
    XeroRateLimitTracker.record_request(@tenant_id)

    result
  end

  # Check current usage and wait if necessary
  # Returns delay applied (in seconds)
  def wait_if_needed
    # Check for Xero-enforced lockout first (SSoT)
    if XeroRateLimitTracker.current_lockout(tenant_id: @tenant_id)
      remaining = XeroRateLimitTracker.lockout_remaining_seconds(tenant_id: @tenant_id)
      if remaining.positive?
        @stats[:resets_waited] += 1
        @stats[:total_delay_ms] += (remaining * 1000)
        Rails.logger.info("[XeroAdaptiveRateLimiter] Tenant #{@tenant_id} locked out, waiting #{remaining}s for reset")
        sleep(remaining)
        return remaining
      end
    end

    # Get current usage
    usage = XeroRateLimitTracker.usage_for(@tenant_id)
    return 0 unless usage

    minute_remaining = usage.dig(:minute, :remaining) || MINUTE_LIMIT

    delay = calculate_delay(minute_remaining)

    if delay.positive?
      @stats[:delays] += 1
      @stats[:total_delay_ms] += (delay * 1000).to_i

      if minute_remaining < 5
        # Near limit - wait for minute reset
        seconds_until_reset = calculate_seconds_until_reset
        if seconds_until_reset > delay
          delay = [seconds_until_reset, 10].max  # Wait at least to reset, max 10s
          @stats[:resets_waited] += 1
          Rails.logger.info("[XeroAdaptiveRateLimiter] Near limit (#{minute_remaining} remaining), waiting #{delay}s for reset")
        end
      end

      sleep(delay)
    end

    delay
  end

  # Can we make another request without hitting the limit?
  def can_proceed?
    return false if XeroRateLimitTracker.current_lockout(tenant_id: @tenant_id)

    usage = XeroRateLimitTracker.usage_for(@tenant_id)
    return true unless usage

    usage[:can_make_request]
  end

  # Get current rate limit status
  def status
    usage = XeroRateLimitTracker.usage_for(@tenant_id)
    lockout = XeroRateLimitTracker.current_lockout(tenant_id: @tenant_id)

    {
      tenant_id: @tenant_id,
      locked_out: lockout.present?,
      lockout: lockout,
      minute_used: usage&.dig(:minute, :used) || 0,
      minute_remaining: usage&.dig(:minute, :remaining) || MINUTE_LIMIT,
      daily_used: usage&.dig(:daily, :used) || 0,
      daily_remaining: usage&.dig(:daily, :remaining) || 5000,
      can_proceed: can_proceed?,
      stats: @stats
    }
  end

  # Summary of delays applied during this session
  def delay_stats
    {
      requests: @stats[:requests],
      delays_applied: @stats[:delays],
      resets_waited: @stats[:resets_waited],
      total_delay_seconds: (@stats[:total_delay_ms] / 1000.0).round(2),
      avg_delay_ms: @stats[:delays].positive? ? (@stats[:total_delay_ms].to_f / @stats[:delays]).round(1) : 0
    }
  end

  private

  def calculate_delay(minute_remaining)
    case minute_remaining
    when 45..Float::INFINITY
      DELAYS[:plenty]
    when 20..44
      DELAYS[:moderate]
    when 5..19
      DELAYS[:low]
    else
      DELAYS[:critical]
    end
  end

  def calculate_seconds_until_reset
    # Xero rate limit resets at end of current minute
    (60 - Time.current.sec).to_i
  end
end
