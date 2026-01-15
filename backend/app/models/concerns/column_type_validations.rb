# frozen_string_literal: true

# Shared validation rules for column types
# Include this concern in any model that uses TEEEM column types
#
# SSoT: ColumnTypeValidator is THE source of truth for validation regex constants.
# This concern references ColumnTypeValidator constants to avoid duplication.
#
# Usage:
#   class MyModel < ApplicationRecord
#     include ColumnTypeValidations
#
#     # Define which columns have which types
#     column_type_validations(
#       email: :email,
#       phone: :phone,
#       mobile: :mobile,
#       url: :url,
#       # ... etc
#     )
#   end
#
module ColumnTypeValidations
  extend ActiveSupport::Concern

  # SSoT: These constants reference ColumnTypeValidator (the true source of truth)
  PHONE_REGEX = ColumnTypeValidator::PHONE_REGEX
  EMAIL_REGEX = ColumnTypeValidator::EMAIL_REGEX
  GPS_REGEX = ColumnTypeValidator::GPS_REGEX
  HEX_COLOR_REGEX = ColumnTypeValidator::HEX_COLOR_REGEX

  class_methods do
    def column_type_validations(mappings = {})
      mappings.each do |column_name, column_type|
        case column_type.to_sym
        when :email
          validates column_name,
            format: { with: EMAIL_REGEX, message: "must be a valid email address" },
            allow_blank: true,
            length: { maximum: 255 }

        when :phone, :mobile
          validate :"validate_#{column_name}_phone_format"

          define_method(:"validate_#{column_name}_phone_format") do
            value = send(column_name)
            return if value.blank?

            unless value.match?(PHONE_REGEX)
              errors.add(column_name, "contains invalid characters")
              return
            end

            digit_count = value.gsub(/\D/, "").length
            if digit_count < 8
              errors.add(column_name, "must have at least 8 digits")
            end
          end

        when :url
          validates column_name,
            format: { with: URI::DEFAULT_PARSER.make_regexp([ "http", "https" ]), message: "must be a valid URL" },
            allow_blank: true,
            length: { maximum: 500 }

        when :whole_number
          validates column_name,
            numericality: { only_integer: true, greater_than_or_equal_to: 0 },
            allow_nil: true

        when :number
          validates column_name,
            numericality: { greater_than_or_equal_to: 0 },
            allow_nil: true

        when :currency
          validates column_name,
            numericality: { greater_than_or_equal_to: 0 },
            allow_nil: true

        when :percentage
          validates column_name,
            numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 },
            allow_nil: true

        when :gps_coordinates
          validates column_name,
            format: { with: GPS_REGEX, message: "must be in format: latitude,longitude" },
            allow_blank: true,
            length: { maximum: 100 }

        when :color_picker
          validates column_name,
            format: { with: HEX_COLOR_REGEX, message: "must be a valid hex color (e.g., #FF0000)" },
            allow_blank: true

        when :abn
          validate :"validate_#{column_name}_abn_format"

          define_method(:"validate_#{column_name}_abn_format") do
            value = send(column_name)
            return if value.blank?
            digits = value.to_s.gsub(/\s/, "")
            unless digits.match?(/\A\d{11}\z/)
              errors.add(column_name, "must be 11 digits")
            end
          end

        when :acn
          validate :"validate_#{column_name}_acn_format"

          define_method(:"validate_#{column_name}_acn_format") do
            value = send(column_name)
            return if value.blank?
            digits = value.to_s.gsub(/\s/, "")
            unless digits.match?(/\A\d{9}\z/)
              errors.add(column_name, "must be 9 digits")
            end
          end

        when :bsb
          validate :"validate_#{column_name}_bsb_format"

          define_method(:"validate_#{column_name}_bsb_format") do
            value = send(column_name)
            return if value.blank?
            digits = value.to_s.gsub(/[\s\-]/, "")
            unless digits.match?(/\A\d{6}\z/)
              errors.add(column_name, "must be 6 digits")
            end
          end

        when :bank_account
          validate :"validate_#{column_name}_bank_account_format"

          define_method(:"validate_#{column_name}_bank_account_format") do
            value = send(column_name)
            return if value.blank?
            digits = value.to_s.gsub(/[\s\-]/, "")
            unless digits.match?(/\A\d{6,10}\z/)
              errors.add(column_name, "must be 6-10 digits")
            end
          end

        when :postcode
          validate :"validate_#{column_name}_postcode_format"

          define_method(:"validate_#{column_name}_postcode_format") do
            value = send(column_name)
            return if value.blank?
            unless value.to_s.match?(/\A\d{4}\z/)
              errors.add(column_name, "must be 4 digits")
            end
          end

        when :tfn
          validate :"validate_#{column_name}_tfn_format"

          define_method(:"validate_#{column_name}_tfn_format") do
            value = send(column_name)
            return if value.blank?
            digits = value.to_s.gsub(/\s/, "")
            unless digits.match?(/\A\d{8,9}\z/)
              errors.add(column_name, "must be 8-9 digits")
            end
          end
        end
      end
    end
  end

  # Phone number formatting helper - can be called in before_save
  def format_australian_phone(number)
    return number if number.blank?

    digits = number.gsub(/\D/, "")

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
end
