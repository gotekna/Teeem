# frozen_string_literal: true

# ExternalSyncConstants - SSoT for external accounting sync constants
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: All external sync models MUST use these constants          ║
# ║  NEVER define ACCOUNTING_SYSTEMS or SYNC_DIRECTIONS in models     ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Include this concern in models that sync with external accounting systems:
#
#   class ExternalInvoice < ApplicationRecord
#     include ExternalSyncConstants
#
#     validates :source, inclusion: { in: ACCOUNTING_SYSTEMS }
#     validates :sync_direction, inclusion: { in: RECORD_SYNC_DIRECTIONS }
#   end
#
module ExternalSyncConstants
  extend ActiveSupport::Concern

  # ═══════════════════════════════════════════════════════════════
  # ACCOUNTING SYSTEMS (THE ONE definition)
  # ═══════════════════════════════════════════════════════════════
  # Supported external accounting integrations
  # xero       = Xero (Australia/NZ/UK focused)
  # myob       = MYOB (Australia/NZ focused)
  # quickbooks = QuickBooks (US focused)
  ACCOUNTING_SYSTEMS = %w[xero myob quickbooks].freeze

  # ═══════════════════════════════════════════════════════════════
  # RECORD SYNC DIRECTIONS (THE ONE definition)
  # ═══════════════════════════════════════════════════════════════
  # Per-record sync directions (ExternalInvoice, ContactExternalLink, XeroContact)
  # import_only   = Only pull data from external system to TEEEM
  # export_only   = Only push data from TEEEM to external system
  # bidirectional = Sync both ways (most recent change wins)
  #
  # Note: "disabled" is NOT included here - if you don't want to sync a record,
  # simply don't create it or set sync_enabled: false
  RECORD_SYNC_DIRECTIONS = %w[import_only export_only bidirectional].freeze

  # ═══════════════════════════════════════════════════════════════
  # TENANT SYNC DIRECTIONS (THE ONE definition)
  # ═══════════════════════════════════════════════════════════════
  # Tenant-level sync configuration (SyncConfiguration)
  # Includes "disabled" for completely turning off sync for a tenant
  TENANT_SYNC_DIRECTIONS = %w[import_only export_only bidirectional disabled].freeze

  # ═══════════════════════════════════════════════════════════════
  # MATCH TYPES (THE ONE definition)
  # ═══════════════════════════════════════════════════════════════
  # How records were matched/linked between TEEEM and external systems
  # exact_abn    = Matched by exact ABN/Tax Number
  # exact_email  = Matched by exact email address
  # fuzzy_name   = Matched by similar name (needs review)
  # manual       = Manually linked by user
  # auto_created = Automatically created during sync
  MATCH_TYPES = %w[exact_abn exact_email fuzzy_name manual auto_created].freeze

  included do
    # Provide scopes for common queries
    scope :xero, -> { where(source: "xero") }
    scope :myob, -> { where(source: "myob") }
    scope :quickbooks, -> { where(source: "quickbooks") }
    scope :for_source, ->(source) { where(source: source) }
  end
end
