# frozen_string_literal: true

require "rails_helper"
require_relative "../../../lib/teeem_xl/teeem_xl"

RSpec.describe TeeemXL do
  let(:temp_file) { Tempfile.new(["test", ".xlsx"]) }

  after do
    temp_file.close
    temp_file.unlink
  end

  describe "round-trip write and read" do
    it "creates a valid XLSX file that can be read back" do
      # Write
      workbook = TeeemXL::Models::Workbook.new
      sheet = workbook.add_sheet("Test Data")

      sheet.add_row(["Name", "Age", "Active"])
      sheet.add_row(["Alice", 30, true])
      sheet.add_row(["Bob", 25, false])
      sheet.add_row(["Charlie", 35, true])

      TeeemXL.write(workbook, temp_file.path)

      # Read back
      read_workbook = TeeemXL.read(temp_file.path)

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
      workbook = TeeemXL::Models::Workbook.new
      sheet1 = workbook.add_sheet("Sheet 1")
      sheet2 = workbook.add_sheet("Sheet 2")

      sheet1.add_row(["Data 1"])
      sheet2.add_row(["Data 2"])

      TeeemXL.write(workbook, temp_file.path)

      read_workbook = TeeemXL.read(temp_file.path)
      expect(read_workbook.sheet_names).to eq(["Sheet 1", "Sheet 2"])
      expect(read_workbook.sheet("Sheet 1").to_a).to eq([["Data 1"]])
      expect(read_workbook.sheet("Sheet 2").to_a).to eq([["Data 2"]])
    end

    it "handles formulas" do
      workbook = TeeemXL::Models::Workbook.new
      sheet = workbook.add_sheet("Formulas")

      sheet.add_row([10, 20, "=A1+B1"])

      TeeemXL.write(workbook, temp_file.path)

      read_workbook = TeeemXL.read(temp_file.path)
      cell = read_workbook.first_sheet.cell("C1")
      expect(cell.formula).to eq("A1+B1")
    end

    it "handles various data types" do
      workbook = TeeemXL::Models::Workbook.new
      sheet = workbook.add_sheet("Types")

      sheet.set_cell("A1", "String", type: :string)
      sheet.set_cell("A2", 42, type: :number)
      sheet.set_cell("A3", 3.14159, type: :number)
      sheet.set_cell("A4", true, type: :boolean)
      sheet.set_cell("A5", false, type: :boolean)

      TeeemXL.write(workbook, temp_file.path)

      read_workbook = TeeemXL.read(temp_file.path)
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

    it "handles empty cells and sparse data" do
      workbook = TeeemXL::Models::Workbook.new
      sheet = workbook.add_sheet("Sparse")

      sheet.set_cell("A1", "Top Left")
      sheet.set_cell("E5", "Bottom Right")

      TeeemXL.write(workbook, temp_file.path)

      read_workbook = TeeemXL.read(temp_file.path)
      sheet = read_workbook.first_sheet

      expect(sheet.cell("A1").value).to eq("Top Left")
      expect(sheet.cell("E5").value).to eq("Bottom Right")
      expect(sheet.cell("C3")).to be_nil
    end
  end

  describe TeeemXL::Models::Cell do
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

  describe TeeemXL::Models::Worksheet do
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
  end

  describe TeeemXL::ContentTypes do
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

  describe TeeemXL::Relationships do
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
