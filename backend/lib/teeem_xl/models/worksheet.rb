# frozen_string_literal: true

module TeeemXl
  module Models
    # Worksheet represents a single sheet in a workbook.
    #
    # Contains:
    # - Name: Sheet tab name
    # - Cells: Cell data organized by row and column
    # - Merged cells: Ranges that are merged
    # - Column widths: Custom column dimensions
    # - Row heights: Custom row dimensions
    # - Frozen panes: Frozen row/column configuration
    #
    class Worksheet
      attr_accessor :name, :sheet_id, :rel_id
      attr_reader :cells, :merged_cells, :column_widths, :row_heights

      def initialize(name:, sheet_id: nil, rel_id: nil)
        @name = name
        @sheet_id = sheet_id
        @rel_id = rel_id
        @cells = {}           # { "A1" => Cell, "B2" => Cell }
        @rows = {}            # { 1 => [Cell, Cell], 2 => [Cell] }
        @merged_cells = []    # ["A1:B2", "C3:D4"]
        @column_widths = {}   # { 0 => 15.0, 1 => 20.0 }
        @row_heights = {}     # { 1 => 20.0, 2 => 15.0 }
        @frozen_panes = nil   # { row: 1, col: 0 }
        @auto_filter = nil    # "A1:D10"
      end

      # Get cell by reference
      #
      # @param reference [String] Cell reference (e.g., "A1")
      # @return [Cell, nil]
      def cell(reference)
        @cells[reference.upcase]
      end

      # Get or create cell at reference
      #
      # @param reference [String] Cell reference
      # @return [Cell]
      def cell!(reference)
        ref = reference.upcase
        @cells[ref] ||= Cell.new(reference: ref)
      end

      # Set cell value
      #
      # @param reference [String] Cell reference
      # @param value [Object] Cell value
      # @param type [Symbol] Cell type (auto-detected if nil)
      # @param style_index [Integer, nil] Style index
      # @param formula [String, nil] Formula string (without =)
      def set_cell(reference, value, type: nil, style_index: nil, formula: nil)
        ref = reference.upcase
        # If formula is provided, type is :formula unless explicitly set
        detected_type = type || (formula ? :formula : detect_type(value))

        cell = Cell.new(
          reference: ref,
          value: value,
          type: detected_type,
          style_index: style_index,
          formula: formula
        )

        @cells[ref] = cell
        cache_cell_in_row(cell)
        cell
      end

      # Add a row of values
      #
      # @param values [Array] Array of cell values
      # @param row_number [Integer, nil] Row number (auto-increments if nil)
      # @param style [Symbol, Integer, nil] Style to apply
      # @return [Array<Cell>] Created cells
      def add_row(values, row_number: nil, style: nil)
        row_num = row_number || (max_row + 1)
        style_index = resolve_style(style)

        values.each_with_index.map do |value, col_idx|
          ref = Cell.make_reference(row_num, col_idx)

          if value.is_a?(String) && value.start_with?("=")
            set_cell(ref, nil, formula: value[1..], style_index: style_index)
          else
            set_cell(ref, value, style_index: style_index)
          end
        end
      end

      # Get row by number
      #
      # @param row_number [Integer] 1-based row number
      # @return [Array<Cell>] Cells in the row (sorted by column)
      def row(row_number)
        @rows[row_number]&.sort_by(&:column_index) || []
      end

      # Get all rows
      #
      # @return [Array<Array<Cell>>] All rows with cells
      def rows
        return [] if @rows.empty?

        (min_row..max_row).map { |r| row(r) }
      end

      # Get rows as 2D array of values
      #
      # @return [Array<Array>] Values array
      def to_a
        rows.map { |r| r.map(&:value) }
      end

      # Get column by index
      #
      # @param col_index [Integer] 0-based column index
      # @return [Array<Cell>] Cells in the column
      def column(col_index)
        col_letter = Cell.index_to_column(col_index)
        @cells.values.select { |c| c.column == col_letter }.sort_by(&:row)
      end

      # Get dimensions (used range)
      #
      # @return [String, nil] Range like "A1:D10" or nil if empty
      def dimension
        return nil if @cells.empty?

        min_col = @cells.values.map(&:column_index).min
        max_col = @cells.values.map(&:column_index).max
        "#{Cell.index_to_column(min_col)}#{min_row}:#{Cell.index_to_column(max_col)}#{max_row}"
      end

      # Get minimum row number
      def min_row
        @rows.keys.min || 0
      end

      # Get maximum row number
      def max_row
        @rows.keys.max || 0
      end

      # Get maximum column index
      def max_column
        @cells.values.map(&:column_index).max || -1
      end

      # Set column width
      #
      # @param col_index [Integer] 0-based column index
      # @param width [Float] Width in character units
      def set_column_width(col_index, width)
        @column_widths[col_index] = width
      end

      # Set column widths for multiple columns
      #
      # @param widths [Array<Float>] Widths starting from column A
      def column_widths=(*widths)
        widths.flatten.each_with_index do |w, i|
          @column_widths[i] = w if w
        end
      end

      # Set row height
      #
      # @param row_number [Integer] 1-based row number
      # @param height [Float] Height in points
      def set_row_height(row_number, height)
        @row_heights[row_number] = height
      end

      # Merge cells
      #
      # @param range [String] Range to merge (e.g., "A1:B2")
      def merge_cells(range)
        @merged_cells << range unless @merged_cells.include?(range)
      end

      # Freeze panes
      #
      # @param row [Integer] Number of rows to freeze (from top)
      # @param col [Integer] Number of columns to freeze (from left)
      def freeze_panes(row: 0, col: 0)
        @frozen_panes = { row: row, col: col }
      end

      # Get frozen panes configuration
      #
      # @return [Hash, nil] { row: n, col: n } or nil
      def frozen_panes
        @frozen_panes
      end

      # Set auto-filter range
      #
      # @param range [String] Range for auto-filter (e.g., "A1:D1")
      def auto_filter=(range)
        @auto_filter = range
      end

      # Get auto-filter range
      #
      # @return [String, nil]
      def auto_filter
        @auto_filter
      end

      # Check if sheet is empty
      def empty?
        @cells.empty?
      end

      # Count of cells with data
      def cell_count
        @cells.size
      end

      # Apply style to a range of cells
      #
      # @param range [String] Range like "A1:D1" or "A1"
      # @param style_index [Integer] Style index to apply
      def apply_style(range, style_index)
        if range.include?(":")
          start_ref, end_ref = range.split(":")
          start_row, start_col = Cell.parse_reference(start_ref)
          end_row, end_col = Cell.parse_reference(end_ref)

          (start_row..end_row).each do |row|
            (start_col..end_col).each do |col|
              ref = Cell.make_reference(row, col)
              cell = @cells[ref]
              cell.style_index = style_index if cell
            end
          end
        else
          cell = @cells[range.upcase]
          cell.style_index = style_index if cell
        end
      end

      # Calculate and set auto-width for all columns based on content
      #
      # @param padding [Float] Extra width padding (default 2)
      # @param min_width [Float] Minimum column width (default 8)
      # @param max_width [Float] Maximum column width (default 50)
      def auto_fit_columns(padding: 2, min_width: 8, max_width: 50)
        return if @cells.empty?

        col_widths = {}

        @cells.each_value do |cell|
          col_idx = cell.column_index
          value = cell.value.to_s

          # Estimate width based on character count
          # Excel uses approximately 1 character = 1 width unit
          width = value.length + padding

          col_widths[col_idx] = [
            col_widths[col_idx] || 0,
            width.clamp(min_width, max_width)
          ].max
        end

        col_widths.each do |col_idx, width|
          @column_widths[col_idx] = width
        end
      end

      # Set auto-filter on header row (first row with data)
      def enable_auto_filter
        return if @cells.empty?

        min_col = @cells.values.map(&:column_index).min
        max_col = @cells.values.map(&:column_index).max
        @auto_filter = "#{Cell.index_to_column(min_col)}1:#{Cell.index_to_column(max_col)}1"
      end

      private

      def cache_cell_in_row(cell)
        row_num = cell.row
        @rows[row_num] ||= []
        # Remove existing cell at same position if any
        @rows[row_num].reject! { |c| c.reference == cell.reference }
        @rows[row_num] << cell
      end

      def detect_type(value)
        case value
        when nil then :blank
        when Integer, Float then :number
        when TrueClass, FalseClass then :boolean
        when Date, DateTime, Time then :date
        else :string
        end
      end

      def resolve_style(style)
        case style
        when nil then nil
        when Integer then style
        when Symbol then nil # Will be resolved by workbook
        else nil
        end
      end
    end
  end
end
