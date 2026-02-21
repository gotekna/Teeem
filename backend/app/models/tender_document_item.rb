# frozen_string_literal: true

# TenderDocumentItem - A frozen line item snapshot from a PO, grouped by tender section.
#
# Created when a TenderDocument is generated. All values are snapshotted (frozen)
# from the source PO and line item at creation time. Changes to POs after tender
# creation do not affect existing tender document items.
#
# Two-level hierarchy snapshot:
#   tender_header_name/code/header_sort_order → the parent header
#   tender_section_name/code/section_sort_order → the section within that header
#
# Items with default_note set are placeholder items for sections with no PO items.
#
# Source tracking fields (source_purchase_order_id, source_po_number, source_line_item_id)
# provide an audit trail back to the original data.
#
class TenderDocumentItem < ApplicationRecord
  belongs_to :tender_document

  # Item types match tender section types
  ITEM_TYPES = %w[priced note included provisional].freeze

  validates :tender_section_name, presence: true
  validates :line_number, presence: true
  validates :description, presence: true
  validates :item_type, inclusion: { in: ITEM_TYPES }

  scope :priced, -> { where(item_type: "priced") }
  scope :by_section, -> { order(:header_sort_order, :section_sort_order, :line_number) }
  scope :default_notes, -> { where.not(default_note: nil) }
end
