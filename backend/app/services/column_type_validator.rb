# frozen_string_literal: true

# Central validation service for all column types
# This is the SINGLE SOURCE OF TRUTH for column type validation rules
# Used by ApplicationRecord to validate ALL tables automatically
#
# Validation rules match frontend (TeeemTableView.tsx validateCell function)
#
class ColumnTypeValidator
  PHONE_REGEX = /\A[\d\s\-\(\)\+]+\z/
  EMAIL_REGEX = URI::MailTo::EMAIL_REGEXP
  GPS_REGEX = /\A-?\d+\.?\d*,-?\d+\.?\d*\z/
  HEX_COLOR_REGEX = /\A#[0-9A-Fa-f]{6}\z/

  # Cache column types per table to avoid repeated DB queries
  @@column_cache = {}
  @@cache_expires_at = {}
  CACHE_TTL = 5.minutes
  MAX_CACHE_SIZE = 100

  class << self
    # Get column types for a table (with caching)
    def column_types_for(table_name)
      # Check cache
      if @@column_cache[table_name] && @@cache_expires_at[table_name] > Time.current
        return @@column_cache[table_name]
      end

      # Find foundation_id for this table
      foundation = Foundation.find_by(database_table_name: table_name)
      return {} unless foundation

      # Get columns with their types
      columns = Column.where(foundation_id: foundation.id).pluck(:column_name, :column_type).to_h

      # Evict expired entries before adding new ones
      evict_expired_entries if @@column_cache.size >= MAX_CACHE_SIZE

      # Cache it
      @@column_cache[table_name] = columns
      @@cache_expires_at[table_name] = Time.current + CACHE_TTL

      columns
    end

    # Clear cache (call when columns are updated)
    def clear_cache(table_name = nil)
      if table_name
        @@column_cache.delete(table_name)
        @@cache_expires_at.delete(table_name)
      else
        @@column_cache = {}
        @@cache_expires_at = {}
      end
    end

    # Validate a single value based on column type
    # Returns nil if valid, error message if invalid
    def validate(value, column_type)
      return nil if value.blank?

      str_value = value.to_s

      case column_type&.to_s
      when "email"
        unless str_value.match?(EMAIL_REGEX)
          return "must be a valid email address"
        end

      when "phone", "mobile"
        unless str_value.match?(PHONE_REGEX)
          return "contains invalid characters"
        end
        digit_count = str_value.gsub(/\D/, "").length
        if digit_count > 0 && digit_count < 8
          return "must have at least 8 digits"
        end

      when "url"
        begin
          uri = URI.parse(str_value)
          unless uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
            return "must be a valid URL (http or https)"
          end
        rescue URI::InvalidURIError
          return "must be a valid URL"
        end

      when "whole_number"
        unless str_value.match?(/\A-?\d+\z/)
          return "must be a whole number"
        end
        if value.to_i < 0
          return "must be 0 or greater"
        end

      when "number", "currency"
        # Note: Currency and number can be negative (e.g., variances, refunds, credits)
        begin
          Float(str_value)
        rescue ArgumentError
          return "must be a number"
        end

      when "percentage"
        # Percentage can be any value (including negative for losses, over 100 for growth)
        # Just validate it's a valid number
        begin
          Float(str_value)
        rescue ArgumentError
          return "must be a number"
        end

      when "gps_coordinates"
        unless str_value.match?(GPS_REGEX)
          return "must be in format: latitude,longitude"
        end

      when "color_picker"
        unless str_value.match?(HEX_COLOR_REGEX)
          return "must be a valid hex color (e.g., #FF0000)"
        end

      when "abn"
        digits = str_value.gsub(/\s/, "")
        unless digits.match?(/\A\d{11}\z/)
          return "must be 11 digits"
        end

      when "acn"
        digits = str_value.gsub(/\s/, "")
        unless digits.match?(/\A\d{9}\z/)
          return "must be 9 digits"
        end

      when "bsb"
        digits = str_value.gsub(/[\s\-]/, "")
        unless digits.match?(/\A\d{6}\z/)
          return "must be 6 digits"
        end

      when "bank_account"
        digits = str_value.gsub(/[\s\-]/, "")
        unless digits.match?(/\A\d{6,10}\z/)
          return "must be 6-10 digits"
        end

      when "postcode"
        unless str_value.match?(/\A\d{4}\z/)
          return "must be 4 digits"
        end

      when "tfn"
        digits = str_value.gsub(/\s/, "")
        unless digits.match?(/\A\d{8,9}\z/)
          return "must be 8-9 digits"
        end
      end

      nil # Valid
    end

    # Format a value based on column type (for before_save)
    # Returns formatted value or original if no formatting needed
    def format_value(value, column_type)
      return value if value.blank?

      case column_type&.to_s
      when "phone", "mobile"
        format_australian_phone(value)
      when "bsb"
        format_bsb(value)
      when "abn"
        format_abn(value)
      when "acn"
        format_acn(value)
      else
        value
      end
    end

    # Format Australian phone numbers: 0XXX XXX XXX or XX XXXX XXXX
    def format_australian_phone(number)
      return number if number.blank?

      digits = number.to_s.gsub(/\D/, "")

      # Australian mobile (10 digits starting with 04)
      if digits.length == 10 && digits.start_with?("04")
        return "#{digits[0..3]} #{digits[4..6]} #{digits[7..9]}"
      end

      # Australian landline (10 digits starting with 0)
      if digits.length == 10 && digits.start_with?("0")
        return "#{digits[0..1]} #{digits[2..5]} #{digits[6..9]}"
      end

      # 8 digit local numbers
      if digits.length == 8
        return "#{digits[0..3]} #{digits[4..7]}"
      end

      number
    end

    # Format BSB: XXX-XXX
    def format_bsb(value)
      return value if value.blank?
      digits = value.to_s.gsub(/\D/, "")
      return value unless digits.length == 6
      "#{digits[0..2]}-#{digits[3..5]}"
    end

    # Format ABN: XX XXX XXX XXX
    def format_abn(value)
      return value if value.blank?
      digits = value.to_s.gsub(/\D/, "")
      return value unless digits.length == 11
      "#{digits[0..1]} #{digits[2..4]} #{digits[5..7]} #{digits[8..10]}"
    end

    # Format ACN: XXX XXX XXX
    def format_acn(value)
      return value if value.blank?
      digits = value.to_s.gsub(/\D/, "")
      return value unless digits.length == 9
      "#{digits[0..2]} #{digits[3..5]} #{digits[6..8]}"
    end

    # Validate all attributes on a record based on column types
    def validate_record(record)
      table_name = record.class.table_name
      column_types = column_types_for(table_name)

      return if column_types.empty?

      column_types.each do |column_name, column_type|
        next unless record.respond_to?(column_name)

        value = record.send(column_name)
        error = validate(value, column_type)

        if error
          record.errors.add(column_name.to_sym, error)
        end
      end
    end

    # Format all attributes on a record based on column types
    def format_record(record)
      table_name = record.class.table_name
      column_types = column_types_for(table_name)

      return if column_types.empty?

      column_types.each do |column_name, column_type|
        next unless record.respond_to?(column_name)
        next unless record.respond_to?("#{column_name}=")

        value = record.send(column_name)
        formatted = format_value(value, column_type)

        if formatted != value
          record.send("#{column_name}=", formatted)
        end
      end
    end

    private

    def evict_expired_entries
      now = Time.current
      expired_keys = @@cache_expires_at.select { |_, expires| expires <= now }.keys
      expired_keys.each do |key|
        @@column_cache.delete(key)
        @@cache_expires_at.delete(key)
      end
    end
  end
end
