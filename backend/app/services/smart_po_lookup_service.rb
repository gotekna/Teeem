class SmartPoLookupService
  GST_RATE = 0.10 # 10% GST

  def initialize(construction_id:)
    @construction = Job.find(construction_id)
  end

  # Main entry point for smart PO lookup
  # Input: {
  #   task_description: "Req Water Tank",
  #   category: "plumbing",
  #   quantity: 1,
  #   supplier_preference: "WATER_TANKS"  # Optional supplier code
  # }
  def lookup(task_description:, category: nil, quantity: 1, supplier_preference: nil, **options)
    result = {
      success: true,
      supplier: nil,
      price_book_item: nil,
      suggested_price: nil,
      unit_price: nil,
      total_price: nil,
      gst_amount: nil,
      total_with_gst: nil,
      warnings: [],
      metadata: {}
    }

    # Step 1: Find supplier
    supplier = find_supplier(supplier_preference: supplier_preference, category: category)
    if supplier.nil?
      result[:warnings] << "No supplier found for category '#{category}' or code '#{supplier_preference}'"
      result[:success] = false
      return result
    end
    result[:supplier] = supplier

    # Step 2: Find matching price book item
    price_book_item = find_price_book_item(
      description: task_description,
      category: category,
      supplier: supplier
    )

    if price_book_item
      result[:price_book_item] = price_book_item
      result[:metadata][:item_code] = price_book_item.item_code
      result[:metadata][:item_name] = price_book_item.item_name
      result[:metadata][:unit_of_measure] = price_book_item.unit_of_measure
      result[:metadata][:price_age_days] = price_book_item.price_age_in_days
      result[:metadata][:price_freshness] = price_book_item.price_freshness_status
      result[:metadata][:risk_level] = price_book_item.risk_level

      # Add warnings for stale prices
      if price_book_item.price_freshness_status == "outdated"
        result[:warnings] << "Price is #{price_book_item.price_age_in_days} days old (outdated)"
      elsif price_book_item.price_freshness_status == "needs_confirmation"
        result[:warnings] << "Price is #{price_book_item.price_age_in_days} days old (needs confirmation)"
      end

      # Check price volatility
      if price_book_item.price_volatility == "volatile"
        result[:warnings] << "This item has volatile pricing history"
      end
    else
      result[:warnings] << "No price book entry found for '#{task_description}' in category '#{category}'"
    end

    # Step 3: Calculate pricing
    unit_price = calculate_unit_price(price_book_item, supplier)
    result[:suggested_price] = price_book_item&.current_price
    result[:unit_price] = unit_price

    # Calculate totals
    quantity_decimal = BigDecimal(quantity.to_s)
    subtotal = unit_price * quantity_decimal
    gst_amount = subtotal * GST_RATE
    total_with_gst = subtotal + gst_amount

    result[:total_price] = subtotal.to_f
    result[:gst_amount] = gst_amount.to_f
    result[:total_with_gst] = total_with_gst.to_f

    # Step 4: Add delivery address from construction
    result[:metadata][:delivery_address] = @construction.title

    # Step 5: Check if price differs significantly from price book
    if price_book_item && supplier.markup_percentage && supplier.markup_percentage > 0
      markup_amount = ((supplier.markup_percentage / 100) * price_book_item.current_price).to_f
      result[:warnings] << "Supplier markup of #{supplier.markup_percentage}% applied ($#{markup_amount.round(2)})"
    end

    result
  end

  # Bulk lookup for multiple POs
  def bulk_lookup(po_requests)
    po_requests.map do |request|
      lookup(**request.symbolize_keys)
    end
  end

  private

  def find_supplier(supplier_preference:, category:)
    # Priority 1: Supplier code (e.g., WATER_TANKS)
    # Note: Suppliers are just contacts with purchase orders or pricebook items
    if supplier_preference.present?
      supplier = Contact.find_by(supplier_code: supplier_preference)
      return supplier if supplier
    end

    # Priority 2: Default supplier for trade category
    if category.present?
      supplier = Contact.where("is_default_for_trades ? :category", category: category).first
      return supplier if supplier
    end

    # Priority 3: Any contact with trade categories for this category
    if category.present?
      supplier = Contact.where("trade_categories @> ?", [ category ].to_json).first
      return supplier if supplier
    end

    # Fallback: Find any contact that has pricebook items (making them a supplier)
    # This ensures we get an actual supplier, not just any random contact
    Contact.joins(:pricebook_items).where(is_active: true).distinct.first
  end

  def find_price_book_item(description:, category:, supplier:)
    # Try multiple search strategies

    # Strategy 1: Exact match on item name in category with supplier
    item = PricebookItem.active
      .where(supplier_id: supplier.id)
      .where("LOWER(item_name) = ?", description.to_s.downcase)
      .by_category(category)
      .first
    return item if item

    # Strategy 2: Fuzzy match on item name (contains) in category with supplier
    item = PricebookItem.active
      .where(supplier_id: supplier.id)
      .where("LOWER(item_name) LIKE ?", "%#{description.to_s.downcase}%")
      .by_category(category)
      .first
    return item if item

    # Strategy 3: Full-text search with supplier
    item = PricebookItem.active
      .where(supplier_id: supplier.id)
      .search(description)
      .by_category(category)
      .first
    return item if item

    # Strategy 4: Relax supplier requirement - exact match in category
    item = PricebookItem.active
      .where("LOWER(item_name) = ?", description.to_s.downcase)
      .by_category(category)
      .first
    return item if item

    # Strategy 5: Relax supplier requirement - fuzzy match in category
    item = PricebookItem.active
      .where("LOWER(item_name) LIKE ?", "%#{description.to_s.downcase}%")
      .by_category(category)
      .first
    return item if item

    # Strategy 6: Full-text search without supplier constraint
    item = PricebookItem.active
      .search(description)
      .by_category(category)
      .first
    return item if item

    nil
  end

  def calculate_unit_price(price_book_item, supplier)
    return BigDecimal("0") if price_book_item.nil? || price_book_item.current_price.nil?

    base_price = BigDecimal(price_book_item.current_price.to_s)

    # Apply supplier markup if configured
    if supplier.markup_percentage && supplier.markup_percentage > 0
      markup_multiplier = 1 + (BigDecimal(supplier.markup_percentage.to_s) / 100)
      base_price * markup_multiplier
    else
      base_price
    end
  end
end
