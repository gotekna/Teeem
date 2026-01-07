require "csv"

class PricebookImportService
  attr_reader :errors, :warnings, :stats

  def initialize(file_path, options = {})
    @file_path = file_path
    @options = {
      skip_missing_prices: false,
      create_suppliers: true,
      create_categories: true,
      update_existing: false
    }.merge(options)

    @errors = []
    @warnings = []
    @stats = {
      total_rows: 0,
      imported_count: 0,
      updated_count: 0,
      skipped_count: 0,
      error_count: 0,
      suppliers_created: 0,
      categories_created: Set.new
    }
  end

  def import
    validate_file!

    CSV.foreach(@file_path, headers: true, header_converters: :symbol) do |row|
      @stats[:total_rows] += 1
      process_row(row)
    rescue => e
      handle_row_error(row, e)
    end

    {
      success: @errors.empty?,
      stats: format_stats,
      errors: @errors,
      warnings: @warnings
    }
  end

  def preview(limit = 10)
    validate_file!

    rows = []
    CSV.foreach(@file_path, headers: true, header_converters: :symbol).first(limit) do |row|
      rows << {
        item_code: row[:item_code],
        item_name: row[:item_name],
        category: row[:category],
        current_price: row[:current_price] || row[:price],
        supplier_name: row[:supplier] || row[:supplier_name],
        unit_of_measure: row[:unit_of_measure] || row[:unit] || "Each"
      }
    end

    # Count total rows
    total_rows = CSV.read(@file_path, headers: true).length

    # Analyze data
    missing_prices = rows.count { |r| r[:current_price].blank? }
    unique_suppliers = rows.map { |r| r[:supplier_name] }.compact.uniq.length
    unique_categories = rows.map { |r| r[:category] }.compact.uniq.length

    {
      preview_rows: rows,
      analysis: {
        total_rows: total_rows,
        missing_prices: missing_prices,
        unique_suppliers: unique_suppliers,
        unique_categories: unique_categories
      }
    }
  end

  private

  def validate_file!
    raise "File not found: #{@file_path}" unless File.exist?(@file_path)
    raise "File is empty" if File.zero?(@file_path)

    # Validate CSV headers
    headers = CSV.open(@file_path, &:readline)
    required_headers = [ "item_code", "item_name" ]

    missing_headers = required_headers - headers.map(&:downcase)
    unless missing_headers.empty?
      raise "Missing required headers: #{missing_headers.join(', ')}"
    end
  end

  def process_row(row)
    item_code = row[:item_code]&.strip
    item_name = row[:item_name]&.strip

    if item_code.blank? || item_name.blank?
      @stats[:skipped_count] += 1
      @warnings << "Row #{@stats[:total_rows]}: Missing item code or name"
      return
    end

    # Parse price
    price_str = row[:current_price] || row[:price]
    current_price = parse_price(price_str)

    if current_price.nil? && @options[:skip_missing_prices]
      @stats[:skipped_count] += 1
      @warnings << "Skipped #{item_code}: Missing price"
      return
    end

    # Find or create supplier
    supplier_name = row[:supplier] || row[:supplier_name]
    supplier = find_or_create_supplier(supplier_name) if supplier_name.present?

    # Track category
    category = row[:category]&.strip
    @stats[:categories_created].add(category) if category.present?

    # Create or update item
    item = PricebookItem.find_by(item_code: item_code)

    if item
      if @options[:update_existing]
        update_item(item, row, current_price, supplier)
        @stats[:updated_count] += 1
      else
        @stats[:skipped_count] += 1
        @warnings << "Skipped #{item_code}: Already exists"
      end
    else
      create_item(row, item_code, item_name, current_price, supplier, category)
      @stats[:imported_count] += 1
    end
  rescue => e
    @stats[:error_count] += 1
    @errors << {
      row: @stats[:total_rows],
      item_code: item_code,
      error: e.message
    }
  end

  def create_item(row, item_code, item_name, current_price, supplier, category)
    PricebookItem.create!(
      item_code: item_code,
      item_name: item_name,
      category: category,
      current_price: current_price,
      supplier: supplier,
      default_supplier: supplier, # Set default supplier to match the supplier from spreadsheet
      unit_of_measure: row[:unit_of_measure] || row[:unit] || "Each",
      brand: row[:brand]&.strip,
      notes: row[:notes]&.strip,
      needs_pricing_review: current_price.nil?
    )
  end

  def update_item(item, row, current_price, supplier)
    updates = {
      item_name: row[:item_name]&.strip || item.item_name,
      category: row[:category]&.strip || item.category,
      unit_of_measure: row[:unit_of_measure] || row[:unit] || item.unit_of_measure,
      brand: row[:brand]&.strip || item.brand,
      notes: row[:notes]&.strip || item.notes
    }

    # Only update price if provided
    if current_price.present?
      updates[:current_price] = current_price
      updates[:needs_pricing_review] = false
    end

    # Only update supplier if provided
    if supplier.present?
      updates[:supplier] = supplier
      updates[:default_supplier] = supplier # Also update default supplier to match
    end

    item.update!(updates)
  end

  def find_or_create_supplier(supplier_name)
    return nil unless @options[:create_suppliers]

    # SSoT: Use entity_type in find condition to leverage unique partial index
    # DB index idx_contacts_unique_company_name prevents duplicates for active companies
    supplier = Contact.find_or_create_by(display_name: supplier_name.strip, entity_type: "company") do |c|
      c.is_active = true
    end
    @stats[:suppliers_created] += 1 if supplier.previously_new_record?
    supplier
  rescue ActiveRecord::RecordNotUnique
    # DB constraint caught a duplicate (concurrent import created it)
    Contact.find_by(display_name: supplier_name.strip, entity_type: "company", is_active: true)
  end

  def parse_price(price_str)
    return nil if price_str.blank?

    # Remove currency symbols and commas
    cleaned = price_str.to_s.gsub(/[$,\s]/, "")
    return nil if cleaned.blank? || cleaned == "-"

    Float(cleaned)
  rescue ArgumentError, TypeError
    nil
  end

  def handle_row_error(row, error)
    @stats[:error_count] += 1
    @errors << {
      row: @stats[:total_rows],
      item_code: row&.[](:item_code),
      error: error.message
    }
  end

  def format_stats
    @stats.merge(categories_created: @stats[:categories_created].size)
  end
end
