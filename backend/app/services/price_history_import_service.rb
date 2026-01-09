class PriceHistoryImportService
  attr_reader :file_path, :errors, :warnings, :effective_date_override

  # Valid LGA values from PriceHistory model
  VALID_LGAS = [
    "Toowoomba Regional Council",
    "Lockyer Valley Regional Council",
    "City of Gold Coast",
    "Brisbane City Council",
    "Sunshine Coast Regional Council",
    "Redland City Council",
    "Scenic Rim Regional Council"
  ].freeze

  def initialize(file_path, effective_date: nil)
    @file_path = file_path
    @effective_date_override = effective_date
    @errors = []
    @warnings = []
    @stats = {
      total_rows: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    }
  end

  def import
    return { success: false, errors: @errors } unless validate_file

    begin
      spreadsheet = TeeemXl::SpreadsheetAdapter.open(@file_path)

      # Parse headers
      headers = parse_headers(spreadsheet)
      return { success: false, errors: @errors } unless headers

      # Process rows within a transaction
      ActiveRecord::Base.transaction do
        process_rows(spreadsheet, headers)
      end

      {
        success: true,
        stats: @stats,
        warnings: @warnings
      }
    rescue => e
      @errors << "Import failed: #{e.message}"
      Rails.logger.error "Price history import error: #{e.message}\n#{e.backtrace.join("\n")}"
      { success: false, errors: @errors, stats: @stats }
    end
  end

  private

  def validate_file
    unless File.exist?(@file_path)
      @errors << "File does not exist"
      return false
    end

    extension = File.extname(@file_path).downcase
    unless [ ".csv", ".xlsx" ].include?(extension)
      @errors << "Invalid file format. Please upload CSV or Excel (.xlsx) files only."
      return false
    end

    true
  end

  def parse_headers(spreadsheet)
    headers = {}
    (1..spreadsheet.last_column).each do |col|
      header = spreadsheet.cell(1, col).to_s.strip
      headers[header.downcase] = col
    end

    # Validate required headers - accept both "historical price" and "current price"
    has_item_id = headers.key?("item id")
    has_price = headers.key?("historical price") || headers.key?("current price")

    if !has_item_id || !has_price
      missing = []
      missing << "item id" unless has_item_id
      missing << "historical price or current price" unless has_price
      @errors << "Missing required columns: #{missing.join(', ')}"
      return nil
    end

    # Normalize price column name to 'historical price' for backward compatibility
    if headers.key?("current price") && !headers.key?("historical price")
      headers["historical price"] = headers["current price"]
    end

    headers
  end

  def process_rows(spreadsheet, headers)
    @stats[:total_rows] = spreadsheet.last_row - 1

    (2..spreadsheet.last_row).each do |row_num|
      begin
        process_row(spreadsheet, headers, row_num)
        @stats[:processed] += 1
      rescue => e
        @stats[:errors] += 1
        @errors << "Row #{row_num}: #{e.message}"
        Rails.logger.error "Row #{row_num} error: #{e.message}"
        # Continue processing other rows
      end
    end
  end

  def process_row(spreadsheet, headers, row_num)
    # Extract data from row
    row_data = extract_row_data(spreadsheet, headers, row_num)

    # Validate item exists
    item = PricebookItem.find_by(id: row_data[:item_id])
    unless item
      @warnings << "Row #{row_num}: Item ID #{row_data[:item_id]} not found - skipping"
      @stats[:skipped] += 1
      return
    end

    # Skip if no historical price provided
    if row_data[:historical_price].blank?
      @warnings << "Row #{row_num}: No historical price provided - skipping"
      @stats[:skipped] += 1
      return
    end

    # Find or create price history
    history = find_or_initialize_history(item, row_data)

    if history.new_record?
      if history.save
        @stats[:created] += 1
      else
        @stats[:errors] += 1
        @errors << "Row #{row_num}: Failed to create price history - #{history.errors.full_messages.join(', ')}"
      end
    else
      # Update existing record
      if update_history(history, row_data)
        @stats[:updated] += 1
      else
        @stats[:errors] += 1
        @errors << "Row #{row_num}: Failed to update price history - #{history.errors.full_messages.join(', ')}"
      end
    end
  end

  def extract_row_data(spreadsheet, headers, row_num)
    data = {}

    # Item ID (required)
    data[:item_id] = spreadsheet.cell(row_num, headers["item id"])&.to_i

    # Price History ID (optional - for updates)
    data[:history_id] = spreadsheet.cell(row_num, headers["price history id"])&.to_i if headers["price history id"]

    # Historical Price (required)
    data[:historical_price] = parse_currency(spreadsheet.cell(row_num, headers["historical price"]))

    # Previous Price (optional)
    data[:previous_price] = parse_currency(spreadsheet.cell(row_num, headers["previous price"])) if headers["previous price"]

    # Date Effective (optional)
    if headers["date effective"]
      date_cell = spreadsheet.cell(row_num, headers["date effective"])
      data[:date_effective] = parse_date(date_cell)
    end

    # Supplier (optional)
    if headers["supplier"]
      supplier_name = spreadsheet.cell(row_num, headers["supplier"])&.to_s&.strip
      data[:supplier] = find_or_create_supplier(supplier_name) if supplier_name.present?
    end

    # LGA (optional)
    if headers["lga"]
      lga_value = spreadsheet.cell(row_num, headers["lga"])&.to_s&.strip
      data[:lga] = validate_lga(lga_value) if lga_value.present?
    end

    # Change Reason (optional)
    if headers["change reason"]
      data[:change_reason] = spreadsheet.cell(row_num, headers["change reason"])&.to_s&.strip
    end

    # Quote Reference (optional)
    if headers["quote reference"]
      data[:quote_reference] = spreadsheet.cell(row_num, headers["quote reference"])&.to_s&.strip
    end

    data
  end

  def find_or_initialize_history(item, row_data)
    # If history ID is provided, try to find and update existing record
    if row_data[:history_id].present?
      history = PriceHistory.find_by(id: row_data[:history_id], pricebook_item_id: item.id)
      return history if history
    end

    # Determine effective date: override > row data > today
    effective_date = @effective_date_override || row_data[:date_effective] || CorporateCompanySetting.today

    # Create new price history record
    PriceHistory.new(
      pricebook_item: item,
      new_price: row_data[:historical_price],
      old_price: row_data[:previous_price],
      supplier_id: row_data[:supplier]&.id,
      lga: row_data[:lga],
      date_effective: effective_date,
      change_reason: row_data[:change_reason] || "imported_from_excel",
      quote_reference: row_data[:quote_reference]
    )
  end

  def update_history(history, row_data)
    # Determine effective date: override > row data > existing
    effective_date = @effective_date_override || row_data[:date_effective] || history.date_effective

    history.update(
      new_price: row_data[:historical_price],
      old_price: row_data[:previous_price] || history.old_price,
      supplier_id: row_data[:supplier]&.id || history.supplier_id,
      lga: row_data[:lga] || history.lga,
      date_effective: effective_date,
      change_reason: row_data[:change_reason] || history.change_reason,
      quote_reference: row_data[:quote_reference] || history.quote_reference
    )
  end

  def parse_currency(value)
    return nil if value.blank?

    # Handle numeric values
    return value.to_f if value.is_a?(Numeric)

    # Handle string values (remove currency symbols and commas)
    value.to_s.gsub(/[$,]/, "").to_f
  end

  def parse_date(value)
    return nil if value.blank?

    # If it's already a Date or DateTime object
    return value.to_date if value.respond_to?(:to_date)

    # Try parsing string
    begin
      Date.parse(value.to_s)
    rescue ArgumentError
      nil
    end
  end

  def find_or_create_supplier(name)
    return nil if name.blank?

    # Try to find existing contact by name (suppliers are just contacts with purchase orders/pricebook items)
    supplier = Contact.find_by("LOWER(display_name) = ?", name.downcase)

    # Create new contact if not found
    unless supplier
      supplier = Contact.create!(
        display_name: name,
        entity_type: "company", # Default to company for suppliers
        is_active: true
      )
      @warnings << "Created new contact: #{name}"
    end

    supplier
  end

  def validate_lga(value)
    return nil if value.blank?

    # Check if it's a valid LGA
    matched = VALID_LGAS.find { |lga| lga.downcase == value.downcase }

    unless matched
      @warnings << "Invalid LGA value '#{value}' - will be ignored. Valid values: #{VALID_LGAS.join(', ')}"
      return nil
    end

    matched
  end
end
