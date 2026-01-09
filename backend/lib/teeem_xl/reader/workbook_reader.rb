# frozen_string_literal: true

module TeeemXl
  module Reader
    # WorkbookReader is the main entry point for reading XLSX files.
    #
    # It coordinates parsing of:
    # - Workbook structure (xl/workbook.xml)
    # - Shared strings (xl/sharedStrings.xml)
    # - Styles (xl/styles.xml)
    # - Individual worksheets (xl/worksheets/sheetN.xml)
    #
    # Usage:
    #   package = TeeemXl::Package.new("file.xlsx")
    #   reader = WorkbookReader.new(package)
    #   workbook = reader.read
    #
    class WorkbookReader
      NS = TeeemXl::NAMESPACES[:spreadsheet]

      def initialize(package)
        @package = package
      end

      # Read and parse the workbook
      #
      # @return [Models::Workbook] Parsed workbook
      def read
        # Parse supporting files first
        @shared_strings = SharedStringsReader.new(@package).read
        @styles = StylesReader.new(@package).read

        # Parse workbook structure
        workbook_xml = @package.read_xml(@package.workbook_path)
        raise CorruptedFileError, "Could not read workbook.xml" unless workbook_xml

        # Build workbook model
        workbook = Models::Workbook.new
        workbook.instance_variable_set(:@shared_strings, build_shared_strings)

        # Parse sheets
        parse_sheets(workbook_xml, workbook)

        # Parse named ranges
        parse_defined_names(workbook_xml, workbook)

        workbook
      end

      # Stream read the workbook (for large files)
      # Yields rows one at a time without loading entire workbook
      #
      # @yield [sheet_name, row_number, cells] Each row
      def stream_read(&block)
        @shared_strings = SharedStringsReader.new(@package).read
        @styles = StylesReader.new(@package).read

        workbook_xml = @package.read_xml(@package.workbook_path)
        raise CorruptedFileError, "Could not read workbook.xml" unless workbook_xml

        worksheet_reader = WorksheetReader.new(@package, @shared_strings, @styles)

        # Stream each sheet
        each_sheet_info(workbook_xml) do |sheet_info|
          worksheet_reader.stream_read(sheet_info[:path]) do |row_num, cells|
            yield(sheet_info[:name], row_num, cells)
          end
        end
      end

      private

      def parse_sheets(workbook_xml, workbook)
        worksheet_reader = WorksheetReader.new(@package, @shared_strings, @styles)
        workbook_rels = @package.relationships_for(@package.workbook_path)

        each_sheet_info(workbook_xml) do |sheet_info|
          sheet = worksheet_reader.read(
            sheet_info[:path],
            name: sheet_info[:name],
            sheet_id: sheet_info[:sheet_id],
            rel_id: sheet_info[:rel_id]
          )
          workbook.sheets << sheet
        end
      end

      def each_sheet_info(workbook_xml, &block)
        workbook_rels = @package.relationships_for(@package.workbook_path)

        workbook_xml.xpath("//xmlns:sheets/xmlns:sheet", "xmlns" => NS).each do |sheet_node|
          name = sheet_node["name"]
          sheet_id = sheet_node["sheetId"]&.to_i
          rel_id = sheet_node.attribute_with_ns("id", TeeemXl::NAMESPACES[:office_document])&.value ||
                   sheet_node["r:id"]

          # Resolve relationship to get worksheet path
          worksheet_path = workbook_rels.target_for(rel_id)
          next unless worksheet_path

          yield({
            name: name,
            sheet_id: sheet_id,
            rel_id: rel_id,
            path: worksheet_path
          })
        end
      end

      def parse_defined_names(workbook_xml, workbook)
        workbook_xml.xpath("//xmlns:definedNames/xmlns:definedName", "xmlns" => NS).each do |node|
          name = node["name"]
          reference = node.text
          workbook.define_name(name, reference) if name && reference
        end
      end

      def build_shared_strings
        ss = Models::SharedStrings.new
        @shared_strings.each { |str| ss.add(str) }
        ss
      end
    end
  end
end
