# frozen_string_literal: true

require "rexml/document"

module Importers
  # DatabuildParser - Detects and parses Databuild construction estimating CSV and XML exports
  #
  # Databuild (databuild.com.au) has NO public API and only supports file-based exports:
  # CSV, XML, and ASCII formats. This parser handles CSV and XML.
  #
  # Usage:
  #   # Detection
  #   if DatabuildParser.detect?(headers)
  #     result = DatabuildParser.parse_csv(rows)
  #   end
  #
  #   # XML detection and parsing
  #   if DatabuildParser.detect_xml?(xml_content)
  #     result = DatabuildParser.parse_xml(file_path)
  #   end
  #
  class DatabuildParser
    # Characteristic Databuild CSV headers (case-insensitive matching)
    DATABUILD_HEADERS = [
      "item code",
      "code",
      "description",
      "unit",
      "uom",
      "rate",
      "unit rate",
      "sell rate",
      "selling price",
      "trade",
      "category",
      "supplier",
      "labour rate",
      "labour hours"
    ].freeze

    # Minimum number of matching headers required for confident detection
    MIN_MATCHING_HEADERS = 3

    # Databuild XML root element patterns
    XML_ROOT_ELEMENTS = %w[Items Estimate DatabuildExport].freeze

    class << self
      # Detects if the given headers match Databuild CSV format
      #
      # @param headers [Array<String>] Array of header strings from CSV
      # @return [Boolean] true if this looks like a Databuild file
      def detect?(headers)
        return false if headers.blank?

        normalized_headers = headers.map { |h| h.to_s.strip.downcase }

        matching_count = DATABUILD_HEADERS.count do |db_header|
          normalized_headers.any? { |h| h == db_header || h.include?(db_header) }
        end

        matching_count >= MIN_MATCHING_HEADERS
      end

      # Detects if the given XML content is from Databuild
      #
      # @param content [String] Raw XML string content
      # @return [Boolean] true if this has Databuild XML structure
      def detect_xml?(content)
        return false if content.blank?

        doc = REXML::Document.new(content)
        root = doc.root

        return false if root.nil?

        # Check if root element name matches known Databuild patterns
        XML_ROOT_ELEMENTS.any? { |pattern| root.name.downcase.include?(pattern.downcase) }
      rescue REXML::ParseException, StandardError
        false
      end

      # Parses Databuild CSV rows into normalized format
      #
      # @param rows [Array<Hash>] Array of row hashes from SpreadsheetParser
      # @return [Hash] Parsed result with normalized rows and suggested mapping
      def parse_csv(rows)
        return error_result("No rows provided") if rows.blank?

        detected_headers = rows.first&.keys || []
        return error_result("No headers found") if detected_headers.empty?

        normalized_rows = rows.map { |row| normalize_row(row) }

        {
          source: "databuild",
          format: "csv",
          rows: normalized_rows,
          suggested_mapping: column_mapping,
          detected_headers: detected_headers,
          row_count: normalized_rows.length,
          success: true
        }
      rescue StandardError => e
        error_result("Failed to parse CSV: #{e.message}")
      end

      # Parses Databuild XML file into normalized format
      #
      # @param file_path [String] Path to XML file
      # @return [Hash] Parsed result with normalized rows and suggested mapping
      def parse_xml(file_path)
        return error_result("File path required") if file_path.blank?
        return error_result("File not found: #{file_path}") unless File.exist?(file_path)

        content = File.read(file_path)
        doc = REXML::Document.new(content)

        items = extract_items_from_xml(doc)
        normalized_rows = items.map { |item| normalize_xml_item(item) }

        {
          source: "databuild",
          format: "xml",
          rows: normalized_rows,
          suggested_mapping: column_mapping,
          detected_headers: extract_xml_headers(items.first),
          row_count: normalized_rows.length,
          success: true
        }
      rescue REXML::ParseException => e
        error_result("Invalid XML format: #{e.message}")
      rescue StandardError => e
        error_result("Failed to parse XML: #{e.message}")
      end

      # Returns default column mapping from Databuild fields to TEEEM pricebook columns
      #
      # @return [Hash] Mapping of Databuild fields to TEEEM fields
      def column_mapping
        {
          "item_code" => "code",
          "code" => "code",
          "description" => "name",
          "name" => "name",
          "unit" => "unit",
          "uom" => "unit",
          "rate" => "cost_price",
          "unit_rate" => "cost_price",
          "cost_price" => "cost_price",
          "sell_rate" => "sell_price",
          "selling_price" => "sell_price",
          "sell_price" => "sell_price",
          "trade" => "category",
          "category" => "category",
          "supplier" => "supplier_name",
          "supplier_name" => "supplier_name",
          "labour_rate" => "labour_rate",
          "labour_hours" => "labour_hours",
          "notes" => "notes"
        }
      end

      private

      # Normalizes a single CSV row to standard format
      def normalize_row(row)
        normalized = {}

        row.each do |key, value|
          normalized_key = normalize_header(key)
          normalized[normalized_key] = normalize_value(value)
        end

        # Apply standard field mappings
        apply_standard_mappings(normalized)
      end

      # Normalizes header name to snake_case
      def normalize_header(header)
        header.to_s
              .strip
              .downcase
              .gsub(/\s+/, "_")
              .gsub(/[^\w_]/, "")
      end

      # Normalizes cell value (trim whitespace, handle empty strings)
      def normalize_value(value)
        return nil if value.blank?

        str_value = value.to_s.strip
        str_value.empty? ? nil : str_value
      end

      # Applies standard field mappings to normalized row
      def apply_standard_mappings(row)
        mapped = {}

        # Map item_code or code to code
        mapped["item_code"] = row["item_code"] || row["code"]

        # Map description to name
        mapped["name"] = row["description"] || row["name"]

        # Map unit or uom to unit
        mapped["unit"] = row["unit"] || row["uom"]

        # Map various rate fields to cost_price
        mapped["cost_price"] = row["rate"] || row["unit_rate"] || row["cost_price"]

        # Map various sell fields to sell_price
        mapped["sell_price"] = row["sell_rate"] || row["selling_price"] || row["sell_price"]

        # Map trade or category to category
        mapped["category"] = row["trade"] || row["category"]

        # Map supplier fields
        mapped["supplier_name"] = row["supplier"] || row["supplier_name"]

        # Labour fields
        mapped["labour_rate"] = row["labour_rate"]
        mapped["labour_hours"] = row["labour_hours"]

        # Additional fields
        mapped["notes"] = row["notes"]

        # Remove nil values
        mapped.compact
      end

      # Extracts item elements from XML document
      def extract_items_from_xml(doc)
        items = []

        # Try multiple possible item element names
        %w[Item LineItem EstimateItem].each do |element_name|
          doc.elements.each("//#{element_name}") do |item|
            items << item
          end
        end

        items
      end

      # Normalizes a single XML item element to standard format
      def normalize_xml_item(item_element)
        item = {}

        # Extract all child elements
        item_element.elements.each do |element|
          key = normalize_header(element.name)
          value = element.text
          item[key] = normalize_value(value)
        end

        # Apply standard field mappings
        apply_standard_mappings(item)
      end

      # Extracts headers from first XML item
      def extract_xml_headers(item_element)
        return [] if item_element.nil?

        headers = []
        item_element.elements.each do |element|
          headers << element.name
        end
        headers
      end

      # Returns error result hash
      def error_result(message)
        {
          source: "databuild",
          success: false,
          error: message,
          rows: [],
          row_count: 0
        }
      end
    end
  end
end
