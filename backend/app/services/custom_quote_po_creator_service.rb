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

    # Create or update POs from allocations (for CC-level quotes)
    # Each allocation points to a PO-level child line.
    # If a PO already exists on the child line (via sm_task_id match),
    # update it instead of creating a duplicate.
    #
    # @param supplier [CustomQuoteSupplier]
    # @param user [User]
    # @return [Array<PurchaseOrder>]
    def create_pos_from_allocations!(supplier, user)
      pos = []

      supplier.allocations.includes(:custom_quote_line).each do |allocation|
        po_line = allocation.custom_quote_line
        next unless po_line.po_line?

        # Check for existing PO on this child line (via sm_task_id or previous allocation)
        existing_po = find_existing_po(po_line)

        if existing_po
          po = update_existing_po!(existing_po, supplier, po_line, allocation.allocated_amount, user)
        else
          po = create_po!(supplier, po_line, allocation.allocated_amount, user)
        end

        allocation.update!(purchase_order: po)
        pos << po
      end

      pos
    end

    private

    # Find existing PO on a child line via sm_task_id or previous allocation
    def find_existing_po(po_line)
      # 1. Check previous allocations on this line
      existing_alloc = CustomQuoteAllocation
        .where(custom_quote_line_id: po_line.id)
        .where.not(purchase_order_id: nil)
        .first
      return existing_alloc.purchase_order if existing_alloc&.purchase_order

      # 2. Match by sm_task_id
      if po_line.sm_task_id.present?
        return PurchaseOrder.find_by(sm_task_id: po_line.sm_task_id)
      end

      nil
    end

    # Update existing PO with new supplier, budget, and replace line items with quote line
    def update_existing_po!(po, supplier, line, amount, user)
      po.update!(
        supplier: supplier.supplier,
        budget: amount
      )

      # Remove existing line items and replace with the quoted price line
      po.line_items.destroy_all
      add_quote_line_item!(po, supplier, line, amount)

      po
    end

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

      po = PurchaseOrder.create!(po_attrs)

      # Add a line item with the quoted price
      add_quote_line_item!(po, supplier, line, amount)

      po
    end

    # Add a PO line item from the quote
    def add_quote_line_item!(po, supplier, line, amount)
      description = line.name
      description += " - #{supplier.supplier&.name}" if supplier.supplier&.name.present?

      po.line_items.create!(
        description: description,
        quantity: 1,
        unit_price: amount,
        gst_code: 'GST'
      )
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
