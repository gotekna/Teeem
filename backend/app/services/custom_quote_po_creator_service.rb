# frozen_string_literal: true

# CustomQuotePoCreatorService - Creates Purchase Orders from accepted custom quotes
#
# Two creation paths:
#
# 1. PO-level quotes: Supplier accepted on a PO line → create PO directly
# 2. CC-level quotes: Supplier accepted on a CC line → allocations break down
#    to PO lines → create POs from allocations
#
# Pattern follows QuoteTracker.accept_and_create_po! but with allocation support.
#
class CustomQuotePoCreatorService
  class << self
    # Accept a quote and create PO(s)
    #
    # For PO-level: Creates one PO directly
    # For CC-level: Creates POs from each allocation
    #
    # @param supplier [CustomQuoteSupplier]
    # @param user [User]
    # @return [Array<PurchaseOrder>] created POs
    def accept!(supplier:, user:)
      raise "Cannot accept quote without a price" unless supplier.price_quoted.present?
      raise "Quote already accepted" if supplier.status == 'accepted'

      line = supplier.custom_quote_line
      pos = []

      ActiveRecord::Base.transaction do
        supplier.update!(status: 'accepted')

        # Reject other suppliers on the same line
        reject_siblings!(supplier)

        if line.cost_centre_line? && line.quote_level == 'cost_centre'
          # CC-level: create POs from allocations
          pos = create_pos_from_allocations!(supplier, user)
        else
          # PO-level: create single PO
          po = create_po!(supplier, line, supplier.price_quoted, user)
          supplier.update!(purchase_order: po)
          pos = [po]
        end

        # Recalculate totals
        line.custom_quote.recalculate_totals!
      end

      pos
    end

    # Create POs from allocations (for CC-level quotes)
    # Each allocation points to a PO-level child line
    #
    # @param supplier [CustomQuoteSupplier]
    # @param user [User]
    # @return [Array<PurchaseOrder>]
    def create_pos_from_allocations!(supplier, user)
      pos = []

      supplier.allocations.includes(:custom_quote_line).each do |allocation|
        po_line = allocation.custom_quote_line
        next unless po_line.po_line?

        po = create_po!(supplier, po_line, allocation.allocated_amount, user)
        allocation.update!(purchase_order: po)
        pos << po
      end

      pos
    end

    private

    def create_po!(supplier, line, amount, user)
      job = line.custom_quote.job
      description = build_po_description(supplier, line)

      po_attrs = {
        job: job,
        supplier: supplier.supplier,
        description: description,
        status: 'draft',
        budget: amount
      }

      # Link PO to the job-level SmTask if available
      po_attrs[:sm_task] = line.sm_task if line.sm_task.present?

      PurchaseOrder.create!(po_attrs)
    end

    def build_po_description(supplier, line)
      parts = []
      parts << line.name
      parts << "Quote #{supplier.quote_number}" if supplier.quote_number.present?
      # Use PO description if available, otherwise tender description
      desc = line.po_description.presence || line.tender_description.presence
      parts << desc if desc.present?
      parts.join(" - ").truncate(500)
    end

    def reject_siblings!(supplier)
      CustomQuoteSupplier
        .where(custom_quote_line_id: supplier.custom_quote_line_id)
        .where.not(id: supplier.id)
        .where(status: %w[draft sent responded])
        .update_all(status: 'rejected')
    end
  end
end
