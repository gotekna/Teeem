require "roo"

class SpreadsheetParser
  PREVIEW_ROW_COUNT = 10
  MAX_FILE_SIZE = 50.megabytes

  attr_reader :file_path, :spreadsheet, :errors

  def initialize(file_path)
    @file_path = file_path
    @errors = []
  end

  # Parse the spreadsheet and return structured data
  def parse
    return { success: false, errors: @errors } unless validate_file

    begin
      @spreadsheet = Roo::Spreadsheet.open(@file_path)

      {
        success: true,
        headers: headers,
        preview_data: preview_data,
        total_rows: total_rows,
        detected_types: detect_column_types,
        suggested_table_name: suggested_table_name
      }
    rescue => e
      @errors << "Failed to parse spreadsheet: #{e.message}"
      { success: false, errors: @errors }
    end
  end

  # Get all rows (for actual import)
  def all_rows
    return [] unless @spreadsheet

    rows = []
    (2..@spreadsheet.last_row).each do |row_number|
      row_data = {}
      headers.each_with_index do |header, index|
        row_data[header] = @spreadsheet.cell(row_number, index + 1)
      end
      rows << row_data
    end
    rows
  end

  private

  def validate_file
    unless File.exist?(@file_path)
      @errors << "File does not exist"
      return false
    end

    if File.size(@file_path) > MAX_FILE_SIZE
      @errors << "File size exceeds maximum of #{MAX_FILE_SIZE / 1.megabyte}MB"
      return false
    end

    extension = File.extname(@file_path).downcase
    unless [ ".csv", ".xlsx", ".xls" ].include?(extension)
      @errors << "Invalid file format. Please upload CSV or Excel files only."
      return false
    end

    true
  end

  def headers
    return [] unless @spreadsheet

    @headers ||= begin
      header_row = []
      (1..@spreadsheet.last_column).each do |col|
        header_row << @spreadsheet.cell(1, col).to_s.strip
      end
      header_row
    end
  end

  def preview_data
    return [] unless @spreadsheet

    preview_rows = []
    end_row = [ 2 + PREVIEW_ROW_COUNT - 1, @spreadsheet.last_row ].min

    (2..end_row).each do |row_number|
      row_data = {}
      headers.each_with_index do |header, index|
        row_data[header] = @spreadsheet.cell(row_number, index + 1)
      end
      preview_rows << row_data
    end

    preview_rows
  end

  def total_rows
    return 0 unless @spreadsheet
    # Subtract 1 for header row
    [ @spreadsheet.last_row - 1, 0 ].max
  end

  def detect_column_types
    return {} unless @spreadsheet

    column_types = {}

    headers.each_with_index do |header, index|
      # Collect values for this column (skip header row)
      column_values = []
      (2..@spreadsheet.last_row).each do |row_number|
        column_values << @spreadsheet.cell(row_number, index + 1)
      end

      # Detect type
      detector = TypeDetector.new(column_values)
      column_types[header] = detector.detect
    end

    column_types
  end

  def suggested_table_name
    # Try to derive a table name from the filename
    filename = File.basename(@file_path, ".*")
    filename.titleize
  end
end
