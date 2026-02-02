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
# Also tracks Xero-enforced rate limits (429 responses with Retry-After header).
# When Xero returns a 429, we store the lockout time and refuse to make requests
# until it expires.
#
class XeroRateLimitTracker
  MINUTE_LIMIT = 60
  DAILY_LIMIT = 5000
  CONCURRENT_LIMIT = 5

  # Cache key for Xero-enforced rate limit lockout
  LOCKOUT_KEY = "xero:rate:lockout"

  class << self
    # Record a Xero-enforced rate limit (from 429 response)
    # This is THE SSoT for "is Xero actually blocking us right now"
    # @param retry_after [Integer] Seconds until we can retry (from Xero's Retry-After header)
    # @param tenant_id [String] Optional tenant ID for per-tenant tracking
    #
    # FRC (Feb 2026): Each Xero org has its OWN rate limit - don't use global lockout!
    # Previously wrote to both global and per-tenant keys, which blocked ALL orgs
    # when any single org hit its limit. Now only writes per-tenant lockouts.
    def record_lockout!(retry_after, tenant_id: nil)
      lockout_until = Time.current + retry_after.seconds
      lockout_data = {
        locked_until: lockout_until.iso8601,
        retry_after_seconds: retry_after,
        recorded_at: Time.current.iso8601,
        tenant_id: tenant_id
      }

      # FRC (Feb 2026): Only store per-tenant lockout - each Xero org has independent limits
      # Global lockout was blocking all 10 orgs when only 1 hit its limit
      if tenant_id.present?
        Rails.cache.write("#{LOCKOUT_KEY}:#{tenant_id}", lockout_data, expires_in: retry_after.seconds + 60)
        Rails.logger.warn("[XeroRateLimitTracker] LOCKOUT RECORDED: Tenant #{tenant_id} rate limited for #{retry_after} seconds (until #{lockout_until})")
      else
        # Fallback: Only use global if no tenant_id (shouldn't happen in normal operation)
        Rails.cache.write(LOCKOUT_KEY, lockout_data, expires_in: retry_after.seconds + 60)
        Rails.logger.warn("[XeroRateLimitTracker] LOCKOUT RECORDED: Global rate limit for #{retry_after} seconds (until #{lockout_until})")
      end

      lockout_data
    end

    # Check if we're currently locked out by Xero
    # @return [Hash, nil] Lockout data if locked out, nil if OK to proceed
    #
    # FRC (Feb 2026): Each Xero org has its OWN rate limit - check per-tenant FIRST
    # Previously checked global lockout first, which blocked ALL orgs when any hit limit.
    #
    # SELF-HEALING (Feb 2026): Auto-clears stale lockouts that should have expired.
    # Cache entries can persist past their logical expiry due to clock drift or
    # cache backend issues. This method now proactively deletes expired entries.
    def current_lockout(tenant_id: nil)
      # FRC (Feb 2026): Check tenant-specific lockout FIRST (each org has independent limits)
      if tenant_id.present?
        tenant_key = "#{LOCKOUT_KEY}:#{tenant_id}"
        tenant_lockout = Rails.cache.read(tenant_key)
        if tenant_lockout
          locked_until = Time.parse(tenant_lockout[:locked_until]) rescue nil
          recorded_at = Time.parse(tenant_lockout[:recorded_at]) rescue nil

          # SELF-HEALING: Clear if expired OR recorded more than 1 hour ago (stale)
          max_lockout_age = 1.hour
          if locked_until.nil? || locked_until <= Time.current || (recorded_at && recorded_at < max_lockout_age.ago)
            Rails.cache.delete(tenant_key)
            Rails.logger.info("[XeroRateLimitTracker] SELF-HEAL: Cleared expired/stale lockout for tenant #{tenant_id}")
          else
            return tenant_lockout
          end
        end
      end

      # Only check global lockout if no tenant_id provided (fallback for legacy calls)
      lockout = Rails.cache.read(LOCKOUT_KEY)
      if lockout
        locked_until = Time.parse(lockout[:locked_until]) rescue nil
        recorded_at = Time.parse(lockout[:recorded_at]) rescue nil

        # SELF-HEALING: Clear if expired OR recorded more than 1 hour ago (stale)
        max_lockout_age = 1.hour
        if locked_until.nil? || locked_until <= Time.current || (recorded_at && recorded_at < max_lockout_age.ago)
          Rails.cache.delete(LOCKOUT_KEY)
          Rails.logger.info("[XeroRateLimitTracker] SELF-HEAL: Cleared expired/stale global lockout")
        else
          return lockout
        end
      end

      nil
    end

    # Check if we can make requests (not locked out)
    def can_make_requests?(tenant_id: nil)
      current_lockout(tenant_id: tenant_id).nil?
    end

    # Get time until lockout expires (for scheduling retry)
    # @return [Integer] Seconds until we can make requests, 0 if not locked out
    def lockout_remaining_seconds(tenant_id: nil)
      lockout = current_lockout(tenant_id: tenant_id)
      return 0 unless lockout

      remaining = (Time.parse(lockout[:locked_until]) - Time.current).ceil
      [remaining, 0].max
    end

    # Clear lockout (for testing or manual intervention)
    def clear_lockout!(tenant_id: nil)
      Rails.cache.delete(LOCKOUT_KEY)
      Rails.cache.delete("#{LOCKOUT_KEY}:#{tenant_id}") if tenant_id.present?
      Rails.logger.info("[XeroRateLimitTracker] Lockout cleared")
    end

    # SELF-HEALING: Proactively clear ALL stale lockouts across all tenants
    # Call this at the start of sync jobs to ensure no stale lockouts block progress
    # @return [Integer] Number of stale lockouts cleared
    def heal_all_lockouts!
      cleared = 0

      # Clear global lockout if stale
      if current_lockout(tenant_id: nil).nil? && Rails.cache.read(LOCKOUT_KEY)
        # current_lockout already deleted it via self-healing
        cleared += 1
      end

      # Check each tenant
      XeroCredential.pluck(:tenant_id).each do |tid|
        next unless tid.present?

        tenant_key = "#{LOCKOUT_KEY}:#{tid}"
        lockout = Rails.cache.read(tenant_key)
        next unless lockout

        locked_until = Time.parse(lockout[:locked_until]) rescue nil
        recorded_at = Time.parse(lockout[:recorded_at]) rescue nil

        # Clear if: expired, unparseable, or recorded more than 1 hour ago
        if locked_until.nil? || locked_until <= Time.current || (recorded_at && recorded_at < 1.hour.ago)
          Rails.cache.delete(tenant_key)
          cleared += 1
          Rails.logger.info("[XeroRateLimitTracker] HEAL_ALL: Cleared stale lockout for tenant #{tid}")
        end
      end

      Rails.logger.info("[XeroRateLimitTracker] HEAL_ALL: Cleared #{cleared} stale lockouts") if cleared > 0
      cleared
    end

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

      # ⚠️ SAFEGUARD: Auto-reset impossibly high counters (Jan 2026)
      # ════════════════════════════════════════════════════════════════
      # Why: Counter can drift past limit if jobs increment on retries/429s.
      #      A daily count > DAILY_LIMIT is IMPOSSIBLE - Xero would have 429'd
      #      us at exactly 5000. If we see >100%, our tracking drifted.
      # Fix: Auto-reset to unblock sync instead of staying stuck forever.
      # ════════════════════════════════════════════════════════════════
      if daily_count > DAILY_LIMIT
        Rails.logger.warn("[XeroRateLimitTracker] SAFEGUARD: Daily count #{daily_count} exceeds limit #{DAILY_LIMIT} for tenant #{tenant_id} - auto-resetting (impossible value)")
        reset_for(tenant_id)
        minute_count = 0
        daily_count = 0
        total_count = 0
      end

      # Check for Xero-enforced lockout (SSoT for "is Xero actually blocking us")
      lockout = current_lockout(tenant_id: tenant_id)
      is_locked_out = lockout.present?

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
        # SSoT: Check BOTH internal limits AND Xero-enforced lockout
        can_make_request: !is_locked_out && minute_count < MINUTE_LIMIT && daily_count < DAILY_LIMIT,
        locked_out: is_locked_out,
        lockout: lockout,
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
