class EstimateToPurchaseOrderService
  def initialize(estimate)
    @estimate = estimate
    @construction = estimate.construction
    @created_pos = []
    @warnings = []
  end

  def execute
    # Validation checks
    return error_result("Estimate already imported") if @estimate.status_imported?
    return error_result("Must be matched to a job first") unless @construction
    return error_result("No items to import") if @estimate.estimate_line_items.empty?

    # Group line items by category
    grouped_items = @estimate.estimate_line_items.group_by(&:category)

    # Create POs for each category
    grouped_items.each do |category, items|
      create_po_for_category(category, items)
    end

    # Mark estimate as imported
    @estimate.update!(status: :imported)

    success_result
  rescue StandardError => e
    Rails.logger.error("EstimateToPurchaseOrderService Error: #{e.message}")
    Rails.logger.error(e.backtrace.join("\n"))
    error_result("Failed to generate purchase orders: #{e.message}")
  end

  private

  def create_po_for_category(category, items)
    # Use Smart Lookup to find best supplier for this category
    # Take the first item as representative for supplier lookup
    first_item = items.first
    lookup_result = SmartPoLookupService.new(construction_id: @construction.id).lookup(
      task_description: first_item.item_description,
      category: category,
      quantity: first_item.quantity
    )

    supplier_id = lookup_result[:supplier]&.id

    # Track if any items need review
    needs_review = supplier_id.nil?

    # Create the PO
    po = PurchaseOrder.create!(
      construction_id: @construction.id,
      estimate_id: @estimate.id,
      supplier_id: supplier_id,
      description: "Auto-generated from #{@estimate.source} estimate",
      status: "draft",
      required_date: 14.days.from_now.to_date,
      delivery_address: @construction.title,
      special_instructions: build_po_notes(category, supplier_id, needs_review)
    )

    # Create line items
    items.each_with_index do |item, index|
      # Use Smart Lookup for each item to get pricing
      item_lookup = SmartPoLookupService.new(construction_id: @construction.id).lookup(
        task_description: item.item_description,
        category: category,
        quantity: item.quantity
      )

      pricebook_item_id = item_lookup[:price_book_item]&.id
      unit_price = item_lookup[:unit_price] || 0

      # Track warnings
      @warnings.concat(item_lookup[:warnings]) if item_lookup[:warnings].any?

      PurchaseOrderLineItem.create!(
        purchase_order: po,
        line_number: index + 1,
        description: item.item_description,
        quantity: item.quantity,
        unit_price: unit_price,
        pricebook_item_id: pricebook_item_id,
        notes: item.notes
      )
    end

    # Recalculate totals
    po.calculate_totals
    po.save!

    @created_pos << {
      id: po.id,
      purchase_order_number: po.purchase_order_number,
      supplier_name: po.supplier&.name,
      category: category,
      items_count: items.count,
      total: po.total.to_f,
      status: po.status,
      needs_review: needs_review
    }
  end

  def build_po_notes(category, supplier_id, needs_review)
    notes = [ "Category: #{category}" ]

    if needs_review
      notes << "NEEDS REVIEW: No supplier found for this category"
    end

    if @warnings.any?
      notes << "Pricing warnings: #{@warnings.uniq.join(', ')}"
    end

    notes.join("\n")
  end

  def success_result
    {
      success: true,
      estimate_id: @estimate.id,
      purchase_orders_created: @created_pos.count,
      purchase_orders: @created_pos,
      estimate_status: @estimate.status,
      warnings: @warnings.uniq
    }
  end

  def error_result(message)
    {
      success: false,
      error: message
    }
  end
end
