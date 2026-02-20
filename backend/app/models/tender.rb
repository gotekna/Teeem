# frozen_string_literal: true

# Tender - Sections for grouping PO line items into professional tender documents.
#
# Each tender record represents a section in the final tender PDF:
# "Base Price & Essential Inclusions", "Site Costs", "Authority Conditions", etc.
#
# Linked to SM Schedule Masters via tender_id lookup column.
# When a tender document is created, POs inherit their tender section
# via the chain: PO → SmTask → SmScheduleMaster.tender_id → Tender.
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
  has_many :sm_schedule_masters, foreign_key: :tender_id, dependent: :nullify

  # Validations
  validates :code, presence: true, uniqueness: { scope: :tenant_id }, length: { maximum: 20 }
  validates :name, presence: true, length: { maximum: 100 }
  validates :section_type, inclusion: { in: SECTION_TYPES }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:sort_order, :name) }
end
