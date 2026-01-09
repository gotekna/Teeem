# frozen_string_literal: true

module TeeemXl
  module Writer
    # StylesWriter generates xl/styles.xml
    #
    # Output structure:
    #   <styleSheet xmlns="...">
    #     <numFmts>...</numFmts>
    #     <fonts>...</fonts>
    #     <fills>...</fills>
    #     <borders>...</borders>
    #     <cellStyleXfs>...</cellStyleXfs>
    #     <cellXfs>...</cellXfs>
    #     <cellStyles>...</cellStyles>
    #   </styleSheet>
    #
    class StylesWriter
      NS = TeeemXl::NAMESPACES[:spreadsheet]

      def initialize(styles)
        @styles = styles
      end

      # Generate XML content
      #
      # @return [String] XML content
      def to_xml
        builder = Nokogiri::XML::Builder.new(encoding: "UTF-8") do |xml|
          xml.styleSheet(xmlns: NS) do
            write_number_formats(xml)
            write_fonts(xml)
            write_fills(xml)
            write_borders(xml)
            write_cell_style_xfs(xml)
            write_cell_xfs(xml)
            write_cell_styles(xml)
          end
        end

        builder.to_xml
      end

      private

      def write_number_formats(xml)
        return if @styles.number_formats.empty?

        xml.numFmts(count: @styles.number_formats.size) do
          @styles.number_formats.each do |id, code|
            xml.numFmt(numFmtId: id, formatCode: code)
          end
        end
      end

      def write_fonts(xml)
        xml.fonts(count: @styles.fonts.size) do
          @styles.fonts.each do |font|
            xml.font do
              xml.b if font[:bold]
              xml.i if font[:italic]
              xml.u if font[:underline]
              xml.sz(val: font[:size] || 11)
              xml.color(rgb: "FF#{font[:color] || '000000'}")
              xml.name(val: font[:name] || "Calibri")
              xml.family(val: 2)
              xml.scheme(val: "minor")
            end
          end
        end
      end

      def write_fills(xml)
        xml.fills(count: @styles.fills.size) do
          @styles.fills.each do |fill|
            xml.fill do
              if fill[:pattern] == "none"
                xml.patternFill(patternType: "none")
              elsif fill[:pattern] == "gray125"
                xml.patternFill(patternType: "gray125")
              elsif fill[:fg_color]
                xml.patternFill(patternType: "solid") do
                  xml.fgColor(rgb: "FF#{fill[:fg_color]}")
                  xml.bgColor(indexed: 64)
                end
              else
                xml.patternFill(patternType: fill[:pattern] || "none")
              end
            end
          end
        end
      end

      def write_borders(xml)
        xml.borders(count: @styles.borders.size) do
          @styles.borders.each do |border|
            xml.border do
              [:left, :right, :top, :bottom].each do |side|
                style = border[side]
                if style
                  xml.send(side, style: style.to_s) do
                    if border[:color]
                      xml.color(rgb: "FF#{border[:color]}")
                    else
                      xml.color(auto: 1)
                    end
                  end
                else
                  xml.send(side)
                end
              end
              xml.diagonal
            end
          end
        end
      end

      def write_cell_style_xfs(xml)
        # Base style (required)
        xml.cellStyleXfs(count: 1) do
          xml.xf(numFmtId: 0, fontId: 0, fillId: 0, borderId: 0)
        end
      end

      def write_cell_xfs(xml)
        xml.cellXfs(count: @styles.cell_formats.size) do
          @styles.cell_formats.each do |format|
            attrs = {
              numFmtId: format[:num_fmt_id] || 0,
              fontId: format[:font_id] || 0,
              fillId: format[:fill_id] || 0,
              borderId: format[:border_id] || 0,
              xfId: 0
            }

            attrs[:applyFont] = 1 if format[:apply_font]
            attrs[:applyFill] = 1 if format[:apply_fill]
            attrs[:applyBorder] = 1 if format[:apply_border]
            attrs[:applyNumberFormat] = 1 if format[:apply_number_format]

            alignment = format[:alignment]
            if alignment
              attrs[:applyAlignment] = 1
              xml.xf(attrs) do
                align_attrs = {}
                align_attrs[:horizontal] = alignment[:horizontal] if alignment[:horizontal]
                align_attrs[:vertical] = alignment[:vertical] if alignment[:vertical]
                align_attrs[:wrapText] = 1 if alignment[:wrap_text]
                xml.alignment(align_attrs) unless align_attrs.empty?
              end
            else
              xml.xf(attrs)
            end
          end
        end
      end

      def write_cell_styles(xml)
        xml.cellStyles(count: 1) do
          xml.cellStyle(name: "Normal", xfId: 0, builtinId: 0)
        end
      end
    end
  end
end
