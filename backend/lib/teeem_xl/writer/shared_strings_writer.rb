# frozen_string_literal: true

module TeeemXl
  module Writer
    # SharedStringsWriter generates xl/sharedStrings.xml
    #
    # Output structure:
    #   <sst xmlns="..." count="10" uniqueCount="5">
    #     <si><t>String 1</t></si>
    #     <si><t>String 2</t></si>
    #     ...
    #   </sst>
    #
    class SharedStringsWriter
      NS = TeeemXl::NAMESPACES[:spreadsheet]

      def initialize(shared_strings)
        @shared_strings = shared_strings
      end

      # Generate XML content
      #
      # @return [String] XML content
      def to_xml
        builder = Nokogiri::XML::Builder.new(encoding: "UTF-8") do |xml|
          xml.sst(
            xmlns: NS,
            count: @shared_strings.count,
            uniqueCount: @shared_strings.unique_count
          ) do
            @shared_strings.strings.each do |str|
              xml.si do
                xml.t(str)
              end
            end
          end
        end

        builder.to_xml
      end
    end
  end
end
