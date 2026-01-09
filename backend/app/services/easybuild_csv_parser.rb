require "csv"

class EasybuildCsvParser
  class ParseError < StandardError; end

  REQUIRED_COLUMNS = %w[
    purchase_order_number
    supplier
    total
    construction
  ].freeze

  attr_reader :errors, :warnings

  def initialize(csv_file_path_or_content)
    @csv_content = if csv_file_path_or_content.is_a?(String) && File.exist?(csv_file_path_or_content)
                     File.read(csv_file_path_or_content)
    else
                     csv_file_path_or_content
    end
    @errors = []
    @warnings = []
  end

  def parse
    rows = CSV.parse(@csv_content, headers: true)

    validate_headers!(rows.headers)

    job_name = extract_job_name(rows)
    purchase_orders = extract_purchase_orders(rows)

    {
      success: true,
      job_name: job_name,
      purchase_orders: purchase_orders,
      summary: {
        total_pos: purchase_orders.length,
        total_amount: purchase_orders.sum { |po| po[:total] || 0 },
        suppliers_count: purchase_orders.map { |po| po[:supplier] }.compact.uniq.length
      }
    }
  rescue CSV::MalformedCSVError => e
    {
      success: false,
      error: "Invalid CSV format: #{e.message}"
    }
  rescue ParseError => e
    {
      success: false,
      error: e.message,
      errors: @errors
    }
  rescue => e
    {
      success: false,
      error: "Unexpected error: #{e.message}"
    }
  end

  private

  def validate_headers!(headers)
    return if headers.nil?

    missing_columns = REQUIRED_COLUMNS - headers

    if missing_columns.any?
      raise ParseError, "Missing required columns: #{missing_columns.join(', ')}"
    end
  end

  def extract_job_name(rows)
    # Get job name from first row with non-empty construction field
    job_name = rows.find { |row| row["construction"].present? }&.[]("construction")

    if job_name.blank?
      raise ParseError, "Could not extract job name from CSV. 'construction' column is empty."
    end

    # Clean up job name
    job_name.strip
  end

  def extract_purchase_orders(rows)
    pos = []

    rows.each_with_index do |row, index|
      # Skip rows without PO number
      next if row["purchase_order_number"].blank?

      # Skip rows with empty total
      next if row["total"].blank? || row["total"].to_f.zero?

      po_data = {
        po_number: row["purchase_order_number"]&.strip,
        supplier_name: row["supplier"]&.strip,
        total: parse_money(row["total"]),
        subtotal: parse_money(row["sub_total"]),
        tax: parse_money(row["tax"]),
        description: row["ted_task"]&.strip,
        notes: row["sams_notes"]&.strip,
        status: parse_status(row["xero_complete"]),
        row_number: index + 2 # +2 because: 1-indexed + 1 for header row
      }

      # Validate PO data
      if po_data[:po_number].blank?
        @warnings << "Row #{po_data[:row_number]}: Missing PO number, skipping"
        next
      end

      if po_data[:supplier_name].blank?
        @warnings << "Row #{po_data[:row_number]}: PO #{po_data[:po_number]} has no supplier"
      end

      pos << po_data
    end

    if pos.empty?
      raise ParseError, "No valid purchase orders found in CSV"
    end

    pos
  end

  def parse_money(value)
    return nil if value.blank?
    value.to_s.gsub(/[^\d.-]/, "").to_f.round(2)
  end

  def parse_status(xero_complete)
    case xero_complete&.downcase
    when "true", "1", "yes"
      "Paid"
    when "false", "0", "no"
      "Pending"
    else
      "Pending"
    end
  end
end
