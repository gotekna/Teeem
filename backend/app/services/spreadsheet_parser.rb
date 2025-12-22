# frozen_string_literal: true

# SpreadsheetParser - Generic parser for Excel/CSV files using Roo
#
# Usage:
#   parser = SpreadsheetParser.new(file_path)
#   result = parser.parse
#   if result[:success]
#     rows = parser.all_rows
#     rows.each { |row| puts row["Name"] }
#   end
#
class SpreadsheetParser
  SUPPORTED_EXTENSIONS = %w[.xlsx .xls .csv].freeze

  attr_reader :file_path, :spreadsheet, :headers

  def initialize(file_path)
    @file_path = file_path
    @spreadsheet = nil
    @headers = []
    @rows = []
    @errors = []
  end

  def parse
    validate_file!
    return failure if @errors.any?

    open_spreadsheet!
    return failure if @errors.any?

    extract_headers!
    return failure if @errors.any?

    extract_rows!

    if @errors.any?
      failure
    else
      {
        success: true,
        total_rows: @rows.count,
        headers: @headers,
        errors: []
      }
    end
  rescue StandardError => e
    Rails.logger.error "SpreadsheetParser error: #{e.message}"
    @errors << "Failed to parse file: #{e.message}"
    failure
  end

  def all_rows
    @rows
  end

  def row(index)
    @rows[index]
  end

  def row_count
    @rows.count
  end

  private

  def validate_file!
    unless File.exist?(file_path)
      @errors << "File not found: #{file_path}"
      return
    end

    ext = File.extname(file_path).downcase
    unless SUPPORTED_EXTENSIONS.include?(ext)
      @errors << "Unsupported file format: #{ext}. Supported: #{SUPPORTED_EXTENSIONS.join(', ')}"
    end
  end

  def open_spreadsheet!
    ext = File.extname(file_path).downcase

    @spreadsheet = case ext
    when ".csv"
      Roo::CSV.new(file_path)
    when ".xls"
      Roo::Excel.new(file_path)
    when ".xlsx"
      Roo::Excelx.new(file_path)
    end

    if @spreadsheet.nil? || @spreadsheet.last_row.nil? || @spreadsheet.last_row < 1
      @errors << "File appears to be empty or invalid"
    end
  rescue StandardError => e
    @errors << "Failed to open spreadsheet: #{e.message}"
  end

  def extract_headers!
    return if @spreadsheet.nil?

    first_row = @spreadsheet.row(1)

    if first_row.nil? || first_row.compact.empty?
      @errors << "No headers found in first row"
      return
    end

    @headers = first_row.map { |h| h.to_s.strip }
  end

  def extract_rows!
    return if @spreadsheet.nil? || @headers.empty?

    (2..@spreadsheet.last_row).each do |row_num|
      row_data = @spreadsheet.row(row_num)
      next if row_data.nil? || row_data.compact.empty?

      row_hash = {}
      @headers.each_with_index do |header, idx|
        next if header.blank?
        row_hash[header] = row_data[idx]
      end

      @rows << row_hash if row_hash.values.any?(&:present?)
    end
  end

  def failure
    {
      success: false,
      total_rows: 0,
      headers: [],
      errors: @errors
    }
  end
end
