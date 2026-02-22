# frozen_string_literal: true

# Tender - Sections that group PO line items into tender document sections.
#
# Each section belongs to a TenderHeader (top-level grouping).
#
# Example hierarchy:
#   TH-002 Site Costs (TenderHeader)
#     TS-010 Site Preparation (Tender section)
#     TS-011 Piering to Slab (Tender section)
#     TS-022 Flood Requirements (Tender section, default_note: "No allowance...")
#
# Linked to SM Schedule Masters via tender_id lookup column.
# When a tender document is created, POs inherit their tender section
# via the chain: PO → SmTask → SmScheduleMaster.tender_id → Tender → Tender.tender_header
#
# Section Types:
#   priced      - Shows line items with prices (normal)
#   note        - Text-only section (no pricing)
#   included    - Items included in base price (no additional cost)
#   provisional - Provisional sums (estimated, subject to actuals)
#
class Tender < ApplicationRecord
  acts_as_tenant :tenant
  include ConfigSyncable
  self.sync_key_source = :code

  # Section types
  SECTION_TYPES = %w[priced note included provisional].freeze

  # Associations
  belongs_to :tender_header
  has_many :sm_schedule_masters, foreign_key: :tender_id, dependent: :nullify

  # Validations
  validates :code, presence: true, uniqueness: { scope: :tenant_id }, length: { maximum: 20 }
  validates :name, presence: true, length: { maximum: 100 }
  validates :section_type, inclusion: { in: SECTION_TYPES }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :ordered, -> {
    order(
      Arel.sql("COALESCE(sort_order, (regexp_match(name, '^(\\d+)'))[1]::int, 999999)"),
      :name
    )
  }
end
