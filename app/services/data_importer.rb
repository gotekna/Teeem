class DataImporter
  attr_reader :table, :file_path, :column_mapping, :errors, :imported_count, :failed_rows

  def initialize(table, file_path, column_mapping = {})
    @table = table
    @file_path = file_path
    @column_mapping = column_mapping  # Maps spreadsheet headers to column names
    @errors = []
    @imported_count = 0
    @failed_rows = []
  end

  # Import all rows from the spreadsheet into the table
  # Accepts optional block for progress callback: yield(current_row, total_rows)
  def import(&progress_callback)
    parser = SpreadsheetParser.new(@file_path)
    parsed_data = parser.parse

    unless parsed_data[:success]
      @errors = parsed_data[:errors]
      return { success: false, errors: @errors }
    end

    rows = parser.all_rows
    total_rows = rows.length
    model = @table.dynamic_model

    # Process rows in batches for better performance
    batch_size = 500
    rows.each_slice(batch_size).with_index do |batch, batch_index|
      batch_records = []

      batch.each_with_index do |row_data, index_in_batch|
        row_index = batch_index * batch_size + index_in_batch

        begin
          # Map spreadsheet data to database columns
          attributes = map_row_to_attributes(row_data)
          batch_records << attributes
        rescue => e
          @failed_rows << {
            row_number: row_index + 2,  # +2 because: +1 for 0-index, +1 for header row
            data: row_data,
            error: e.message
          }
        end
      end

      # Bulk insert the batch
      if batch_records.any?
        begin
          model.insert_all(batch_records, returning: false)
          @imported_count += batch_records.length

          # Call progress callback if provided
          if progress_callback
            current_progress = [ (batch_index + 1) * batch_size, total_rows ].min
            progress_callback.call(current_progress, total_rows)
          end
        rescue => e
          # If bulk insert fails, fall back to individual inserts for this batch
          batch_records.each_with_index do |attributes, index|
            row_index = batch_index * batch_size + index
            begin
              model.create!(attributes)
              @imported_count += 1
            rescue => individual_error
              @failed_rows << {
                row_number: row_index + 2,
                data: rows[row_index],
                error: individual_error.message
              }
            end
          end
        end
      end
    end

    {
      success: true,
      imported_count: @imported_count,
      failed_count: @failed_rows.length,
      failed_rows: @failed_rows.first(10),  # Return first 10 failures
      total_failures: @failed_rows.length
    }
  end

  private

  def map_row_to_attributes(row_data)
    attributes = {}

    @table.columns.each do |column|
      # Find the spreadsheet header that maps to this column
      spreadsheet_header = @column_mapping.key(column.column_name) || column.name

      raw_value = row_data[spreadsheet_header]

      # Convert value based on column type
      attributes[column.column_name] = convert_value(raw_value, column)
    end

    attributes
  end

  def convert_value(value, column)
    return nil if value.nil? || value.to_s.strip.blank?

    case column.column_type
    when "boolean"
      convert_to_boolean(value)
    when "whole_number"
      value.to_i
    when "number", "currency", "percentage"
      convert_to_decimal(value)
    when "date"
      convert_to_date(value)
    when "date_and_time"
      convert_to_datetime(value)
    when "email", "single_line_text", "multiple_lines_text"
      value.to_s.strip
    else
      value.to_s.strip
    end
  rescue => e
    raise "Failed to convert value '#{value}' for column '#{column.name}': #{e.message}"
  end

  def convert_to_boolean(value)
    true_values = [ "true", "yes", "1", "t", "y" ]
    true_values.include?(value.to_s.downcase.strip)
  end

  def convert_to_decimal(value)
    # Remove currency symbols and percentage signs
    cleaned = value.to_s.gsub(/[$,%]/, "").strip
    BigDecimal(cleaned)
  end

  def convert_to_date(value)
    return value if value.is_a?(Date)
    Date.parse(value.to_s)
  end

  def convert_to_datetime(value)
    return value if value.is_a?(DateTime) || value.is_a?(Time)
    DateTime.parse(value.to_s)
  end
end
