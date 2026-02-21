# frozen_string_literal: true

# Tender - Two-level hierarchy for grouping PO line items into tender documents.
#
# Records with parent_id = NULL are **headers** (top-level groupings).
# Records with parent_id set are **sections** (children of a header).
# Follows the CostCentre self-referential pattern.
#
# Example hierarchy:
#   TH-002 Site Costs (header)
#     TS-010 Site Preparation (section)
#     TS-011 Piering to Slab (section)
#     TS-022 Flood Requirements (section, default_note: "No allowance...")
#
# Linked to SM Schedule Masters via tender_id lookup column.
# When a tender document is created, POs inherit their tender section
# via the chain: PO → SmTask → SmScheduleMaster.tender_id → Tender → Tender.parent
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

  # Associations (self-referential hierarchy, same as CostCentre)
  belongs_to :parent, class_name: "Tender", optional: true
  has_many :children, class_name: "Tender", foreign_key: :parent_id, dependent: :nullify
  has_many :sm_schedule_masters, foreign_key: :tender_id, dependent: :nullify

  # Validations
  validates :code, presence: true, uniqueness: { scope: :tenant_id }, length: { maximum: 20 }
  validates :name, presence: true, length: { maximum: 100 }
  validates :section_type, inclusion: { in: SECTION_TYPES }

  # Prevent circular parent references
  validate :parent_not_self
  validate :parent_not_descendant

  # Scopes
  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:sort_order, :name) }
  scope :headers, -> { where(parent_id: nil) }
  scope :sections, -> { where.not(parent_id: nil) }

  # Instance methods

  def header?
    parent_id.nil?
  end

  def section?
    parent_id.present?
  end

  # Build tree structure for API response (headers with nested children)
  def self.tree
    headers.active.ordered.includes(:children).map { |header| header.as_tree_node }
  end

  def as_tree_node
    {
      id: id,
      code: code,
      name: name,
      sortOrder: sort_order,
      description: description,
      sectionType: section_type,
      defaultNote: default_note,
      children: children.active.ordered.map { |child|
        {
          id: child.id,
          code: child.code,
          name: child.name,
          sortOrder: child.sort_order,
          sectionType: child.section_type,
          defaultNote: child.default_note,
          description: child.description
        }
      }
    }
  end

  private

  def parent_not_self
    return if new_record?
    return unless parent_id.present? && parent_id == id

    errors.add(:parent_id, "cannot be self")
  end

  def parent_not_descendant
    return if new_record?
    return unless parent_id.present?

    descendant_ids = children.pluck(:id)
    return unless descendant_ids.include?(parent_id)

    errors.add(:parent_id, "cannot be a descendant (circular reference)")
  end
end
