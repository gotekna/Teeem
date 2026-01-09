# frozen_string_literal: true

require "rails_helper"
require_relative "../../../lib/teeem_xl/teeem_xl"

RSpec.describe TeeemXl do
  let(:temp_file) { Tempfile.new(["test", ".xlsx"]) }

  after do
    temp_file.close
    temp_file.unlink
  end

  describe "round-trip write and read" do
    it "creates a valid XLSX file that can be read back" do
      # Write
      workbook = TeeemXl::Models::Workbook.new
      sheet = workbook.add_sheet("Test Data")

      sheet.add_row(["Name", "Age", "Active"])
      sheet.add_row(["Alice", 30, true])
      sheet.add_row(["Bob", 25, false])
      sheet.add_row(["Charlie", 35, true])

      TeeemXl.write(workbook, temp_file.path)

      # Read back
      read_workbook = TeeemXl.read(temp_file.path)

      expect(read_workbook.sheets.size).to eq(1)
      expect(read_workbook.sheets.first.name).to eq("Test Data")

      rows = read_workbook.first_sheet.to_a
      expect(rows.size).to eq(4)
      expect(rows[0]).to eq(["Name", "Age", "Active"])
      expect(rows[1]).to eq(["Alice", 30, true])
      expect(rows[2]).to eq(["Bob", 25, false])
      expect(rows[3]).to eq(["Charlie", 35, true])
    end

    it "handles multiple sheets" do
      workbook = TeeemXl::Models::Workbook.new
      sheet1 = workbook.add_sheet("Sheet 1")
      sheet2 = workbook.add_sheet("Sheet 2")

      sheet1.add_row(["Data 1"])
      sheet2.add_row(["Data 2"])

      TeeemXl.write(workbook, temp_file.path)

      read_workbook = TeeemXl.read(temp_file.path)
      expect(read_workbook.sheet_names).to eq(["Sheet 1", "Sheet 2"])
      expect(read_workbook.sheet("Sheet 1").to_a).to eq([["Data 1"]])
      expect(read_workbook.sheet("Sheet 2").to_a).to eq([["Data 2"]])
    end

    it "handles formulas" do
      workbook = TeeemXl::Models::Workbook.new
      sheet = workbook.add_sheet("Formulas")

      sheet.add_row([10, 20, "=A1+B1"])

      TeeemXl.write(workbook, temp_file.path)

      read_workbook = TeeemXl.read(temp_file.path)
      cell = read_workbook.first_sheet.cell("C1")
      expect(cell.formula).to eq("A1+B1")
    end

    it "handles styled cells" do
      workbook = TeeemXl::Models::Workbook.new
      sheet = workbook.add_sheet("Styled")

      # Register styles
      header_style = workbook.styles.add_cell_format(bold: true, background: "4472C4", color: "FFFFFF")
      currency_style = workbook.styles.add_cell_format(number_format: "_($* #,##0.00_)")
      bordered_style = workbook.styles.add_cell_format(border: :thin)

      # Add styled rows
      sheet.add_row(["Product", "Price", "Qty"], style: header_style)
      sheet.set_cell("A2", "Widget", style_index: bordered_style)
      sheet.set_cell("B2", 99.99, style_index: currency_style)
      sheet.set_cell("C2", 10, style_index: bordered_style)

      TeeemXl.write(workbook, temp_file.path)

      # Verify file can be opened (style XML is valid)
      read_workbook = TeeemXl.read(temp_file.path)
      expect(read_workbook.first_sheet.cell("A1").value).to eq("Product")
      expect(read_workbook.first_sheet.cell("B2").value).to eq(99.99)
    end

    it "handles various data types" do
      workbook = TeeemXl::Models::Workbook.new
      sheet = workbook.add_sheet("Types")

      sheet.set_cell("A1", "String", type: :string)
      sheet.set_cell("A2", 42, type: :number)
      sheet.set_cell("A3", 3.14159, type: :number)
      sheet.set_cell("A4", true, type: :boolean)
      sheet.set_cell("A5", false, type: :boolean)

      TeeemXl.write(workbook, temp_file.path)

      read_workbook = TeeemXl.read(temp_file.path)
      sheet = read_workbook.first_sheet

      expect(sheet.cell("A1").value).to eq("String")
      expect(sheet.cell("A1").type).to eq(:string)

      expect(sheet.cell("A2").value).to eq(42)
      expect(sheet.cell("A2").type).to eq(:number)

      expect(sheet.cell("A3").value).to eq(3.14159)

      expect(sheet.cell("A4").value).to eq(true)
      expect(sheet.cell("A4").type).to eq(:boolean)

      expect(sheet.cell("A5").value).to eq(false)
    end

    it "handles date values" do
      workbook = TeeemXl::Models::Workbook.new
      sheet = workbook.add_sheet("Dates")

      test_date = Date.new(2024, 6, 15)
      test_datetime = DateTime.new(2024, 6, 15, 14, 30, 0)

      sheet.set_cell("A1", test_date, type: :date)
      sheet.set_cell("A2", test_datetime, type: :date)

      TeeemXl.write(workbook, temp_file.path)

      read_workbook = TeeemXl.read(temp_file.path)
      sheet = read_workbook.first_sheet

      # Date should round-trip
      expect(sheet.cell("A1").value).to be_a(Date).or be_a(Time).or be_a(DateTime)
      expect(sheet.cell("A1").value.to_date).to eq(test_date)
      expect(sheet.cell("A1").type).to eq(:date)

      # DateTime should round-trip (approximately - time zones)
      expect(sheet.cell("A2").value).to be_a(Date).or be_a(Time).or be_a(DateTime)
      expect(sheet.cell("A2").type).to eq(:date)
    end

    it "handles empty cells and sparse data" do
      workbook = TeeemXl::Models::Workbook.new
      sheet = workbook.add_sheet("Sparse")

      sheet.set_cell("A1", "Top Left")
      sheet.set_cell("E5", "Bottom Right")

      TeeemXl.write(workbook, temp_file.path)

      read_workbook = TeeemXl.read(temp_file.path)
      sheet = read_workbook.first_sheet

      expect(sheet.cell("A1").value).to eq("Top Left")
      expect(sheet.cell("E5").value).to eq("Bottom Right")
      expect(sheet.cell("C3")).to be_nil
    end
  end

  describe TeeemXl::Models::Cell do
    describe ".column_to_index" do
      it "converts single letters" do
        expect(described_class.column_to_index("A")).to eq(0)
        expect(described_class.column_to_index("B")).to eq(1)
        expect(described_class.column_to_index("Z")).to eq(25)
      end

      it "converts double letters" do
        expect(described_class.column_to_index("AA")).to eq(26)
        expect(described_class.column_to_index("AB")).to eq(27)
        expect(described_class.column_to_index("AZ")).to eq(51)
        expect(described_class.column_to_index("BA")).to eq(52)
      end

      it "handles maximum column" do
        expect(described_class.column_to_index("XFD")).to eq(16383)
      end
    end

    describe ".index_to_column" do
      it "converts indices to letters" do
        expect(described_class.index_to_column(0)).to eq("A")
        expect(described_class.index_to_column(25)).to eq("Z")
        expect(described_class.index_to_column(26)).to eq("AA")
        expect(described_class.index_to_column(27)).to eq("AB")
        expect(described_class.index_to_column(16383)).to eq("XFD")
      end

      it "round-trips with column_to_index" do
        (0..100).each do |i|
          col = described_class.index_to_column(i)
          expect(described_class.column_to_index(col)).to eq(i)
        end
      end
    end

    describe ".parse_reference" do
      it "parses cell references" do
        expect(described_class.parse_reference("A1")).to eq([1, 0])
        expect(described_class.parse_reference("B2")).to eq([2, 1])
        expect(described_class.parse_reference("AA100")).to eq([100, 26])
      end
    end
  end

  describe TeeemXl::Models::Worksheet do
    let(:sheet) { described_class.new(name: "Test") }

    describe "#add_row" do
      it "adds rows sequentially" do
        sheet.add_row(["A", "B", "C"])
        sheet.add_row([1, 2, 3])

        expect(sheet.row(1).map(&:value)).to eq(["A", "B", "C"])
        expect(sheet.row(2).map(&:value)).to eq([1, 2, 3])
      end

      it "handles explicit row numbers" do
        sheet.add_row(["First"], row_number: 5)
        expect(sheet.row(5).map(&:value)).to eq(["First"])
      end
    end

    describe "#dimension" do
      it "returns the used range" do
        sheet.set_cell("B2", "Hello")
        sheet.set_cell("D4", "World")

        expect(sheet.dimension).to eq("B2:D4")
      end

      it "returns nil for empty sheet" do
        expect(sheet.dimension).to be_nil
      end
    end

    describe "#merge_cells" do
      it "stores merged cell ranges" do
        sheet.merge_cells("A1:B2")
        sheet.merge_cells("C3:D4")

        expect(sheet.merged_cells).to eq(["A1:B2", "C3:D4"])
      end
    end

    describe "#freeze_panes" do
      it "stores frozen pane configuration" do
        sheet.freeze_panes(row: 1, col: 2)

        expect(sheet.frozen_panes).to eq({ row: 1, col: 2 })
      end
    end

    describe "#apply_style" do
      it "applies style to single cell" do
        sheet.set_cell("A1", "Test")
        sheet.apply_style("A1", 1)

        expect(sheet.cell("A1").style_index).to eq(1)
      end

      it "applies style to range" do
        sheet.add_row(["A", "B", "C"])
        sheet.add_row([1, 2, 3])
        sheet.apply_style("A1:C1", 2)

        expect(sheet.cell("A1").style_index).to eq(2)
        expect(sheet.cell("B1").style_index).to eq(2)
        expect(sheet.cell("C1").style_index).to eq(2)
        expect(sheet.cell("A2").style_index).to be_nil
      end
    end

    describe "#auto_fit_columns" do
      it "calculates column widths from content" do
        sheet.add_row(["Short", "A much longer string here"])
        sheet.auto_fit_columns

        expect(sheet.column_widths[0]).to be_between(8, 50)
        expect(sheet.column_widths[1]).to be > sheet.column_widths[0]
      end
    end

    describe "#enable_auto_filter" do
      it "sets auto-filter range based on data" do
        sheet.add_row(["A", "B", "C"])
        sheet.add_row([1, 2, 3])
        sheet.enable_auto_filter

        expect(sheet.auto_filter).to eq("A1:C1")
      end
    end
  end

  describe TeeemXl::Models::Style do
    describe "predefined styles" do
      it "provides header style" do
        style = described_class.header
        expect(style.bold).to be true
        expect(style.background_color).to eq("4472C4")
        expect(style.font_color).to eq("FFFFFF")
      end

      it "provides bordered style" do
        style = described_class.bordered
        expect(style.border).to eq(:thin)
      end

      it "provides error/warning/success styles" do
        error = described_class.error
        expect(error.background_color).to eq("FFC7CE")

        warning = described_class.warning
        expect(warning.background_color).to eq("FFEB9C")

        success = described_class.success
        expect(success.background_color).to eq("C6EFCE")
      end

      it "provides currency and accounting styles" do
        currency = described_class.currency
        expect(currency.number_format).to include("$")

        accounting = described_class.accounting
        expect(accounting.number_format).to include("$")
      end
    end

    describe "#to_options" do
      it "converts style to options hash" do
        style = TeeemXl::Models::Style.new(
          bold: true,
          background: "FF0000",
          align: :center,
          number_format: "0.00%"
        )

        options = style.to_options
        expect(options[:bold]).to be true
        expect(options[:background]).to eq("FF0000")
        expect(options[:align]).to eq(:center)
        expect(options[:number_format]).to eq("0.00%")
      end
    end
  end

  describe TeeemXl::Models::Styles do
    let(:styles) { described_class.new }

    describe "#add_cell_format" do
      it "creates format with border" do
        index = styles.add_cell_format(border: :thin)
        expect(index).to be > 0
        expect(styles.borders.size).to be > 1
      end

      it "creates format with background color" do
        index = styles.add_cell_format(background: "FF0000")
        expect(index).to be > 0
        expect(styles.fills.size).to be > 2
      end

      it "creates format with font options" do
        index = styles.add_cell_format(bold: true, color: "0000FF")
        expect(index).to be > 0
        expect(styles.fonts.size).to be > 1
      end

      it "creates format with alignment" do
        index = styles.add_cell_format(align: :center, vertical: :top, wrap: true)
        expect(index).to be > 0
        format = styles.cell_formats[index]
        expect(format[:alignment]).to include(horizontal: :center, vertical: :top, wrap_text: true)
      end

      it "supports medium border" do
        index = styles.add_cell_format(border: :medium)
        expect(index).to be > 0
        border = styles.borders.last
        expect(border[:left]).to eq(:medium)
      end

      it "supports border with color" do
        index = styles.add_cell_format(border: :thin, border_color: "FF0000")
        expect(index).to be > 0
        border = styles.borders.last
        expect(border[:color]).to eq("FF0000")
      end

      it "deduplicates identical formats" do
        index1 = styles.add_cell_format(bold: true)
        index2 = styles.add_cell_format(bold: true)
        expect(index1).to eq(index2)
      end
    end

    describe "#register" do
      it "registers named styles" do
        index = styles.register(:header, bold: true, background: "4472C4")
        expect(styles.index_for(:header)).to eq(index)
      end
    end
  end

  describe TeeemXl::ContentTypes do
    let(:xml) do
      <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        </Types>
      XML
    end

    it "parses content types" do
      ct = described_class.parse(xml)

      expect(ct.defaults["rels"]).to eq("application/vnd.openxmlformats-package.relationships+xml")
      expect(ct.defaults["xml"]).to eq("application/xml")
      expect(ct.content_type_for("xl/workbook.xml")).to eq("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml")
    end

    it "falls back to extension-based type" do
      ct = described_class.parse(xml)
      expect(ct.content_type_for("xl/worksheets/sheet1.xml")).to eq("application/xml")
    end
  end

  describe TeeemXl::Relationships do
    let(:xml) do
      <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
          <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
        </Relationships>
      XML
    end

    it "parses relationships" do
      rels = described_class.parse(xml, base_path: "xl")

      expect(rels.target_for("rId1")).to eq("xl/worksheets/sheet1.xml")
      expect(rels.target_for("rId2")).to eq("xl/sharedStrings.xml")
    end

    it "finds targets by type" do
      rels = described_class.parse(xml, base_path: "xl")
      worksheet_type = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"

      targets = rels.targets_for_type(worksheet_type)
      expect(targets).to eq(["xl/worksheets/sheet1.xml"])
    end
  end
end
