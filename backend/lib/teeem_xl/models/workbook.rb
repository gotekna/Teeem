# frozen_string_literal: true

module TeeemXL
  module Models
    # Workbook represents an Excel workbook (the top-level container).
    #
    # Contains:
    # - Sheets: Collection of worksheets
    # - Shared strings: Deduplicated string table
    # - Styles: Cell formatting definitions
    # - Named ranges: Workbook-level named ranges
    #
    class Workbook
      attr_reader :sheets, :shared_strings, :styles, :named_ranges

      def initialize
        @sheets = []
        @shared_strings = SharedStrings.new
        @styles = Styles.new
        @named_ranges = {}
      end

      # Add a new worksheet
      #
      # @param name [String] Sheet name
      # @return [Worksheet] The created worksheet
      def add_sheet(name)
        sheet_id = @sheets.size + 1
        sheet = Worksheet.new(name: name, sheet_id: sheet_id)
        @sheets << sheet
        sheet
      end

      # Get worksheet by name
      #
      # @param name [String] Sheet name
      # @return [Worksheet, nil]
      def sheet(name)
        @sheets.find { |s| s.name == name }
      end

      # Get worksheet by index (0-based)
      #
      # @param index [Integer] Sheet index
      # @return [Worksheet, nil]
      def sheet_at(index)
        @sheets[index]
      end

      # Get first worksheet
      #
      # @return [Worksheet, nil]
      def first_sheet
        @sheets.first
      end

      # Get sheet names
      #
      # @return [Array<String>]
      def sheet_names
        @sheets.map(&:name)
      end

      # Remove worksheet by name
      #
      # @param name [String] Sheet name
      def remove_sheet(name)
        @sheets.reject! { |s| s.name == name }
      end

      # Define a named range
      #
      # @param name [String] Range name
      # @param reference [String] Reference (e.g., "Sheet1!$A$1:$B$10")
      def define_name(name, reference)
        @named_ranges[name] = reference
      end

      # Get named range reference
      #
      # @param name [String] Range name
      # @return [String, nil]
      def named_range(name)
        @named_ranges[name]
      end

      # Register a named style
      #
      # @param name [Symbol] Style name
      # @param options [Hash] Style options
      def register_style(name, **options)
        @styles.register(name, **options)
      end

      # Write workbook to file or IO
      #
      # @param destination [String, IO, Pathname] Output path or IO
      def write(destination)
        TeeemXL.write(self, destination)
      end

      # Check if workbook has any data
      def empty?
        @sheets.empty? || @sheets.all?(&:empty?)
      end

      # Total cell count across all sheets
      def cell_count
        @sheets.sum(&:cell_count)
      end
    end

    # SharedStrings manages the deduplicated string table.
    #
    # Excel stores unique strings once in sharedStrings.xml and
    # references them by index in worksheets. This reduces file size
    # and improves performance.
    #
    class SharedStrings
      attr_reader :strings

      def initialize
        @strings = []
        @index_map = {}  # string => index
      end

      # Get or add a string, returning its index
      #
      # @param str [String] String to add
      # @return [Integer] Index in shared strings table
      def add(str)
        return @index_map[str] if @index_map.key?(str)

        index = @strings.size
        @strings << str
        @index_map[str] = index
        index
      end

      # Get string at index
      #
      # @param index [Integer] String index
      # @return [String, nil]
      def [](index)
        @strings[index]
      end

      # Get index for string
      #
      # @param str [String] String to find
      # @return [Integer, nil]
      def index_of(str)
        @index_map[str]
      end

      # Total count
      def count
        @strings.size
      end

      # Unique count (same as count for our implementation)
      def unique_count
        @strings.size
      end

      def empty?
        @strings.empty?
      end
    end

    # Styles manages cell formatting definitions.
    #
    # Excel uses a complex multi-level style system:
    # - numFmts: Number format codes
    # - fonts: Font definitions
    # - fills: Fill patterns and colors
    # - borders: Border definitions
    # - cellXfs: Combined cell formats (what cells reference)
    # - cellStyles: Named styles
    #
    class Styles
      attr_reader :fonts, :fills, :borders, :number_formats, :cell_formats
      attr_reader :named_styles

      def initialize
        @fonts = [default_font]
        @fills = [none_fill, gray_fill]  # Excel requires these two
        @borders = [no_border]
        @number_formats = {}  # id => format_code
        @cell_formats = [default_cell_format]  # cellXfs
        @named_styles = {}   # name => format_index
      end

      # Register a named style
      #
      # @param name [Symbol] Style name
      # @param options [Hash] Style options
      # @return [Integer] Style index
      def register(name, **options)
        format_index = add_cell_format(**options)
        @named_styles[name] = format_index
        format_index
      end

      # Get style index by name
      #
      # @param name [Symbol] Style name
      # @return [Integer, nil]
      def index_for(name)
        @named_styles[name]
      end

      # Add a cell format and return its index
      #
      # @param options [Hash] Format options
      # @return [Integer] Format index
      def add_cell_format(**options)
        font_id = find_or_add_font(options)
        fill_id = find_or_add_fill(options)
        border_id = find_or_add_border(options)
        num_fmt_id = find_or_add_number_format(options)

        format = {
          font_id: font_id,
          fill_id: fill_id,
          border_id: border_id,
          num_fmt_id: num_fmt_id,
          apply_font: font_id > 0,
          apply_fill: fill_id > 0,
          apply_border: border_id > 0,
          apply_number_format: !num_fmt_id.nil?,
          alignment: extract_alignment(options)
        }

        # Check if format already exists
        existing_idx = @cell_formats.index(format)
        return existing_idx if existing_idx

        @cell_formats << format
        @cell_formats.size - 1
      end

      private

      def default_font
        { name: "Calibri", size: 11, color: "000000" }
      end

      def none_fill
        { pattern: "none" }
      end

      def gray_fill
        { pattern: "gray125" }
      end

      def no_border
        { left: nil, right: nil, top: nil, bottom: nil }
      end

      def default_cell_format
        { font_id: 0, fill_id: 0, border_id: 0, num_fmt_id: nil }
      end

      def find_or_add_font(options)
        return 0 unless options[:bold] || options[:italic] || options[:underline] ||
                        options[:font_size] || options[:font_name] || options[:color]

        font = {
          name: options[:font_name] || "Calibri",
          size: options[:font_size] || 11,
          color: normalize_color(options[:color]) || "000000",
          bold: options[:bold],
          italic: options[:italic],
          underline: options[:underline]
        }

        existing_idx = @fonts.index(font)
        return existing_idx if existing_idx

        @fonts << font
        @fonts.size - 1
      end

      def find_or_add_fill(options)
        return 0 unless options[:background] || options[:bg_color]

        color = normalize_color(options[:background] || options[:bg_color])
        return 0 unless color

        fill = { pattern: "solid", fg_color: color }

        existing_idx = @fills.index(fill)
        return existing_idx if existing_idx

        @fills << fill
        @fills.size - 1
      end

      def find_or_add_border(options)
        return 0 unless options[:border]

        border = case options[:border]
                 when true, :thin
                   { left: :thin, right: :thin, top: :thin, bottom: :thin }
                 when Hash
                   options[:border]
                 else
                   { left: options[:border], right: options[:border],
                     top: options[:border], bottom: options[:border] }
                 end

        existing_idx = @borders.index(border)
        return existing_idx if existing_idx

        @borders << border
        @borders.size - 1
      end

      def find_or_add_number_format(options)
        return nil unless options[:number_format]

        code = options[:number_format]

        # Check built-in formats
        builtin_id = BUILTIN_NUMBER_FORMATS.key(code)
        return builtin_id if builtin_id

        # Check existing custom formats
        existing_id = @number_formats.key(code)
        return existing_id if existing_id

        # Add new custom format (starting at 164)
        new_id = @number_formats.empty? ? 164 : @number_formats.keys.max + 1
        @number_formats[new_id] = code
        new_id
      end

      def extract_alignment(options)
        return nil unless options[:align] || options[:vertical] || options[:wrap]

        {
          horizontal: options[:align],
          vertical: options[:vertical],
          wrap_text: options[:wrap]
        }
      end

      def normalize_color(color)
        return nil unless color

        # Remove # prefix and ensure uppercase
        color.to_s.delete_prefix("#").upcase
      end

      # Built-in number formats (Excel standard)
      BUILTIN_NUMBER_FORMATS = {
        0 => "General",
        1 => "0",
        2 => "0.00",
        3 => "#,##0",
        4 => "#,##0.00",
        9 => "0%",
        10 => "0.00%",
        11 => "0.00E+00",
        14 => "m/d/yyyy",
        15 => "d-mmm-yy",
        16 => "d-mmm",
        17 => "mmm-yy",
        18 => "h:mm AM/PM",
        19 => "h:mm:ss AM/PM",
        20 => "h:mm",
        21 => "h:mm:ss",
        22 => "m/d/yyyy h:mm",
        37 => "#,##0_);(#,##0)",
        38 => "#,##0_);[Red](#,##0)",
        39 => "#,##0.00_);(#,##0.00)",
        40 => "#,##0.00_);[Red](#,##0.00)",
        44 => '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)',
        45 => "mm:ss",
        46 => "[h]:mm:ss",
        47 => "mm:ss.0",
        48 => "##0.0E+0",
        49 => "@"
      }.freeze
    end
  end
end
