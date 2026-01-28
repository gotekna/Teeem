# frozen_string_literal: true

# DocumentStorageConstants - SSoT for document storage constants
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: All document models MUST use these constants               ║
# ║  NEVER define STORAGE_PROVIDERS or MIGRATION_STATUSES in models   ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Include this concern in document models to get validated constants:
#
#     include DocumentStorageConstants
#
#     validates :storage_provider, inclusion: { in: STORAGE_PROVIDERS }, allow_nil: true
#     validates :migration_status, inclusion: { in: MIGRATION_STATUSES }, allow_nil: true
#   end
#
module DocumentStorageConstants
  extend ActiveSupport::Concern

  # ═══════════════════════════════════════════════════════════════
  # STORAGE PROVIDERS (THE ONE definition)
  # ═══════════════════════════════════════════════════════════════
  # These match StorageConfiguration.provider_type values
  # sharepoint    = Microsoft SharePoint/OneDrive
  # s3_compatible = AWS S3, Wasabi, MinIO, or any S3-compatible storage
  # wasabi        = Wasabi Cloud Storage (legacy alias for s3_compatible)
  # s3            = AWS S3 (legacy alias for s3_compatible)
  # local         = Local filesystem (development/testing only)
  STORAGE_PROVIDERS = %w[sharepoint s3_compatible wasabi s3 local].freeze

  # ═══════════════════════════════════════════════════════════════
  # MIGRATION STATUSES (THE ONE definition)
  # ═══════════════════════════════════════════════════════════════
  # Used when migrating documents between providers
  # pending     = Queued for migration
  # in_progress = Currently being migrated
  # completed   = Successfully migrated
  # failed      = Migration failed (check error_message)
  MIGRATION_STATUSES = %w[pending in_progress completed failed].freeze

  # ═══════════════════════════════════════════════════════════════
  # SYNC STATUSES (THE ONE definition)
  # ═══════════════════════════════════════════════════════════════
  # Used for provider sync status
  # pending = Not yet synced
  # synced  = Successfully synced with provider
  # missing = File missing from provider
  # error   = Sync error (check error_message)
  SYNC_STATUSES = %w[pending synced missing error].freeze

  # ═══════════════════════════════════════════════════════════════
  # AI VERIFICATION STATUSES (THE ONE definition)
  # ═══════════════════════════════════════════════════════════════
  # Used for AI document verification
  # pending      = Not yet verified
  # verified     = AI verified content matches expected
  # mismatch     = AI found content doesn't match expected
  # needs_review = AI uncertain, needs human review
  AI_VERIFICATION_STATUSES = %w[pending verified mismatch needs_review].freeze

  # ═══════════════════════════════════════════════════════════════
  # ALLOWED CONTENT TYPES (THE ONE definition)
  # ═══════════════════════════════════════════════════════════════
  # Allowed MIME types for document uploads (security validation)
  ALLOWED_CONTENT_TYPES = %w[
    application/pdf
    image/jpeg
    image/png
    image/tiff
    image/heic
    application/vnd.openxmlformats-officedocument.wordprocessingml.document
    application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    application/vnd.ms-excel
    application/msword
    text/plain
    text/csv
    application/octet-stream
  ].freeze

  # ═══════════════════════════════════════════════════════════════
  # FILE SIZE LIMITS (THE ONE definition)
  # ═══════════════════════════════════════════════════════════════
  MAX_FILE_SIZE = 100.megabytes
  MAX_FILE_SIZE_FOR_AI = 20.megabytes  # AI document verification/analysis
  MAX_FILE_SIZE_FOR_AI_PLANS = 25.megabytes  # AI working drawings categorization (larger PDFs)

  included do
    # Provide scopes for common queries
    scope :with_provider, ->(provider) { where(storage_provider: provider) }
    scope :migration_pending, -> { where(migration_status: "pending") }
    scope :migration_completed, -> { where(migration_status: "completed") }
    scope :migration_failed, -> { where(migration_status: "failed") }
  end
end
