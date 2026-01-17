# frozen_string_literal: true

module Importers
  # Base class for all data importers
  #
  # Usage:
  #   class ContactsImporter < BaseImporter
  #     COLUMN_MAP = {
  #       'first_name' => :first_name,
  #       'last_name' => :last_name,
  #       # ...
  #     }
  #
  #     def import!
  #       # Implementation
  #     end
  #   end
  #
  class BaseImporter
    attr_reader :tenant, :file, :errors, :count, :skipped

    def initialize(tenant, file)
      @tenant = tenant
      @file = file
      @errors = []
      @count = 0
      @skipped = 0
    end

    def import!
      raise NotImplementedError, "Subclasses must implement import!"
    end

    def result
      {
        success: @errors.empty?,
        count: @count,
        skipped: @skipped,
        errors: @errors
      }
    end

    protected

    def spreadsheet
      @spreadsheet ||= open_spreadsheet
    end

    def open_spreadsheet
      case File.extname(file_path).downcase
      when ".csv"
        require "csv"
        CSV.read(file_path, headers: true)
      when ".xlsx", ".xls"
        require "roo"
        xlsx = Roo::Spreadsheet.open(file_path)
        xlsx.parse(headers: true).drop(1) # Skip header row, return array of hashes
      else
        raise ArgumentError, "Unknown file type: #{File.extname(file_path)}"
      end
    end

    def file_path
      case @file
      when String
        @file
      when ActionDispatch::Http::UploadedFile
        @file.tempfile.path
      else
        raise ArgumentError, "Unknown file type: #{@file.class}"
      end
    end

    def add_error(row_number, message)
      @errors << "Row #{row_number}: #{message}"
    end

    def normalize_value(value)
      return nil if value.blank?
      value.to_s.strip
    end

    def parse_date(value)
      return nil if value.blank?
      Date.parse(value.to_s)
    rescue Date::Error
      nil
    end

    def parse_decimal(value)
      return nil if value.blank?
      BigDecimal(value.to_s.gsub(/[^\d.-]/, ""))
    rescue ArgumentError
      nil
    end

    def parse_boolean(value)
      return nil if value.blank?
      %w[true yes 1 y].include?(value.to_s.downcase)
    end

    def find_lookup(model, value, column = :name)
      return nil if value.blank?
      model.find_by(column => value.to_s.strip)
    end
  end
end
