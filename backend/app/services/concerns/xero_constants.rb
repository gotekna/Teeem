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
  # TRACKING CATEGORY (SSoT)
  # ============================================

  # Default tracking category name - configurable per tenant via TenantSetting
  DEFAULT_TRACKING_CATEGORY_NAME = "Job".freeze

  # Lookup the tracking category name for the current tenant
  # Falls back to "Job" if no tenant or no custom setting
  def self.tracking_category_name
    tenant = ActsAsTenant.current_tenant
    return DEFAULT_TRACKING_CATEGORY_NAME unless tenant

    setting = tenant.tenant_setting
    setting&.xero_tracking_category_name.presence || DEFAULT_TRACKING_CATEGORY_NAME
  end

  # ============================================
  # API BASE URLS (SSoT)
  # ============================================
  XERO_API_BASE_URL = "https://api.xero.com/api.xro/2.0".freeze
  XERO_CONNECTIONS_URL = "https://api.xero.com/connections".freeze
  XERO_OAUTH_SITE = "https://login.xero.com".freeze
  XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize".freeze
  XERO_TOKEN_URL = "https://identity.xero.com/connect/token".freeze
  XERO_REVOCATION_URL = "https://identity.xero.com/connect/revocation".freeze

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
  XERO_RATE_LIMIT_WARNING_THRESHOLD = 80

  # ============================================
  # HTTP TIMEOUTS (SSoT)
  # ============================================

  # Default timeout for most Xero API requests (seconds)
  XERO_DEFAULT_TIMEOUT = 30

  # Extended timeout for file operations (attachments, PDFs)
  # FRC (Feb 2026): Increased from 60→120. With concurrent downloads sharing
  # bandwidth, 60s was too tight for large PDFs (Xero generates on-the-fly).
  XERO_FILE_TIMEOUT = 120

  # Short timeout for token operations
  XERO_TOKEN_TIMEOUT = 10

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
