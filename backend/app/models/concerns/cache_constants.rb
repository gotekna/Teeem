# frozen_string_literal: true

# CacheConstants - SSoT for Rails.cache TTL durations
#
# Replace hardcoded cache expiry durations with semantic constants:
#   Rails.cache.write(key, value, expires_in: 5.minutes)  # ❌
#   Rails.cache.write(key, value, expires_in: CacheConstants::CACHE_TTL_MEDIUM)  # ✅
#
# When to use each tier:
# - SHORT (2 min):   Frequently changing data, user-facing lists
# - MEDIUM (5 min):  Standard cache for most API responses
# - LONG (10 min):   Slower-changing data, billing info, platform stats
# - HOURLY (1 hour): Credentials, tokens, OAuth tokens
# - DAILY (24 hours): Health checks, stats snapshots, daily aggregates
# - WEEKLY (7 days):  Viewer contexts, long-lived session data
#
module CacheConstants
  CACHE_TTL_SHORT = 2.minutes      # Frequently changing data
  CACHE_TTL_MEDIUM = 5.minutes     # Standard cache
  CACHE_TTL_LONG = 10.minutes      # Slower-changing data
  CACHE_TTL_HOURLY = 1.hour        # Credentials, tokens
  CACHE_TTL_DAILY = 24.hours       # Health checks, stats
  CACHE_TTL_WEEKLY = 7.days        # Viewer contexts, long-lived data
end
