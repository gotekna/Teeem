# frozen_string_literal: true

require "zip"
require "stringio"

module TeeemXL
  module Writer
    # WorkbookWriter generates complete XLSX files.
    #
    # Creates the ZIP archive with all required parts:
    # - [Content_Types].xml
    # - _rels/.rels
    # - xl/workbook.xml
    # - xl/_rels/workbook.xml.rels
    # - xl/worksheets/sheet1.xml, sheet2.xml, ...
    # - xl/sharedStrings.xml
    # - xl/styles.xml
    #
    class WorkbookWriter
      NS = TeeemXL::NAMESPACES[:spreadsheet]

      def initialize(workbook)
        @workbook = workbook
      end

      # Write workbook to file or IO
      #
      # @param destination [String, IO, Pathname] Output path or IO
      def write(destination)
        case destination
        when String, Pathname
          write_to_file(destination.to_s)
        when IO, StringIO
          # Write to temp file then copy to IO
          content = to_string
          destination.write(content)
        else
          raise ArgumentError, "Unknown destination type: #{destination.class}"
        end
      end

      # Write workbook and return as string
      #
      # @return [String] Binary XLSX data
      def to_string
        buffer = Zip::OutputStream.write_buffer do |zip|
          # Collect all strings first (for shared strings)
          collect_strings

          # Write required parts
          write_content_types(zip)
          write_package_rels(zip)
          write_workbook(zip)
          write_workbook_rels(zip)
          write_worksheets(zip)
          write_shared_strings(zip)
          write_styles(zip)
        end

        buffer.string
      end

      private

      def write_to_file(path)
        # Use Zip::File for writing to actual files
        Zip::File.open(path, Zip::File::CREATE) do |zip|
          # Collect all strings first (for shared strings)
          collect_strings

          # Write required parts
          write_content_types_to_zip(zip)
          write_package_rels_to_zip(zip)
          write_workbook_to_zip(zip)
          write_workbook_rels_to_zip(zip)
          write_worksheets_to_zip(zip)
          write_shared_strings_to_zip(zip)
          write_styles_to_zip(zip)
        end
      end

      def collect_strings
        # Pre-populate shared strings from all cells
        @workbook.sheets.each do |sheet|
          sheet.cells.each_value do |cell|
            if cell.type == :string && cell.value
              @workbook.shared_strings.add(cell.value.to_s)
            end
          end
        end
      end

      def write_content_types(zip)
        content_types = ContentTypes.empty

        # Default extensions
        content_types.add_default("rels", "application/vnd.openxmlformats-package.relationships+xml")
        content_types.add_default("xml", "application/xml")

        # Override specific parts
        content_types.add_override("/xl/workbook.xml", CONTENT_TYPES[:workbook])
        content_types.add_override("/xl/sharedStrings.xml", CONTENT_TYPES[:shared_strings])
        content_types.add_override("/xl/styles.xml", CONTENT_TYPES[:styles])

        @workbook.sheets.each_with_index do |_, idx|
          content_types.add_override("/xl/worksheets/sheet#{idx + 1}.xml", CONTENT_TYPES[:worksheet])
        end

        zip.put_next_entry("[Content_Types].xml")
        zip.write(content_types.to_xml)
      end

      def write_package_rels(zip)
        rels = Relationships.empty
        rels.add(
          id: "rId1",
          type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
          target: "xl/workbook.xml"
        )

        zip.put_next_entry("_rels/.rels")
        zip.write(rels.to_xml)
      end

      def write_workbook(zip)
        builder = Nokogiri::XML::Builder.new(encoding: "UTF-8") do |xml|
          xml.workbook(
            xmlns: NS,
            "xmlns:r" => TeeemXL::NAMESPACES[:office_document]
          ) do
            xml.sheets do
              @workbook.sheets.each_with_index do |sheet, idx|
                xml.sheet(
                  name: sheet.name,
                  sheetId: idx + 1,
                  "r:id" => "rId#{idx + 1}"
                )
              end
            end

            # Write defined names if any
            if @workbook.named_ranges.any?
              xml.definedNames do
                @workbook.named_ranges.each do |name, reference|
                  xml.definedName(name: name) { xml.text(reference) }
                end
              end
            end
          end
        end

        zip.put_next_entry("xl/workbook.xml")
        zip.write(builder.to_xml)
      end

      def write_workbook_rels(zip)
        rels = Relationships.empty

        # Add worksheet relationships
        @workbook.sheets.each_with_index do |_, idx|
          rels.add(
            id: "rId#{idx + 1}",
            type: RELATIONSHIP_TYPES[:worksheet],
            target: "worksheets/sheet#{idx + 1}.xml"
          )
        end

        # Add shared strings relationship
        next_id = @workbook.sheets.size + 1
        rels.add(
          id: "rId#{next_id}",
          type: RELATIONSHIP_TYPES[:shared_strings],
          target: "sharedStrings.xml"
        )

        # Add styles relationship
        rels.add(
          id: "rId#{next_id + 1}",
          type: RELATIONSHIP_TYPES[:styles],
          target: "styles.xml"
        )

        zip.put_next_entry("xl/_rels/workbook.xml.rels")
        zip.write(rels.to_xml)
      end

      def write_worksheets(zip)
        @workbook.sheets.each_with_index do |sheet, idx|
          writer = WorksheetWriter.new(sheet, @workbook.shared_strings)
          zip.put_next_entry("xl/worksheets/sheet#{idx + 1}.xml")
          zip.write(writer.to_xml)
        end
      end

      def write_shared_strings(zip)
        return if @workbook.shared_strings.empty?

        writer = SharedStringsWriter.new(@workbook.shared_strings)
        zip.put_next_entry("xl/sharedStrings.xml")
        zip.write(writer.to_xml)
      end

      def write_styles(zip)
        writer = StylesWriter.new(@workbook.styles)
        zip.put_next_entry("xl/styles.xml")
        zip.write(writer.to_xml)
      end

      # Zip::File versions (for writing to actual files)

      def write_content_types_to_zip(zip)
        content_types = ContentTypes.empty
        content_types.add_default("rels", "application/vnd.openxmlformats-package.relationships+xml")
        content_types.add_default("xml", "application/xml")
        content_types.add_override("/xl/workbook.xml", CONTENT_TYPES[:workbook])
        content_types.add_override("/xl/sharedStrings.xml", CONTENT_TYPES[:shared_strings])
        content_types.add_override("/xl/styles.xml", CONTENT_TYPES[:styles])

        @workbook.sheets.each_with_index do |_, idx|
          content_types.add_override("/xl/worksheets/sheet#{idx + 1}.xml", CONTENT_TYPES[:worksheet])
        end

        zip.get_output_stream("[Content_Types].xml") { |f| f.write(content_types.to_xml) }
      end

      def write_package_rels_to_zip(zip)
        rels = Relationships.empty
        rels.add(
          id: "rId1",
          type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
          target: "xl/workbook.xml"
        )

        zip.get_output_stream("_rels/.rels") { |f| f.write(rels.to_xml) }
      end

      def write_workbook_to_zip(zip)
        builder = Nokogiri::XML::Builder.new(encoding: "UTF-8") do |xml|
          xml.workbook(
            xmlns: NS,
            "xmlns:r" => TeeemXL::NAMESPACES[:office_document]
          ) do
            xml.sheets do
              @workbook.sheets.each_with_index do |sheet, idx|
                xml.sheet(
                  name: sheet.name,
                  sheetId: idx + 1,
                  "r:id" => "rId#{idx + 1}"
                )
              end
            end

            if @workbook.named_ranges.any?
              xml.definedNames do
                @workbook.named_ranges.each do |name, reference|
                  xml.definedName(name: name) { xml.text(reference) }
                end
              end
            end
          end
        end

        zip.get_output_stream("xl/workbook.xml") { |f| f.write(builder.to_xml) }
      end

      def write_workbook_rels_to_zip(zip)
        rels = Relationships.empty

        @workbook.sheets.each_with_index do |_, idx|
          rels.add(
            id: "rId#{idx + 1}",
            type: RELATIONSHIP_TYPES[:worksheet],
            target: "worksheets/sheet#{idx + 1}.xml"
          )
        end

        next_id = @workbook.sheets.size + 1
        rels.add(
          id: "rId#{next_id}",
          type: RELATIONSHIP_TYPES[:shared_strings],
          target: "sharedStrings.xml"
        )

        rels.add(
          id: "rId#{next_id + 1}",
          type: RELATIONSHIP_TYPES[:styles],
          target: "styles.xml"
        )

        zip.get_output_stream("xl/_rels/workbook.xml.rels") { |f| f.write(rels.to_xml) }
      end

      def write_worksheets_to_zip(zip)
        @workbook.sheets.each_with_index do |sheet, idx|
          writer = WorksheetWriter.new(sheet, @workbook.shared_strings)
          zip.get_output_stream("xl/worksheets/sheet#{idx + 1}.xml") { |f| f.write(writer.to_xml) }
        end
      end

      def write_shared_strings_to_zip(zip)
        return if @workbook.shared_strings.empty?

        writer = SharedStringsWriter.new(@workbook.shared_strings)
        zip.get_output_stream("xl/sharedStrings.xml") { |f| f.write(writer.to_xml) }
      end

      def write_styles_to_zip(zip)
        writer = StylesWriter.new(@workbook.styles)
        zip.get_output_stream("xl/styles.xml") { |f| f.write(writer.to_xml) }
      end
    end
  end
end
