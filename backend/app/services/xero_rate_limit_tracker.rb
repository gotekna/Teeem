# frozen_string_literal: true

# XeroRateLimitTracker - Track API usage against Xero rate limits
#
# Xero has these rate limits:
# - 5 concurrent connections per access token
# - 60 requests per minute per tenant
# - 5000 requests per day per tenant
#
# This tracker uses Rails cache to store request counts and provides
# real-time visibility into API usage.
#
class XeroRateLimitTracker
  MINUTE_LIMIT = 60
  DAILY_LIMIT = 5000
  CONCURRENT_LIMIT = 5

  class << self
    # Record an API request
    def record_request(tenant_id)
      return unless tenant_id.present?

      # Increment minute counter
      minute_key = minute_key_for(tenant_id)
      Rails.cache.increment(minute_key, 1, expires_in: 2.minutes, initial: 0)

      # Increment daily counter
      daily_key = daily_key_for(tenant_id)
      Rails.cache.increment(daily_key, 1, expires_in: 25.hours, initial: 0)

      # Increment total counter (all time)
      total_key = total_key_for(tenant_id)
      Rails.cache.increment(total_key, 1, expires_in: 7.days, initial: 0)
    end

    # Get current usage for a tenant
    def usage_for(tenant_id)
      return nil unless tenant_id.present?

      minute_count = Rails.cache.read(minute_key_for(tenant_id)).to_i
      daily_count = Rails.cache.read(daily_key_for(tenant_id)).to_i
      total_count = Rails.cache.read(total_key_for(tenant_id)).to_i

      {
        minute: {
          used: minute_count,
          limit: MINUTE_LIMIT,
          remaining: [ MINUTE_LIMIT - minute_count, 0 ].max,
          percentage: (minute_count.to_f / MINUTE_LIMIT * 100).round(1)
        },
        daily: {
          used: daily_count,
          limit: DAILY_LIMIT,
          remaining: [ DAILY_LIMIT - daily_count, 0 ].max,
          percentage: (daily_count.to_f / DAILY_LIMIT * 100).round(1)
        },
        total_7d: total_count,
        can_make_request: minute_count < MINUTE_LIMIT && daily_count < DAILY_LIMIT,
        # SSoT: Xero daily limit resets at midnight UTC (10:00 AM Brisbane AEST)
        # Use UTC times for accurate reset calculation regardless of server timezone
        resets: {
          minute: Time.current.utc.end_of_minute,
          daily: Time.current.utc.end_of_day  # UTC midnight = 10:00 AM Brisbane
        }
      }
    end

    # Get usage for all active tenants
    def all_tenant_usage
      credentials = XeroCredential.where(status: %w[connected degraded])

      credentials.map do |cred|
        {
          tenant_id: cred.tenant_id,
          tenant_name: cred.tenant_name,
          usage: usage_for(cred.tenant_id)
        }
      end
    end

    # Get aggregated usage across all tenants
    def aggregate_usage
      tenants = all_tenant_usage

      total_minute = tenants.sum { |t| t[:usage]&.dig(:minute, :used) || 0 }
      total_daily = tenants.sum { |t| t[:usage]&.dig(:daily, :used) || 0 }
      total_7d = tenants.sum { |t| t[:usage]&.dig(:total_7d) || 0 }

      {
        tenants: tenants.count,
        aggregate: {
          minute_requests: total_minute,
          daily_requests: total_daily,
          total_7d_requests: total_7d
        },
        per_tenant: tenants
      }
    end

    # Check if we should throttle requests
    def should_throttle?(tenant_id)
      usage = usage_for(tenant_id)
      return true unless usage

      !usage[:can_make_request]
    end

    # Get wait time in seconds before we can make another request
    def wait_time_for(tenant_id)
      usage = usage_for(tenant_id)
      return 0 unless usage

      if usage.dig(:minute, :remaining) == 0
        # Wait until end of current minute
        (usage.dig(:resets, :minute) - Time.current).ceil
      elsif usage.dig(:daily, :remaining) == 0
        # Wait until end of day (worst case)
        (usage.dig(:resets, :daily) - Time.current).ceil
      else
        0
      end
    end

    # Reset counters for a tenant (for testing)
    def reset_for(tenant_id)
      Rails.cache.delete(minute_key_for(tenant_id))
      Rails.cache.delete(daily_key_for(tenant_id))
      Rails.cache.delete(total_key_for(tenant_id))
    end

    private

    def minute_key_for(tenant_id)
      minute = Time.current.strftime("%Y%m%d%H%M")
      "xero:rate:minute:#{tenant_id}:#{minute}"
    end

    def daily_key_for(tenant_id)
      # SSoT: Use UTC date because Xero's daily rate limit resets at midnight UTC
      # (which is 10:00 AM Brisbane AEST). Using UTC ensures our tracking
      # matches Xero's actual reset behavior.
      day = Time.current.utc.strftime("%Y%m%d")
      "xero:rate:daily:#{tenant_id}:#{day}"
    end

    def total_key_for(tenant_id)
      "xero:rate:total:#{tenant_id}"
    end
  end
end
