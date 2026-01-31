# frozen_string_literal: true

module ImportValidators
  # PriceHistoryValidator - Validates price history import data
  #
  # Validates price history for import, checking:
  # - Required item_code and new_price
  # - Item code exists in pricebook
  # - Currency format for prices
  # - Date format for date_effective
  #
  class PriceHistoryValidator < BaseValidator
    REQUIRED_COLUMNS = %w[item_code new_price].freeze

    OPTIONAL_COLUMNS = %w[
      old_price date_effective supplier_name change_reason
    ].freeze

    def initialize(rows, options = {})
      super
      @pricebook_items = PricebookItem.pluck(:item_code, :id).to_h
      @suppliers = Contact.where("is_supplier = ? OR supplier_code IS NOT NULL", true).pluck(:display_name, :id).to_h
    end

    protected

    def validate_row(row, row_number)
      # Required fields
      validate_required(row, row_number, 'item_code', row['item_code'])
      validate_required(row, row_number, 'new_price', row['new_price'])

      # Validate item_code exists
      item_code = row['item_code']
      if item_code.present? && !@pricebook_items.key?(item_code)
        add_error(row_number, "Item code not found in pricebook: #{item_code}", column: 'item_code', value: item_code)
      end

      # Validate currency format
      validate_currency(row, row_number, 'new_price', row['new_price'])
      validate_currency(row, row_number, 'old_price', row['old_price'])

      # Validate date
      validate_date(row, row_number, 'date_effective', row['date_effective'])

      # Validate supplier reference
      supplier_name = row['supplier_name']
      if supplier_name.present? && !@suppliers.key?(supplier_name)
        add_warning(row_number, "Supplier not found: #{supplier_name}", column: 'supplier_name', value: supplier_name)
      end

      # Validate price change makes sense
      old_price = parse_currency(row['old_price'])
      new_price = parse_currency(row['new_price'])

      if old_price.present? && new_price.present? && old_price == new_price
        add_warning(row_number, "Old price equals new price", column: 'new_price')
      end

      if new_price.present? && new_price.negative?
        add_error(row_number, "Price cannot be negative", column: 'new_price', value: row['new_price'])
      end
    end

    def preview_row(row, row_number)
      old_price = row['old_price']
      new_price = row['new_price']
      change = calculate_change(old_price, new_price)

      {
        row: row_number,
        item_code: row['item_code'],
        old_price: format_currency(old_price),
        new_price: format_currency(new_price),
        change: change,
        date_effective: row['date_effective'] || 'Today',
        supplier: row['supplier_name'],
        reason: row['change_reason'],
        status: row_status(row, row_number),
        errors: row_errors(row_number),
        warnings: row_warnings(row_number),
        action: 'create'
      }
    end

    private

    def parse_currency(value)
      return nil if value.blank?

      value.to_s.gsub(/[$,]/, '').to_f
    rescue StandardError
      nil
    end

    def format_currency(value)
      return nil if value.blank?

      cleaned = value.to_s.gsub(/[$,]/, '')
      "$#{format('%.2f', cleaned.to_f)}"
    rescue StandardError
      value
    end

    def calculate_change(old_price, new_price)
      old_val = parse_currency(old_price)
      new_val = parse_currency(new_price)

      return nil if old_val.nil? || new_val.nil? || old_val.zero?

      percentage = ((new_val - old_val) / old_val * 100).round(1)
      if percentage.positive?
        "+#{percentage}%"
      elsif percentage.negative?
        "#{percentage}%"
      else
        "0%"
      end
    end
  end
end
