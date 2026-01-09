# frozen_string_literal: true

module TeeemXl
  module Models
    # Style represents cell formatting options.
    #
    # This is a convenience class for building style definitions.
    # The actual style storage is managed by the Styles class in Workbook.
    #
    # Usage:
    #   style = Style.new(bold: true, background: "#FF0000")
    #   sheet.add_row(values, style: style)
    #
    class Style
      attr_accessor :font_name, :font_size, :font_color
      attr_accessor :bold, :italic, :underline, :strikethrough
      attr_accessor :background_color
      attr_accessor :border, :border_color
      attr_accessor :horizontal_align, :vertical_align, :wrap_text
      attr_accessor :number_format

      def initialize(**options)
        @font_name = options[:font_name] || options[:font]
        @font_size = options[:font_size] || options[:size]
        @font_color = normalize_color(options[:font_color] || options[:color])
        @bold = options[:bold] || false
        @italic = options[:italic] || false
        @underline = options[:underline] || false
        @strikethrough = options[:strikethrough] || false
        @background_color = normalize_color(options[:background_color] || options[:background] || options[:bg_color])
        @border = options[:border]
        @border_color = normalize_color(options[:border_color])
        @horizontal_align = options[:horizontal_align] || options[:align]
        @vertical_align = options[:vertical_align] || options[:valign]
        @wrap_text = options[:wrap_text] || options[:wrap] || false
        @number_format = options[:number_format] || options[:format]
      end

      # Convert to options hash for Styles.add_cell_format
      def to_options
        {
          font_name: @font_name,
          font_size: @font_size,
          color: @font_color,
          bold: @bold,
          italic: @italic,
          underline: @underline,
          background: @background_color,
          border: @border,
          align: @horizontal_align,
          vertical: @vertical_align,
          wrap: @wrap_text,
          number_format: @number_format
        }.compact
      end

      # Predefined styles
      class << self
        def header
          new(bold: true, background: "4472C4", color: "FFFFFF")
        end

        def header_bordered
          new(bold: true, background: "4472C4", color: "FFFFFF", border: :thin)
        end

        def currency
          new(number_format: '_("$"* #,##0.00_)')
        end

        def accounting
          new(number_format: '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)')
        end

        def percentage
          new(number_format: "0.00%")
        end

        def date
          new(number_format: "yyyy-mm-dd")
        end

        def datetime
          new(number_format: "yyyy-mm-dd hh:mm:ss")
        end

        def time
          new(number_format: "hh:mm:ss")
        end

        def wrapped
          new(wrap: true)
        end

        def centered
          new(align: :center, valign: :center)
        end

        def bordered
          new(border: :thin)
        end

        def bordered_medium
          new(border: :medium)
        end

        def total_row
          new(bold: true, border: { top: :double, bottom: :thin })
        end

        def error
          new(background: "FFC7CE", color: "9C0006")
        end

        def warning
          new(background: "FFEB9C", color: "9C5700")
        end

        def success
          new(background: "C6EFCE", color: "006100")
        end

        def neutral
          new(background: "FFFFCC")
        end

        def hyperlink
          new(color: "0563C1", underline: true)
        end

        def code
          new(font_name: "Consolas", font_size: 10)
        end
      end

      private

      def normalize_color(color)
        return nil unless color

        color.to_s.delete_prefix("#").upcase
      end
    end
  end
end
