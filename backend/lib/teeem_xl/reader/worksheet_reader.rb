# frozen_string_literal: true

module TeeemXL
  module Reader
    # WorksheetReader parses individual worksheet XML files.
    #
    # Structure:
    #   <worksheet>
    #     <sheetData>
    #       <row r="1" spans="1:5">
    #         <c r="A1" t="s"><v>0</v></c>     <!-- Shared string at index 0 -->
    #         <c r="B1"><v>42</v></c>          <!-- Number -->
    #         <c r="C1" t="b"><v>1</v></c>     <!-- Boolean -->
    #         <c r="D1"><f>A1+B1</f><v>42</v></c> <!-- Formula with cached value -->
    #       </row>
    #     </sheetData>
    #     <mergeCells>
    #       <mergeCell ref="A1:B1"/>
    #     </mergeCells>
    #   </worksheet>
    #
    class WorksheetReader
      NS = TeeemXL::NAMESPACES[:spreadsheet]

      # Excel's date epoch (December 30, 1899)
      # Excel has a bug where it thinks 1900 was a leap year,
      # so dates before March 1, 1900 are off by one day.
      EXCEL_EPOCH = Date.new(1899, 12, 30)

      def initialize(package, shared_strings, styles)
        @package = package
        @shared_strings = shared_strings
        @styles = styles
      end

      # Read worksheet from path
      #
      # @param path [String] Path to worksheet XML
      # @param name [String] Sheet name
      # @return [Models::Worksheet]
      def read(path, name:, sheet_id: nil, rel_id: nil)
        xml = @package.read_xml(path)
        raise CorruptedFileError, "Could not read worksheet: #{path}" unless xml

        sheet = Models::Worksheet.new(name: name, sheet_id: sheet_id, rel_id: rel_id)
        parse_sheet_data(xml, sheet)
        parse_merge_cells(xml, sheet)
        parse_sheet_views(xml, sheet)
        parse_cols(xml, sheet)

        sheet
      end

      # Stream read worksheet (for large files)
      # Yields rows one at a time without loading entire sheet
      #
      # @param path [String] Path to worksheet XML
      # @yield [row_number, cells] Each row
      def stream_read(path, &block)
        content = @package.read_part(path)
        raise CorruptedFileError, "Could not read worksheet: #{path}" unless content

        # Use SAX-like streaming for large files
        current_row = nil
        current_row_num = 0
        cells = []

        Nokogiri::XML::Reader(content).each do |node|
          case node.node_type
          when Nokogiri::XML::Reader::TYPE_ELEMENT
            case node.name
            when "row"
              current_row_num = node.attribute("r")&.to_i || (current_row_num + 1)
              cells = []
            when "c"
              cell = parse_cell_from_reader(node)
              cells << cell if cell
            end
          when Nokogiri::XML::Reader::TYPE_END_ELEMENT
            if node.name == "row" && cells.any?
              yield(current_row_num, cells)
            end
          end
        end
      end

      private

      def parse_sheet_data(xml, sheet)
        xml.xpath("//xmlns:sheetData/xmlns:row", "xmlns" => NS).each do |row_node|
          row_num = row_node["r"]&.to_i

          row_node.xpath("xmlns:c", "xmlns" => NS).each do |cell_node|
            cell = parse_cell(cell_node)
            sheet.set_cell(
              cell.reference,
              cell.value,
              type: cell.type,
              style_index: cell.style_index,
              formula: cell.formula
            )
          end
        end
      end

      def parse_cell(cell_node)
        ref = cell_node["r"]
        type_attr = cell_node["t"]
        style_index = cell_node["s"]&.to_i

        # Get raw value
        v_node = cell_node.at_xpath("xmlns:v", "xmlns" => NS)
        raw_value = v_node&.text

        # Get formula if present
        f_node = cell_node.at_xpath("xmlns:f", "xmlns" => NS)
        formula = f_node&.text

        # Get inline string if present
        is_node = cell_node.at_xpath("xmlns:is/xmlns:t", "xmlns" => NS)

        # Determine type and value
        type, value = resolve_cell_value(type_attr, raw_value, is_node, style_index)

        cell = Models::Cell.new(
          reference: ref,
          value: value,
          type: type,
          style_index: style_index,
          formula: formula
        )

        # Store cached value for formulas
        if formula && raw_value
          cell.cached_value = convert_value(raw_value, nil, style_index)
        end

        cell
      end

      def resolve_cell_value(type_attr, raw_value, inline_string_node, style_index)
        case type_attr
        when "s"
          # Shared string reference
          index = raw_value&.to_i
          value = @shared_strings[index]
          [:string, value]
        when "inlineStr"
          # Inline string
          value = inline_string_node&.text
          [:inline_string, value]
        when "b"
          # Boolean
          [:boolean, raw_value == "1"]
        when "e"
          # Error
          [:error, raw_value]
        when "str"
          # Formula result as string
          [:string, raw_value]
        when "d"
          # Date (ISO 8601)
          [:date, parse_iso_date(raw_value)]
        else
          # Number (or nil)
          if raw_value.nil?
            [:blank, nil]
          else
            value = convert_value(raw_value, type_attr, style_index)
            type = determine_type(value, style_index)
            [type, value]
          end
        end
      end

      def convert_value(raw_value, type_attr, style_index)
        return nil if raw_value.nil?

        # Check if this is a date based on style
        if StylesReader.date_format?(style_index, @styles)
          return parse_excel_date(raw_value.to_f)
        end

        # Parse as number
        if raw_value.include?(".")
          raw_value.to_f
        else
          raw_value.to_i
        end
      end

      def determine_type(value, style_index)
        case value
        when Date, DateTime, Time then :date
        when Float then :number
        when Integer then :number
        else :string
        end
      end

      def parse_excel_date(serial)
        return nil if serial.nil? || serial.zero?

        # Excel serial date to Ruby Date
        # Handle the Excel 1900 leap year bug
        days = serial.to_i
        days -= 1 if days > 60  # Account for Excel's leap year bug

        time_fraction = serial - serial.to_i

        date = EXCEL_EPOCH + days

        if time_fraction > 0
          # Include time component
          hours = (time_fraction * 24).to_i
          minutes = ((time_fraction * 24 - hours) * 60).to_i
          seconds = (((time_fraction * 24 - hours) * 60 - minutes) * 60).round

          DateTime.new(date.year, date.month, date.day, hours, minutes, seconds)
        else
          date
        end
      end

      def parse_iso_date(value)
        return nil unless value

        DateTime.parse(value)
      rescue ArgumentError
        value
      end

      def parse_merge_cells(xml, sheet)
        xml.xpath("//xmlns:mergeCells/xmlns:mergeCell", "xmlns" => NS).each do |node|
          ref = node["ref"]
          sheet.merge_cells(ref) if ref
        end
      end

      def parse_sheet_views(xml, sheet)
        pane = xml.at_xpath("//xmlns:sheetViews/xmlns:sheetView/xmlns:pane", "xmlns" => NS)
        return unless pane

        x_split = pane["xSplit"]&.to_i || 0
        y_split = pane["ySplit"]&.to_i || 0

        sheet.freeze_panes(row: y_split, col: x_split) if x_split > 0 || y_split > 0
      end

      def parse_cols(xml, sheet)
        xml.xpath("//xmlns:cols/xmlns:col", "xmlns" => NS).each do |col_node|
          min_col = col_node["min"]&.to_i
          max_col = col_node["max"]&.to_i
          width = col_node["width"]&.to_f

          next unless min_col && width

          # Column indices in OOXML are 1-based
          (min_col..max_col).each do |col|
            sheet.set_column_width(col - 1, width)
          end
        end
      end

      def parse_cell_from_reader(node)
        # For streaming, we need to read the full cell XML
        return nil unless node.inner_xml

        cell_xml = "<c #{node.attributes.map { |k, v| "#{k}=\"#{v}\"" }.join(" ")}>#{node.inner_xml}</c>"
        cell_doc = Nokogiri::XML::DocumentFragment.parse(cell_xml)
        cell_node = cell_doc.at_css("c")

        parse_cell(cell_node) if cell_node
      end
    end
  end
end
