# frozen_string_literal: true

module ImportValidators
  # BaseValidator - Base class for import data validation
  #
  # Provides common validation methods and error tracking for import validators.
  # Each specific validator (ContactValidator, JobValidator, etc.) extends this.
  #
  # Usage:
  #   validator = ImportValidators::ContactValidator.new(rows)
  #   result = validator.validate
  #   # => { valid: true/false, errors: [...], warnings: [...], preview: [...] }
  #
  class BaseValidator
    attr_reader :rows, :errors, :warnings, :options

    # Override in subclasses
    REQUIRED_COLUMNS = [].freeze
    OPTIONAL_COLUMNS = [].freeze

    def initialize(rows, options = {})
      @rows = rows
      @options = options.with_indifferent_access
      @errors = []
      @warnings = []
    end

    # Validate all rows
    def validate
      validate_headers
      return validation_result if @errors.any?

      @rows.each_with_index do |row, index|
        row_number = index + 2  # Account for header row and 0-based index
        validate_row(row, row_number)
      end

      validation_result
    end

    # Preview what would be imported (first N rows)
    def preview(limit = 20)
      validate

      {
        valid: @errors.empty?,
        errors: @errors.first(50),
        warnings: @warnings.first(50),
        preview: @rows.first(limit).map.with_index do |row, index|
          preview_row(row, index + 2)
        end,
        total_rows: @rows.size
      }
    end

    protected

    # Override in subclasses
    def validate_row(row, row_number)
      raise NotImplementedError
    end

    # Override in subclasses
    def preview_row(row, row_number)
      {
        row: row_number,
        data: row,
        status: row_status(row, row_number),
        errors: row_errors(row_number),
        warnings: row_warnings(row_number)
      }
    end

    # Check if required columns are present
    def validate_headers
      return if @rows.empty?

      first_row = @rows.first
      return unless first_row.is_a?(Hash)

      columns = first_row.keys.map(&:to_s).map(&:downcase)

      missing = self.class::REQUIRED_COLUMNS.reject do |col|
        columns.include?(col.to_s.downcase)
      end

      if missing.any?
        add_error(1, "Missing required columns: #{missing.join(', ')}")
      end
    end

    # Add an error
    def add_error(row, message, column: nil, value: nil)
      @errors << {
        row: row,
        column: column,
        value: value,
        message: message
      }.compact
    end

    # Add a warning
    def add_warning(row, message, column: nil, value: nil)
      @warnings << {
        row: row,
        column: column,
        value: value,
        message: message
      }.compact
    end

    # Get errors for a specific row
    def row_errors(row_number)
      @errors.select { |e| e[:row] == row_number }
    end

    # Get warnings for a specific row
    def row_warnings(row_number)
      @warnings.select { |w| w[:row] == row_number }
    end

    # Determine row status
    def row_status(row, row_number)
      if row_errors(row_number).any?
        'error'
      elsif row_warnings(row_number).any?
        'warning'
      else
        'valid'
      end
    end

    # Build validation result
    def validation_result
      {
        valid: @errors.empty?,
        total_rows: @rows.size,
        valid_rows: @rows.size - rows_with_errors.size,
        error_rows: rows_with_errors.size,
        errors: @errors,
        warnings: @warnings
      }
    end

    # Count rows with errors
    def rows_with_errors
      @errors.map { |e| e[:row] }.uniq
    end

    # =============================================================================
    # Common Validation Helpers
    # =============================================================================

    def validate_required(row, row_number, column, value)
      if value.blank?
        add_error(row_number, "#{column} is required", column: column)
        false
      else
        true
      end
    end

    def validate_email(row, row_number, column, value)
      return true if value.blank?

      unless value.match?(/\A[^@\s]+@[^@\s]+\.[^@\s]+\z/)
        add_error(row_number, "Invalid email format", column: column, value: value)
        return false
      end
      true
    end

    def validate_phone(row, row_number, column, value)
      return true if value.blank?

      # Australian phone number validation
      normalized = value.to_s.gsub(/\D/, '')
      unless normalized.length.between?(8, 12)
        add_warning(row_number, "Phone number may be invalid", column: column, value: value)
      end
      true
    end

    def validate_date(row, row_number, column, value)
      return true if value.blank?

      begin
        Date.parse(value.to_s)
        true
      rescue ArgumentError
        add_error(row_number, "Invalid date format (use YYYY-MM-DD)", column: column, value: value)
        false
      end
    end

    def validate_currency(row, row_number, column, value)
      return true if value.blank?

      # Remove currency symbols and commas
      cleaned = value.to_s.gsub(/[$,]/, '')
      unless cleaned.match?(/\A-?\d+(\.\d{1,2})?\z/)
        add_error(row_number, "Invalid currency format", column: column, value: value)
        return false
      end
      true
    end

    def validate_postcode(row, row_number, column, value)
      return true if value.blank?

      unless value.to_s.match?(/\A\d{4}\z/)
        add_error(row_number, "Postcode must be 4 digits", column: column, value: value)
        return false
      end
      true
    end

    def validate_state(row, row_number, column, value)
      return true if value.blank?

      valid_states = %w[QLD NSW VIC SA WA TAS NT ACT]
      normalized = value.to_s.upcase.strip
      unless valid_states.include?(normalized)
        add_error(row_number, "Invalid state (use #{valid_states.join(', ')})", column: column, value: value)
        return false
      end
      true
    end

    def validate_abn(row, row_number, column, value)
      return true if value.blank?

      cleaned = value.to_s.gsub(/\D/, '')
      unless cleaned.length == 11
        add_warning(row_number, "ABN should be 11 digits", column: column, value: value)
      end
      true
    end

    def validate_lookup(row, row_number, column, value, lookup_values, auto_create: false)
      return true if value.blank?

      unless lookup_values.include?(value.to_s.strip)
        if auto_create
          add_warning(row_number, "Will create new: #{value}", column: column, value: value)
        else
          add_error(row_number, "Unknown value: #{value}", column: column, value: value)
          return false
        end
      end
      true
    end
  end
end
