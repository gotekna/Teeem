# frozen_string_literal: true

module TeeemXl
  module Writer
    # WorksheetWriter generates worksheet XML files
    #
    # Output structure:
    #   <worksheet xmlns="...">
    #     <sheetViews>...</sheetViews>
    #     <cols>...</cols>
    #     <sheetData>
    #       <row r="1">
    #         <c r="A1" t="s"><v>0</v></c>
    #       </row>
    #     </sheetData>
    #     <mergeCells>...</mergeCells>
    #     <autoFilter>...</autoFilter>
    #   </worksheet>
    #
    class WorksheetWriter
      NS = TeeemXl::NAMESPACES[:spreadsheet]

      # Excel's date epoch (December 30, 1899)
      EXCEL_EPOCH = Date.new(1899, 12, 30)

      # Built-in date format ID (yyyy-mm-dd)
      DATE_FORMAT_ID = 14
      # Built-in datetime format ID
      DATETIME_FORMAT_ID = 22

      def initialize(worksheet, shared_strings, styles = nil)
        @worksheet = worksheet
        @shared_strings = shared_strings
        @styles = styles
        @date_style_index = nil
        @datetime_style_index = nil
      end

      # Get or create date style index
      def date_style_index
        return @date_style_index if @date_style_index
        return nil unless @styles

        @date_style_index = @styles.add_cell_format(number_format: "yyyy-mm-dd")
        @date_style_index
      end

      # Get or create datetime style index
      def datetime_style_index
        return @datetime_style_index if @datetime_style_index
        return nil unless @styles

        @datetime_style_index = @styles.add_cell_format(number_format: "yyyy-mm-dd hh:mm:ss")
        @datetime_style_index
      end

      # Generate XML content
      #
      # @return [String] XML content
      def to_xml
        builder = Nokogiri::XML::Builder.new(encoding: "UTF-8") do |xml|
          xml.worksheet(
            xmlns: NS,
            "xmlns:r" => TeeemXl::NAMESPACES[:office_document]
          ) do
            write_sheet_views(xml)
            write_sheet_format_pr(xml)
            write_cols(xml)
            write_sheet_data(xml)
            write_merge_cells(xml)
            write_auto_filter(xml)
          end
        end

        builder.to_xml
      end

      private

      def write_sheet_views(xml)
        xml.sheetViews do
          xml.sheetView(tabSelected: 1, workbookViewId: 0) do
            panes = @worksheet.frozen_panes
            if panes && (panes[:row] > 0 || panes[:col] > 0)
              top_left = Models::Cell.make_reference(panes[:row] + 1, panes[:col])
              attrs = {
                state: "frozen",
                topLeftCell: top_left
              }
              attrs[:xSplit] = panes[:col] if panes[:col] > 0
              attrs[:ySplit] = panes[:row] if panes[:row] > 0
              xml.pane(attrs)
            end
          end
        end
      end

      def write_sheet_format_pr(xml)
        xml.sheetFormatPr(defaultRowHeight: 15)
      end

      def write_cols(xml)
        return if @worksheet.column_widths.empty?

        xml.cols do
          # Group consecutive columns with same width
          sorted_cols = @worksheet.column_widths.sort_by { |k, _| k }
          sorted_cols.each do |col_idx, width|
            xml.col(
              min: col_idx + 1,  # OOXML is 1-based
              max: col_idx + 1,
              width: width,
              customWidth: 1
            )
          end
        end
      end

      def write_sheet_data(xml)
        xml.sheetData do
          return if @worksheet.empty?

          # Write rows in order
          (@worksheet.min_row..@worksheet.max_row).each do |row_num|
            cells = @worksheet.row(row_num)
            next if cells.empty?

            spans = "#{cells.first.column_index + 1}:#{cells.last.column_index + 1}"
            row_height = @worksheet.row_heights[row_num]

            row_attrs = { r: row_num, spans: spans }
            row_attrs[:ht] = row_height if row_height
            row_attrs[:customHeight] = 1 if row_height

            xml.row(row_attrs) do
              cells.each do |cell|
                write_cell(xml, cell)
              end
            end
          end
        end
      end

      def write_cell(xml, cell)
        attrs = { r: cell.reference }
        attrs[:s] = cell.style_index if cell.style_index

        value = cell.value
        type = cell.type

        # Handle different cell types
        case type
        when :string
          # Use shared string
          string_index = @shared_strings.add(value.to_s)
          attrs[:t] = "s"
          xml.c(attrs) do
            xml.v(string_index)
          end

        when :number
          xml.c(attrs) do
            if cell.formula?
              xml.f(cell.formula)
            end
            xml.v(value)
          end

        when :boolean
          attrs[:t] = "b"
          xml.c(attrs) do
            xml.v(value ? 1 : 0)
          end

        when :date
          # Convert to Excel serial date
          serial = date_to_serial(value)
          # Apply date style if not already styled
          unless attrs[:s]
            if value.is_a?(DateTime) || value.is_a?(Time)
              attrs[:s] = datetime_style_index if datetime_style_index
            else
              attrs[:s] = date_style_index if date_style_index
            end
          end
          xml.c(attrs) do
            xml.v(serial)
          end

        when :error
          attrs[:t] = "e"
          xml.c(attrs) do
            xml.v(value)
          end

        when :formula
          xml.c(attrs) do
            xml.f(cell.formula)
            xml.v(cell.cached_value) if cell.cached_value
          end

        when :blank
          xml.c(attrs)

        else
          # Default: treat as string
          if value.nil?
            xml.c(attrs)
          else
            string_index = @shared_strings.add(value.to_s)
            attrs[:t] = "s"
            xml.c(attrs) do
              xml.v(string_index)
            end
          end
        end
      end

      def write_merge_cells(xml)
        return if @worksheet.merged_cells.empty?

        xml.mergeCells(count: @worksheet.merged_cells.size) do
          @worksheet.merged_cells.each do |ref|
            xml.mergeCell(ref: ref)
          end
        end
      end

      def write_auto_filter(xml)
        return unless @worksheet.auto_filter

        xml.autoFilter(ref: @worksheet.auto_filter)
      end

      def date_to_serial(date)
        # Excel uses a serial date system starting from Dec 30, 1899
        # Excel has a bug where it thinks 1900 was a leap year (Feb 29, 1900 = day 60)
        # For dates on or after Mar 1, 1900, we need to add 1 to the serial
        march_1_1900 = Date.new(1900, 3, 1)

        case date
        when DateTime, Time
          days = (date.to_date - EXCEL_EPOCH).to_i
          days += 1 if date.to_date >= march_1_1900  # Account for Excel's leap year bug
          time_fraction = (date.hour * 3600 + date.min * 60 + date.sec) / 86400.0
          days + time_fraction
        when Date
          days = (date - EXCEL_EPOCH).to_i
          days += 1 if date >= march_1_1900  # Account for Excel's leap year bug
          days
        else
          date
        end
      end
    end
  end
end
