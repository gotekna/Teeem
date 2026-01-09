# frozen_string_literal: true

# TeeemXl - Custom Excel Reader/Writer
#
# A production-grade, dependency-free Excel library for reading and writing
# XLSX files. Built specifically for Teeem to eliminate third-party Excel
# dependencies while providing full control over Excel file handling.
#
# Usage:
#   # Reading
#   workbook = TeeemXl.read("file.xlsx")
#   workbook.sheets.each do |sheet|
#     sheet.rows.each { |row| puts row.cells.map(&:value).join(", ") }
#   end
#
#   # Writing
#   workbook = TeeemXl::Workbook.new
#   sheet = workbook.add_sheet("Data")
#   sheet.add_row(["Name", "Value"], style: :header)
#   sheet.add_row(["Item 1", 100])
#   workbook.write("output.xlsx")
#
# Architecture:
#   XLSX files are ZIP archives containing XML files following the
#   Office Open XML (OOXML) specification (ECMA-376).
#
#   Key components:
#   - Package: ZIP archive handling and part access
#   - ContentTypes: Catalogs all parts in the archive
#   - Relationships: Maps rId references to actual file paths
#   - SharedStrings: Deduplicated string table
#   - Styles: Cell formatting definitions
#   - Worksheets: Actual cell data
#
module TeeemXl
  class Error < StandardError; end
  class InvalidFileError < Error; end
  class CorruptedFileError < Error; end
  class UnsupportedFeatureError < Error; end

  # OOXML namespace constants
  NAMESPACES = {
    spreadsheet: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    relationships: "http://schemas.openxmlformats.org/package/2006/relationships",
    content_types: "http://schemas.openxmlformats.org/package/2006/content-types",
    office_document: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    drawing: "http://schemas.openxmlformats.org/drawingml/2006/main",
    chart: "http://schemas.openxmlformats.org/drawingml/2006/chart",
    spreadsheet_drawing: "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
  }.freeze

  # Relationship types
  RELATIONSHIP_TYPES = {
    worksheet: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
    shared_strings: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings",
    styles: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles",
    theme: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
    chart: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart",
    drawing: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing",
    pivot_table: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotTable",
    pivot_cache: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition"
  }.freeze

  # Content types
  CONTENT_TYPES = {
    workbook: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
    worksheet: "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml",
    shared_strings: "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml",
    styles: "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml",
    theme: "application/vnd.openxmlformats-officedocument.theme+xml",
    relationships: "application/vnd.openxmlformats-package.relationships+xml"
  }.freeze

  # Cell types in OOXML
  CELL_TYPES = {
    "s" => :string,      # Shared string index
    "n" => :number,      # Number (default if no type)
    "b" => :boolean,     # Boolean (0/1)
    "d" => :date,        # Date (ISO 8601)
    "e" => :error,       # Error value
    "str" => :formula,   # Formula result as string
    "inlineStr" => :inline_string  # Inline string (not shared)
  }.freeze

  class << self
    # Read an Excel file from path or IO
    #
    # @param source [String, IO, Pathname] File path or IO object
    # @return [TeeemXl::Workbook] Parsed workbook
    # @raise [InvalidFileError] If file is not a valid XLSX
    # @raise [CorruptedFileError] If file structure is corrupted
    def read(source)
      package = Package.new(source)
      Reader::WorkbookReader.new(package).read
    end

    # Read an Excel file with streaming (for large files)
    # Yields rows one at a time without loading entire file
    #
    # @param source [String, IO, Pathname] File path or IO object
    # @yield [sheet_name, row_number, row] Each row as it's parsed
    # @yieldparam sheet_name [String] Name of current sheet
    # @yieldparam row_number [Integer] 1-based row number
    # @yieldparam row [Array<TeeemXl::Cell>] Row cells
    def stream_read(source, &block)
      package = Package.new(source)
      Reader::WorkbookReader.new(package).stream_read(&block)
    end

    # Create a new workbook for writing
    #
    # @return [TeeemXl::Workbook] New empty workbook
    def new_workbook
      Models::Workbook.new
    end

    # Write a workbook to file
    #
    # @param workbook [TeeemXl::Workbook] Workbook to write
    # @param destination [String, IO, Pathname] Output path or IO
    def write(workbook, destination)
      Writer::WorkbookWriter.new(workbook).write(destination)
    end
  end
end

# Require all components
require_relative "package"
require_relative "content_types"
require_relative "relationships"

# Models
require_relative "models/workbook"
require_relative "models/worksheet"
require_relative "models/cell"
require_relative "models/style"

# Readers
require_relative "reader/workbook_reader"
require_relative "reader/worksheet_reader"
require_relative "reader/shared_strings_reader"
require_relative "reader/styles_reader"

# Writers
require_relative "writer/workbook_writer"
require_relative "writer/worksheet_writer"
require_relative "writer/shared_strings_writer"
require_relative "writer/styles_writer"

# Adapters (Roo compatibility layer)
require_relative "spreadsheet_adapter"
