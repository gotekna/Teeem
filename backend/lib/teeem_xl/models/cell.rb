# frozen_string_literal: true

module TeeemXl
  module Models
    # Cell represents a single cell in a worksheet.
    #
    # Cells contain:
    # - Reference: Cell address (e.g., "A1", "B2")
    # - Value: The cell's value (typed: string, number, boolean, date, etc.)
    # - Type: The cell's data type
    # - Style: Reference to a style definition
    # - Formula: Optional formula string
    # - Cached value: Formula result (for display without recalculating)
    #
    class Cell
      attr_accessor :reference, :value, :type, :style_index, :formula, :cached_value

      # Cell types
      TYPES = %i[string number boolean date error formula inline_string blank].freeze

      def initialize(reference:, value: nil, type: :string, style_index: nil, formula: nil)
        @reference = reference
        @value = value
        @type = type
        @style_index = style_index
        @formula = formula
        @cached_value = nil
      end

      # Get column letter(s) from reference
      #
      # @return [String] Column letter (e.g., "A", "AA")
      def column
        @reference.gsub(/\d+/, "")
      end

      # Get row number from reference
      #
      # @return [Integer] 1-based row number
      def row
        @reference.gsub(/[A-Z]+/i, "").to_i
      end

      # Get column index (0-based)
      #
      # @return [Integer]
      def column_index
        self.class.column_to_index(column)
      end

      # Check if cell has a formula
      #
      # @return [Boolean]
      def formula?
        !@formula.nil? && !@formula.empty?
      end

      # Check if cell is blank/empty
      #
      # @return [Boolean]
      def blank?
        @type == :blank || (@value.nil? && !formula?)
      end

      # Get display value (formula result or value)
      #
      # @return [Object] Value for display
      def display_value
        @cached_value || @value
      end

      # Convert column letter to 0-based index
      #
      # @param col [String] Column letter(s) (e.g., "A", "AA", "XFD")
      # @return [Integer] 0-based column index
      def self.column_to_index(col)
        col.upcase.chars.reduce(0) do |acc, char|
          acc * 26 + (char.ord - "A".ord + 1)
        end - 1
      end

      # Convert 0-based index to column letter
      #
      # @param index [Integer] 0-based column index
      # @return [String] Column letter(s)
      def self.index_to_column(index)
        result = ""
        index += 1 # Convert to 1-based
        while index > 0
          index -= 1
          result = ((index % 26) + "A".ord).chr + result
          index /= 26
        end
        result
      end

      # Create cell reference from row and column indices
      #
      # @param row [Integer] 1-based row number
      # @param col [Integer] 0-based column index
      # @return [String] Cell reference (e.g., "A1")
      def self.make_reference(row, col)
        "#{index_to_column(col)}#{row}"
      end

      # Parse cell reference into row and column indices
      #
      # @param ref [String] Cell reference (e.g., "A1")
      # @return [Array<Integer>] [row (1-based), column (0-based)]
      def self.parse_reference(ref)
        match = ref.match(/^([A-Z]+)(\d+)$/i)
        raise ArgumentError, "Invalid cell reference: #{ref}" unless match

        col = column_to_index(match[1])
        row = match[2].to_i
        [row, col]
      end

      def to_s
        if formula?
          "#{@reference}: =#{@formula} (#{display_value})"
        else
          "#{@reference}: #{@value}"
        end
      end

      def inspect
        "#<TeeemXl::Cell #{@reference} type=#{@type} value=#{@value.inspect}>"
      end
    end
  end
end
