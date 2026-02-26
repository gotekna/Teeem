# frozen_string_literal: true

# CustomQuoteAllocation - Breaks down a CC-level quote into PO-level amounts
#
# When a supplier quotes at the cost centre level (e.g., "All Slab = $30K"),
# the builder allocates that total to individual PO child lines.
#
# Example:
#   CC: Slab Work - Supplier A accepted @ $30,000
#     → PO: Slab Supply   - Allocated $18,000
#     → PO: Slab Labour   - Allocated $12,000
#
# Each allocation can independently create a PurchaseOrder.
#
class CustomQuoteAllocation < ApplicationRecord
  # Associations
  belongs_to :custom_quote_supplier
  belongs_to :custom_quote_line  # The PO-level line receiving the allocation
  belongs_to :purchase_order, optional: true

  # Validations
  validates :allocated_amount, presence: true, numericality: { greater_than: 0 }
  validates :custom_quote_line_id, uniqueness: { scope: :custom_quote_supplier_id,
            message: "already has an allocation from this supplier" }
  validate :line_must_be_po_level
  validate :allocation_must_not_exceed_quote

  # Callbacks
  after_save :recalculate_quote_totals
  after_destroy :recalculate_quote_totals

  private

  def line_must_be_po_level
    return unless custom_quote_line&.cost_centre_line?
    errors.add(:custom_quote_line, "must be a PO-level line, not a cost centre line")
  end

  def allocation_must_not_exceed_quote
    return unless custom_quote_supplier&.price_quoted
    total = custom_quote_supplier.allocations
              .where.not(id: id)
              .sum(:allocated_amount) + (allocated_amount || 0)
    if total > custom_quote_supplier.price_quoted
      errors.add(:allocated_amount, "total allocations ($#{total}) exceed quoted price ($#{custom_quote_supplier.price_quoted})")
    end
  end

  def recalculate_quote_totals
    custom_quote = custom_quote_line&.custom_quote
    custom_quote&.recalculate_totals!
  end
end
