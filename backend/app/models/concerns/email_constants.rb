# frozen_string_literal: true

# EmailConstants - Single Source of Truth for all email system constants
#
# SSoT: This module centralizes magic numbers from email jobs, services, and controllers.
# ALWAYS use these constants instead of hardcoding values.
module EmailConstants
  # ═══════════════════════════════════════════════════════════════
  # CONFIDENCE THRESHOLDS
  # ═══════════════════════════════════════════════════════════════

  # Minimum confidence to auto-assign email to job/contact
  AUTO_ASSIGN_MIN_CONFIDENCE = 0.7

  # Job match confidence (reverse lookup / thread matching)
  JOB_MATCH_CONFIDENCE = 0.7

  # Contact match confidence
  CONTACT_MATCH_CONFIDENCE = 0.75

  # Default auto-assign confidence threshold
  DEFAULT_AUTO_ASSIGN_CONFIDENCE = 0.8

  # Skip AI classification if already this confident
  AI_CONFIDENCE_SKIP_THRESHOLD = 0.8

  # Classification confidence thresholds by category
  TRANSACTIONAL_CONFIDENCE = 0.85
  SPAM_CONFIDENCE = 0.9
  MARKETING_CONFIDENCE = 0.95

  # ═══════════════════════════════════════════════════════════════
  # BATCH SIZES & LIMITS
  # ═══════════════════════════════════════════════════════════════

  IMAP_FETCH_BATCH_SIZE = 50
  RELATED_EMAILS_LIMIT = 10
  COMPANY_MATCH_LIMIT = 10
  CLASSIFICATION_EXAMPLES_LIMIT = 10

  # Sync limits by mode
  SYNC_LIMIT_FULL = 500
  SYNC_LIMIT_INCREMENTAL = 250

  # ═══════════════════════════════════════════════════════════════
  # PAGINATION DEFAULTS
  # ═══════════════════════════════════════════════════════════════

  DEFAULT_PER_PAGE = 50
  MAX_PER_PAGE = 200
  SEARCH_RESULTS_LIMIT = 100
  PROPOSALS_PER_PAGE = 20
  PROPOSALS_MAX_PER_PAGE = 100
  QUICK_REPLIES_LIMIT = 10
  SUBSCRIPTIONS_DEFAULT_LIMIT = 100

  # ═══════════════════════════════════════════════════════════════
  # LOOKBACK WINDOWS
  # ═══════════════════════════════════════════════════════════════

  FULL_SYNC_LOOKBACK = 90.days
  INCREMENTAL_SYNC_LOOKBACK = 7.days
  RECENT_EMAIL_WINDOW = 24.hours
  SYNC_OVERLAP_BUFFER = 2.hours

  # ═══════════════════════════════════════════════════════════════
  # AI RATE LIMITING
  # ═══════════════════════════════════════════════════════════════

  AI_RATE_LIMIT_PER_HOUR = 100
  AI_RATE_LIMIT_CACHE_EXPIRY = 2.hours
end
