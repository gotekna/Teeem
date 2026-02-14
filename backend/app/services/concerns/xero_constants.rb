# frozen_string_literal: true

# SSoT for all Xero rate limiting and API constants
# Created Feb 2026 to eliminate duplicate RATE_LIMIT_SLEEP constants
#
# Usage:
#   include XeroConstants
#   sleep(XERO_BATCH_SLEEP_MS / 1000.0)
#
module XeroConstants
  # ============================================
  # API BASE URLS (SSoT)
  # ============================================
  XERO_API_BASE_URL = "https://api.xero.com/api.xro/2.0".freeze
  XERO_CONNECTIONS_URL = "https://api.xero.com/connections".freeze

  # ============================================
  # RATE LIMITING (SSoT)
  # ============================================

  # Batch operations (imports, bulk syncs)
  # 100ms between operations = ~10 ops/sec, well under 60/min limit
  XERO_BATCH_SLEEP_MS = 100

  # Individual API calls (contact sync, invoice push)
  # 1200ms (1.2s) = 50 calls/min, safely under 60/min limit
  XERO_API_SLEEP_MS = 1200

  # Retry backoff base delay for rate limit errors
  XERO_RETRY_BASE_SLEEP_SEC = 0.5

  # Between-page delay for paginated fetches
  XERO_PAGE_SLEEP_SEC = 0.5

  # Individual record fetch delay (detailed invoice/bill fetches)
  # 1.1s = ~54 calls/min, under 60/min limit
  XERO_DETAIL_FETCH_SLEEP_SEC = 1.1

  # Generic API pause (used in adapters)
  XERO_GENERIC_PAUSE_SEC = 1.0

  # ============================================
  # API LIMITS (SSoT)
  # ============================================

  XERO_CALLS_PER_MINUTE = 60
  XERO_DAILY_API_LIMIT = 5000

  # ============================================
  # NON-XERO CONSTANTS
  # ============================================

  # Email migration polling interval
  EMAIL_MIGRATION_POLL_INTERVAL_SEC = 30

  # Bulk email sync throttle (pause every 10 emails)
  BULK_EMAIL_SYNC_THROTTLE_SEC = 0.1

  # ABR (Australian Business Register) API rate limiting
  ABR_API_SLEEP_SEC = 0.5

  # Payment status sync throttle (for large batches)
  PAYMENT_SYNC_THROTTLE_SEC = 0.5

  # Integration token refresh delay (when in delayed mode)
  INTEGRATION_TOKEN_REFRESH_DELAY_SEC = 1.0

  # Bank transaction sync delay
  BANK_TRANSACTION_SYNC_DELAY_SEC = 0.5

  # Xero attachment sync delay
  XERO_ATTACHMENT_SYNC_DELAY_SEC = 1.0

  # Xero invoice push retry delay
  XERO_INVOICE_PUSH_RETRY_SEC = 0.5

  # GL AI transaction categorization throttle
  GL_AI_CATEGORIZATION_THROTTLE_SEC = 0.1
end
