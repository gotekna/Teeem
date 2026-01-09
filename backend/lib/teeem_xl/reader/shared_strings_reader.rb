# frozen_string_literal: true

module TeeemXL
  module Reader
    # SharedStringsReader parses xl/sharedStrings.xml
    #
    # Excel stores unique strings once and references them by index.
    # This parser builds the string lookup table used when reading cells.
    #
    # Structure:
    #   <sst count="10" uniqueCount="5">
    #     <si><t>String 1</t></si>
    #     <si><r><t>Rich</t></r><r><t>Text</t></r></si>
    #     ...
    #   </sst>
    #
    class SharedStringsReader
      NS = TeeemXL::NAMESPACES[:spreadsheet]

      def initialize(package)
        @package = package
      end

      # Parse shared strings and return array of strings
      #
      # @return [Array<String>] Indexed array of strings
      def read
        path = find_shared_strings_path
        return [] unless path

        xml = @package.read_xml(path)
        return [] unless xml

        parse_strings(xml)
      end

      private

      def find_shared_strings_path
        rels = @package.relationships_for(@package.workbook_path)
        targets = rels.targets_for_type(TeeemXL::RELATIONSHIP_TYPES[:shared_strings])
        targets.first
      end

      def parse_strings(xml)
        strings = []

        xml.xpath("//xmlns:si", "xmlns" => NS).each do |si|
          strings << extract_string_value(si)
        end

        strings
      end

      def extract_string_value(si_node)
        # Check for simple text first
        t_node = si_node.at_xpath("xmlns:t", "xmlns" => NS)
        return t_node.text if t_node

        # Handle rich text (multiple <r> runs)
        runs = si_node.xpath("xmlns:r/xmlns:t", "xmlns" => NS)
        if runs.any?
          return runs.map(&:text).join
        end

        # Fallback
        ""
      end
    end
  end
end
