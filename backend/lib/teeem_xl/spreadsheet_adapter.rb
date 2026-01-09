# frozen_string_literal: true

# TeeemXl SpreadsheetAdapter
#
# Provides a Roo-compatible API for reading spreadsheets using TeeemXl (XLSX)
# and Ruby's built-in CSV library (CSV). Enables drop-in replacement of Roo.
#
# Usage:
#   spreadsheet = TeeemXl::SpreadsheetAdapter.open("file.xlsx")
#   spreadsheet.sheets           # => ["Sheet1", "Sheet2"]
#   spreadsheet.sheet("Sheet1")  # => sheet object
#   spreadsheet.row(1)           # => first row values
#   spreadsheet.cell(1, 1)       # => cell A1 value
#   spreadsheet.last_row         # => row count
#   spreadsheet.last_column      # => column count
#
module TeeemXl
  class SpreadsheetAdapter
    attr_reader :sheets, :current_sheet

    def self.open(source, extension: nil)
      ext = extension&.to_s || File.extname(source.to_s).delete_prefix(".").downcase

      case ext
      when "xlsx"
        XlsxAdapter.new(source)
      when "csv"
        CsvAdapter.new(source)
      when "xls"
        # For legacy XLS files, fall back to Roo if available
        if defined?(Roo::Excel)
          RooAdapter.new(Roo::Excel.new(source))
        else
          raise UnsupportedFormatError, "XLS format requires the 'roo' gem. Consider converting to XLSX."
        end
      else
        raise UnsupportedFormatError, "Unsupported format: #{ext}. Supported: xlsx, csv"
      end
    end

    class UnsupportedFormatError < StandardError; end

    # XLSX Adapter using TeeemXl
    class XlsxAdapter
      attr_reader :workbook, :current_sheet_name

      def initialize(source)
        @workbook = TeeemXl.read(source)
        @current_sheet_name = @workbook.sheet_names.first
        @sheets_cache = {}
      end

      def sheets
        @workbook.sheet_names
      end

      def sheet(name)
        @current_sheet_name = name
        self
      end

      def default_sheet=(name)
        @current_sheet_name = name
      end

      def default_sheet
        @current_sheet_name
      end

      def row(row_num)
        current_worksheet.row(row_num).map(&:value)
      end

      def cell(row_num, col_num = nil)
        if col_num.nil?
          # row_num is actually a cell reference like "A1"
          current_worksheet.cell(row_num)&.value
        else
          # Convert row/col numbers to cell reference (e.g., 1, 1 -> "A1")
          col_letter = index_to_column(col_num - 1) # Convert 1-based to 0-based
          reference = "#{col_letter}#{row_num}"
          current_worksheet.cell(reference)&.value
        end
      end

      def last_row
        current_worksheet.max_row
      end

      def last_column
        current_worksheet.max_column + 1 # Convert 0-based to 1-based
      end

      def to_a
        rows = []
        (1..last_row).each do |row_num|
          rows << row(row_num)
        end
        rows
      end

      # Iteration support
      def each_row_streaming(options = {})
        offset = options[:offset] || 0
        (1 + offset..last_row).each do |row_num|
          yield row(row_num)
        end
      end

      private

      def current_worksheet
        @workbook.sheets.find { |s| s.name == @current_sheet_name } || @workbook.first_sheet
      end

      # Convert 0-based column index to Excel column letter (0 -> A, 25 -> Z, 26 -> AA)
      def index_to_column(index)
        result = ""
        n = index + 1
        while n > 0
          n -= 1
          result = ((n % 26) + 65).chr + result
          n /= 26
        end
        result
      end
    end

    # CSV Adapter using Ruby's built-in CSV
    class CsvAdapter
      def initialize(source)
        @data = if source.is_a?(String) && File.exist?(source)
          CSV.read(source, encoding: "bom|utf-8")
        elsif source.respond_to?(:read)
          CSV.parse(source.read, encoding: "bom|utf-8")
        else
          CSV.parse(source.to_s, encoding: "bom|utf-8")
        end
      end

      def sheets
        ["Sheet1"] # CSV only has one "sheet"
      end

      def sheet(_name)
        self # No-op for CSV
      end

      def default_sheet=(_name)
        # No-op for CSV
      end

      def default_sheet
        "Sheet1"
      end

      def row(row_num)
        @data[row_num - 1] || [] # Convert 1-based to 0-based
      end

      def cell(row_num, col_num = nil)
        if col_num.nil?
          # Parse cell reference like "A1"
          match = row_num.to_s.match(/^([A-Z]+)(\d+)$/i)
          return nil unless match
          col_idx = column_letter_to_index(match[1])
          row_idx = match[2].to_i - 1
          @data[row_idx]&.[](col_idx)
        else
          @data[row_num - 1]&.[](col_num - 1) # Convert 1-based to 0-based
        end
      end

      def last_row
        @data.length
      end

      def last_column
        @data.map(&:length).max || 0
      end

      def to_a
        @data
      end

      def each_row_streaming(options = {})
        offset = options[:offset] || 0
        @data.drop(offset).each { |row| yield row }
      end

      private

      def column_letter_to_index(letter)
        result = 0
        letter.upcase.each_char do |char|
          result = result * 26 + (char.ord - 64)
        end
        result - 1
      end
    end

    # Fallback adapter for Roo (legacy XLS support)
    class RooAdapter
      def initialize(roo_spreadsheet)
        @roo = roo_spreadsheet
      end

      def sheets
        @roo.sheets
      end

      def sheet(name)
        @roo.default_sheet = name
        self
      end

      def default_sheet=(name)
        @roo.default_sheet = name
      end

      def default_sheet
        @roo.default_sheet
      end

      def row(row_num)
        @roo.row(row_num)
      end

      def cell(row_num, col_num = nil)
        if col_num.nil?
          @roo.cell(row_num)
        else
          @roo.cell(row_num, col_num)
        end
      end

      def last_row
        @roo.last_row
      end

      def last_column
        @roo.last_column
      end

      def to_a
        @roo.to_a
      end

      def each_row_streaming(options = {}, &block)
        @roo.each_row_streaming(options, &block)
      end
    end
  end
end
