class InvoiceMatchingService
  # Matches a Xero invoice to a PurchaseOrder and updates payment status
  #
  # @param invoice_data [Hash] Xero invoice data
  # @param purchase_order_id [Integer] Optional - specific PO to match to
  # @return [Hash] Result with success status and matched PO
  def self.call(invoice_data:, purchase_order_id: nil)
    new(invoice_data, purchase_order_id).call
  end

  def initialize(invoice_data, purchase_order_id = nil)
    @invoice_data = invoice_data
    @purchase_order_id = purchase_order_id
  end

  def call
    # Extract invoice details
    invoice_number = @invoice_data["InvoiceNumber"]
    invoice_id = @invoice_data["InvoiceID"]
    invoice_date = parse_date(@invoice_data["Date"] || @invoice_data["DateString"])
    invoice_total = @invoice_data["Total"].to_f
    supplier_name = @invoice_data.dig("Contact", "Name")

    Rails.logger.info("Matching Xero invoice: #{invoice_number} (#{invoice_id}) - Total: #{invoice_total}")

    # Find matching PO
    purchase_order = find_matching_po(invoice_number, supplier_name)

    unless purchase_order
      return {
        success: false,
        error: "No matching Purchase Order found for invoice #{invoice_number}",
        invoice_number: invoice_number,
        supplier_name: supplier_name
      }
    end

    # Apply invoice to PO
    begin
      new_status = purchase_order.apply_invoice!(
        invoice_amount: invoice_total,
        invoice_date: invoice_date,
        invoice_reference: invoice_id || invoice_number
      )

      Rails.logger.info("Matched invoice #{invoice_number} to PO #{purchase_order.purchase_order_number} - Status: #{new_status}")

      {
        success: true,
        purchase_order: purchase_order,
        payment_status: new_status,
        invoice_number: invoice_number,
        invoice_total: invoice_total,
        po_total: purchase_order.total,
        percentage: purchase_order.payment_percentage,
        message: status_message(new_status, invoice_total, purchase_order.total)
      }
    rescue StandardError => e
      Rails.logger.error("Failed to apply invoice to PO: #{e.message}")
      {
        success: false,
        error: "Failed to update Purchase Order: #{e.message}",
        purchase_order_number: purchase_order.purchase_order_number
      }
    end
  end

  private

  # PO number extraction patterns supporting various supplier formats
  PO_PATTERNS = [
    /PO[-\s]?\d+/i,                    # PO-123, PO 123, PO123
    /P\.O\.?[-\s]?\d+/i,               # P.O. 123, P.O.-123, P.O.123
    /Purchase\s+Order[-\s]?\d+/i,      # Purchase Order 123, Purchase Order-123
    /P\/O[-\s]?\d+/i,                  # P/O-123, P/O 123
    /Order\s+Ref:?\s*\d+/i             # Order Ref: 123, Order Ref 123
  ].freeze

  # Find matching PO using multiple strategies with fuzzy extraction and normalization
  # Checks: Reference field, InvoiceNumber, LineItems, normalized matching, supplier + amount
  def find_matching_po(invoice_number, supplier_name)
    # If specific PO ID provided, use that
    if @purchase_order_id.present?
      return PurchaseOrder.find_by(id: @purchase_order_id)
    end

    # Strategy 1: Check Reference field (highest priority - most reliable)
    # Suppliers often put PO numbers in the Reference field of Xero invoices
    reference = @invoice_data["Reference"]
    if reference.present?
      # Try exact match first
      po = PurchaseOrder.find_by(purchase_order_number: reference)
      return po if po

      # Extract PO numbers from Reference using multiple patterns
      po_candidates = extract_po_numbers(reference)
      po_candidates.each do |candidate|
        po = find_po_by_candidate(candidate)
        return po if po
      end
    end

    # Strategy 2: Extract from InvoiceNumber with multiple patterns
    # Common formats: "PO-123456", "Invoice for PO-123456", "PO123456", etc.
    if invoice_number.present?
      # Try exact match first
      po = PurchaseOrder.find_by(purchase_order_number: invoice_number)
      return po if po

      # Extract PO numbers using fuzzy patterns
      po_candidates = extract_po_numbers(invoice_number)
      po_candidates.each do |candidate|
        po = find_po_by_candidate(candidate)
        return po if po
      end
    end

    # Strategy 3: Check LineItems descriptions
    # Some suppliers include PO numbers in line item descriptions
    line_items = @invoice_data["LineItems"] || []
    line_items.each do |item|
      description = item["Description"]
      next if description.blank?

      po_candidates = extract_po_numbers(description)
      po_candidates.each do |candidate|
        po = find_po_by_candidate(candidate)
        return po if po
      end
    end

    # Strategy 4: Normalized matching (handles different zero-padding)
    # "PO-001" should match "PO-000001" by comparing numeric portion
    if invoice_number.present?
      normalized = normalize_po_number(invoice_number)
      if normalized
        po = find_po_by_normalized_number(normalized)
        return po if po
      end
    end

    if reference.present?
      normalized = normalize_po_number(reference)
      if normalized
        po = find_po_by_normalized_number(normalized)
        return po if po
      end
    end

    # Strategy 5: Match by supplier and approximate amount (fallback)
    # Only used when no PO number found in invoice
    if supplier_name.present?
      supplier = find_supplier(supplier_name)
      if supplier
        # Find POs for this supplier that don't have invoices yet
        # and are within 10% of the invoice total
        invoice_total = @invoice_data["Total"].to_f
        tolerance = invoice_total * 0.1

        po = PurchaseOrder
          .where(supplier_id: supplier.id)
          .where("payment_status = ? OR payment_status IS NULL", "pending")
          .where("total BETWEEN ? AND ?", invoice_total - tolerance, invoice_total + tolerance)
          .order(created_at: :desc)
          .first

        return po if po
      end
    end

    # Strategy 6: Match by exact invoice reference stored in PO (legacy)
    if invoice_number.present?
      po = PurchaseOrder.find_by(invoice_reference: invoice_number)
      return po if po
    end

    nil
  end

  # Extract all potential PO numbers from text using multiple patterns
  # Returns array of candidate PO numbers (formatted as "PO-XXXXXX")
  def extract_po_numbers(text)
    return [] if text.blank?

    candidates = []

    PO_PATTERNS.each do |pattern|
      matches = text.scan(pattern)
      matches.flatten.each do |match|
        # Extract just the number portion and format consistently
        number = match.gsub(/[^\d]/, "")
        next if number.blank?

        # Format as standard PO number
        formatted = "PO-#{number.rjust(6, '0')}"
        candidates << formatted
      end
    end

    candidates.uniq
  end

  # Normalize PO number for comparison
  # Strips all non-digits and converts to integer to remove leading zeros
  # "PO-001" → 1, "PO-000001" → 1, "PO123456" → 123456
  def normalize_po_number(text)
    return nil if text.blank?

    # Extract digits only
    digits = text.gsub(/[^\d]/, "")
    return nil if digits.blank?

    # Convert to integer to remove leading zeros
    digits.to_i
  end

  # Find PO by candidate string (exact match or fuzzy extraction)
  def find_po_by_candidate(candidate)
    # Try exact match
    po = PurchaseOrder.find_by(purchase_order_number: candidate)
    return po if po

    # Try with different zero-padding
    # "PO-123" could match "PO-000123"
    number = candidate.gsub(/[^\d]/, "").to_i
    find_po_by_normalized_number(number)
  end

  # Find PO by normalized number (integer comparison)
  # Handles different zero-padding: "PO-001" vs "PO-000001"
  def find_po_by_normalized_number(normalized_number)
    return nil if normalized_number.nil? || normalized_number.zero?

    # Search all POs and compare normalized numbers
    # This is intentionally inefficient but handles edge cases
    # For better performance, consider adding a normalized_number column
    PurchaseOrder.find_each do |po|
      next if po.purchase_order_number.blank?

      po_normalized = normalize_po_number(po.purchase_order_number)
      return po if po_normalized == normalized_number
    end

    nil
  end

  def find_supplier(supplier_name)
    # Try exact match first (suppliers are just contacts with purchase orders or bills)
    supplier = Contact.find_by("LOWER(display_name) = ?", supplier_name.downcase)
    return supplier if supplier

    # Try fuzzy match (contains)
    supplier = Contact.where("LOWER(display_name) LIKE ?", "%#{supplier_name.downcase}%").first
    supplier
  end

  def parse_date(date_string)
    return nil if date_string.blank?

    # Xero date format: /Date(1609459200000+0000)/
    if date_string.is_a?(String) && date_string.match?(/\/Date\((\d+)/)
      timestamp = date_string.match(/\/Date\((\d+)/)[1].to_i / 1000
      Time.at(timestamp).to_date
    elsif date_string.is_a?(String)
      Date.parse(date_string) rescue nil
    elsif date_string.is_a?(Date)
      date_string
    else
      nil
    end
  end

  def status_message(status, invoice_total, po_total)
    case status
    when "complete"
      "Invoice amount ($#{invoice_total}) is within 5% of PO total ($#{po_total})"
    when "part_payment"
      "Invoice amount ($#{invoice_total}) is less than 95% of PO total ($#{po_total})"
    when "manual_review"
      if invoice_total > po_total
        "Invoice amount ($#{invoice_total}) exceeds PO total ($#{po_total}) by $#{(invoice_total - po_total).round(2)}"
      else
        "Invoice requires manual review"
      end
    else
      "Payment status: #{status}"
    end
  end
end
