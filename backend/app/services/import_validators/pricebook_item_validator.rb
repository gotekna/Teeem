# frozen_string_literal: true

module ImportValidators
  # PricebookItemValidator - Validates pricebook item import data
  #
  # Validates pricebook items for import, checking:
  # - Required item_code and item_name
  # - Currency format for prices
  # - Supplier lookup
  # - Duplicate detection
  #
  class PricebookItemValidator < BaseValidator
    REQUIRED_COLUMNS = %w[item_code item_name].freeze

    OPTIONAL_COLUMNS = %w[
      category unit_of_measure current_price
      supplier_name brand description
    ].freeze

    def initialize(rows, options = {})
      super
      @existing_item_codes = PricebookItem.pluck(:item_code)
      @suppliers = Contact.where("is_supplier = ? OR supplier_code IS NOT NULL", true).pluck(:display_name, :id).to_h
      @categories = PricebookCategory.pluck(:name)
    end

    protected

    def validate_row(row, row_number)
      # Required fields
      validate_required(row, row_number, 'item_code', row['item_code'])
      validate_required(row, row_number, 'item_name', row['item_name'])

      # Validate item code format (no special characters that could cause issues)
      item_code = row['item_code']
      if item_code.present? && item_code.match?(/[<>'"&]/)
        add_error(row_number, "Item code contains invalid characters", column: 'item_code', value: item_code)
      end

      # Check for duplicate item code
      if item_code.present? && @existing_item_codes.include?(item_code)
        if options[:update_existing]
          add_warning(row_number, "Item code exists - will update", column: 'item_code', value: item_code)
        else
          add_error(row_number, "Item code already exists: #{item_code}", column: 'item_code', value: item_code)
        end
      end

      # Validate currency
      validate_currency(row, row_number, 'current_price', row['current_price'])

      # Validate category lookup
      category = row['category']
      if category.present?
        validate_lookup(row, row_number, 'category', category, @categories, auto_create: options[:auto_create_lookups])
      end

      # Validate supplier reference
      supplier_name = row['supplier_name']
      if supplier_name.present? && !@suppliers.key?(supplier_name)
        add_warning(row_number, "Supplier not found: #{supplier_name}", column: 'supplier_name', value: supplier_name)
      end
    end

    def preview_row(row, row_number)
      price = row['current_price']
      formatted_price = price.present? ? format_currency(price) : nil

      {
        row: row_number,
        item_code: row['item_code'],
        item_name: row['item_name'],
        category: row['category'],
        unit: row['unit_of_measure'] || 'Each',
        price: formatted_price,
        supplier: row['supplier_name'],
        status: row_status(row, row_number),
        errors: row_errors(row_number),
        warnings: row_warnings(row_number),
        action: determine_action(row)
      }
    end

    private

    def format_currency(value)
      return nil if value.blank?

      cleaned = value.to_s.gsub(/[$,]/, '')
      "$#{format('%.2f', cleaned.to_f)}"
    rescue StandardError
      value
    end

    def determine_action(row)
      item_code = row['item_code']
      if item_code.present? && @existing_item_codes.include?(item_code)
        options[:update_existing] ? 'update' : 'skip'
      else
        'create'
      end
    end
  end
end
