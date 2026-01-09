# frozen_string_literal: true

module TeeemXl
  module Reader
    # StylesReader parses xl/styles.xml
    #
    # Excel's style system is hierarchical:
    # - numFmts: Number format definitions
    # - fonts: Font definitions
    # - fills: Fill/background definitions
    # - borders: Border definitions
    # - cellXfs: Combined cell formats (indexed by style_index on cells)
    #
    # We parse what's needed for reading: number formats for date detection.
    #
    class StylesReader
      NS = TeeemXl::NAMESPACES[:spreadsheet]

      # Standard date format IDs (Excel built-in)
      DATE_FORMAT_IDS = [14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47].freeze

      def initialize(package)
        @package = package
      end

      # Parse styles and return style info
      #
      # @return [Hash] { number_formats: {id => code}, cell_formats: [{num_fmt_id: n}] }
      def read
        path = find_styles_path
        return empty_styles unless path

        xml = @package.read_xml(path)
        return empty_styles unless xml

        {
          number_formats: parse_number_formats(xml),
          cell_formats: parse_cell_formats(xml)
        }
      end

      # Check if a style index represents a date format
      #
      # @param style_index [Integer] Cell style index
      # @param styles [Hash] Parsed styles from read()
      # @return [Boolean]
      def self.date_format?(style_index, styles)
        return false unless style_index && styles

        cell_format = styles[:cell_formats][style_index]
        return false unless cell_format

        num_fmt_id = cell_format[:num_fmt_id]
        return false unless num_fmt_id

        # Check built-in date formats
        return true if DATE_FORMAT_IDS.include?(num_fmt_id)

        # Check custom format codes for date patterns
        custom_format = styles[:number_formats][num_fmt_id]
        return false unless custom_format

        date_format_code?(custom_format)
      end

      private

      def find_styles_path
        rels = @package.relationships_for(@package.workbook_path)
        targets = rels.targets_for_type(TeeemXl::RELATIONSHIP_TYPES[:styles])
        targets.first
      end

      def empty_styles
        { number_formats: {}, cell_formats: [] }
      end

      def parse_number_formats(xml)
        formats = {}

        xml.xpath("//xmlns:numFmts/xmlns:numFmt", "xmlns" => NS).each do |node|
          id = node["numFmtId"]&.to_i
          code = node["formatCode"]
          formats[id] = code if id && code
        end

        formats
      end

      def parse_cell_formats(xml)
        formats = []

        xml.xpath("//xmlns:cellXfs/xmlns:xf", "xmlns" => NS).each do |node|
          formats << {
            num_fmt_id: node["numFmtId"]&.to_i,
            font_id: node["fontId"]&.to_i,
            fill_id: node["fillId"]&.to_i,
            border_id: node["borderId"]&.to_i,
            xf_id: node["xfId"]&.to_i
          }
        end

        formats
      end

      def self.date_format_code?(code)
        # Date formats typically contain: d, m, y (but not h:mm without d/m/y)
        # Exclude pure time formats and general numeric formats
        return false if code.nil?

        normalized = code.downcase

        # Must have date components
        has_date = normalized.include?("y") ||
                   (normalized.include?("m") && normalized.include?("d")) ||
                   normalized.include?("mmm")

        # Exclude things that look like dates but aren't
        not_date = normalized.include?("[") && !normalized.include?("y")

        has_date && !not_date
      end
    end
  end
end
