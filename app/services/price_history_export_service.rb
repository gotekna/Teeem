require "caxlsx"

class PriceHistoryExportService
  attr_reader :supplier_id, :category, :item_ids, :errors

  def initialize(supplier_id: nil, category: nil, item_ids: nil)
    @supplier_id = supplier_id
    @category = category
    @item_ids = item_ids
    @errors = []
  end

  def export
    # Fetch pricebook items based on filters
    items = fetch_items

    if items.empty?
      @errors << "No items found for the selected filters"
      return { success: false, errors: @errors }
    end

    # Generate Excel file
    begin
      package = generate_excel(items)

      {
        success: true,
        filename: generate_filename,
        content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        data: package.to_stream.read,
        total_items: items.count
      }
    rescue => e
      @errors << "Failed to generate Excel file: #{e.message}"
      { success: false, errors: @errors }
    end
  end

  private

  def fetch_items
    items = PricebookItem.includes(:default_supplier, price_histories: :supplier).active

    # If specific item IDs are provided, filter by them (takes priority)
    if @item_ids.present?
      items = items.where(id: @item_ids)
    else
      # Otherwise apply supplier and category filters
      items = items.by_supplier(@supplier_id) if @supplier_id.present?
      items = items.by_category(@category) if @category.present?
    end

    items
  end

  def generate_excel(items)
    package = Axlsx::Package.new

    package.workbook.add_worksheet(name: "Pricebook") do |sheet|
      # Add header row - no styling to avoid corruption
      # Columns match the import format for easy round-trip editing
      sheet.add_row([
        "Item ID",
        "Item Code",
        "Item Name",
        "Category",
        "Unit of Measure",
        "Current Price",
        "Supplier",
        "Date Effective",
        "LGA",
        "Brand",
        "Notes"
      ])

      # Add data rows - one row per item with current price only
      items.each do |item|
        # Use default_supplier (Contact with supplier type)
        supplier_name = item.default_supplier&.display_name

        sheet.add_row([
          item.id,
          item.item_code.to_s,
          item.item_name.to_s,
          item.category.to_s,
          item.unit_of_measure.to_s,
          item.current_price,
          supplier_name.to_s,
          item.price_last_updated_at&.to_date,
          nil, # LGA - can be filled in by user for import
          item.brand.to_s,
          item.notes.to_s
        ])
      end
    end

    package
  end

  def generate_filename
    parts = [ "pricebook" ]

    if @item_ids.present?
      parts << "selected_#{@item_ids.length}_items"
    else
      if @supplier_id.present?
        # Find Contact with supplier type
        supplier = Contact.find_by(id: @supplier_id)
        parts << sanitize_filename(supplier.display_name) if supplier
      end

      if @category.present?
        parts << sanitize_filename(@category)
      end
    end

    parts << CorporateCompanySetting.today.strftime("%Y%m%d")

    "#{parts.join('_')}.xlsx"
  end

  def sanitize_filename(name)
    name.to_s.gsub(/[^a-zA-Z0-9_-]/, "_").gsub(/_+/, "_")
  end

  def sanitize_cell_value(value)
    return nil if value.nil?
    return nil if value.to_s.strip.empty?

    # Convert to string
    clean_value = value.to_s.strip

    # For very simple strings (alphanumeric with common punctuation), return as-is
    if clean_value.match?(/\A[\w\s\-.,\/()&]+\z/)
      return clean_value
    end

    # Remove any invalid UTF-8 sequences
    clean_value = clean_value.encode("UTF-8", invalid: :replace, undef: :replace, replace: "")

    # Remove control characters one by one to avoid regex issues
    # Keep only printable characters, tabs, newlines, and carriage returns
    clean_value = clean_value.chars.select do |char|
      code = char.ord
      # Allow tab (9), newline (10), carriage return (13), and printable ASCII (32-126)
      # Also allow Unicode characters (128+)
      code == 9 || code == 10 || code == 13 || (code >= 32 && code <= 126) || code >= 128
    end.join

    # Truncate very long text to prevent Excel issues (32,767 character limit per cell)
    clean_value = clean_value[0..32000] if clean_value.length > 32000

    # Replace multiple consecutive line breaks with double line break
    clean_value = clean_value.gsub(/\n{3,}/, "\n\n")

    # Remove leading/trailing whitespace
    clean_value = clean_value.strip

    # Return nil if nothing left after sanitization (caxlsx handles nil better than empty string)
    clean_value.empty? ? nil : clean_value
  end
end
