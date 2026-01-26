# frozen_string_literal: true

# SSoT: Universal Document Reader
# One service to read Excel, Word, and PDF files anywhere in TEEEM.
# No Office 365 dependency - uses local gems for parsing.
#
# Usage:
#   reader = UniversalDocumentReader.new(file_path_or_io)
#   reader.read_excel  # Returns { sheets: [...], data: [...] }
#   reader.read_word   # Returns { text: "...", html: "..." }
#   reader.extract_text  # Returns plain text for full-text search
#
class UniversalDocumentReader
  SUPPORTED_TYPES = {
    excel: %w[xlsx csv].freeze, # XLS deprecated
    word: %w[docx doc].freeze,
    pdf: %w[pdf].freeze,
    image: %w[png jpg jpeg gif webp].freeze
  }.freeze

  attr_reader :file, :filename, :file_type

  def initialize(file_or_path, filename: nil)
    @file = file_or_path
    @filename = filename || extract_filename(file_or_path)
    @file_type = detect_file_type
  end

  # Read Excel file → structured data with sheets
  # @return [Hash] { sheets: [String], data: [{ name: String, rows: [[]] }] }
  def read_excel
    raise UnsupportedFileTypeError, "Not an Excel file: #{filename}" unless excel?

    spreadsheet = open_spreadsheet
    {
      sheets: spreadsheet.sheets,
      data: spreadsheet.sheets.map do |sheet_name|
        sheet = spreadsheet.sheet(sheet_name)
        {
          name: sheet_name,
          headers: sheet.row(1),
          rows: sheet.to_a,
          row_count: sheet.last_row || 0,
          col_count: sheet.last_column || 0
        }
      end
    }
  rescue => e
    Rails.logger.error "[UniversalDocumentReader] Error reading Excel: #{e.message}"
    raise ReadError, "Failed to read Excel file: #{e.message}"
  end

  # Read Word document → text and HTML
  # @return [Hash] { text: String, html: String, paragraphs: [String] }
  def read_word
    raise UnsupportedFileTypeError, "Not a Word file: #{filename}" unless word?

    doc = open_word_document
    paragraphs = doc.paragraphs.map(&:text).reject(&:blank?)

    {
      text: paragraphs.join("\n\n"),
      html: convert_word_to_html(doc),
      paragraphs: paragraphs,
      paragraph_count: paragraphs.size
    }
  rescue => e
    Rails.logger.error "[UniversalDocumentReader] Error reading Word: #{e.message}"
    raise ReadError, "Failed to read Word file: #{e.message}"
  end

  # Read PDF → text content
  # @return [Hash] { text: String, pages: [String], page_count: Integer }
  def read_pdf
    raise UnsupportedFileTypeError, "Not a PDF file: #{filename}" unless pdf?

    reader = PDF::Reader.new(file_io)
    pages = reader.pages.map { |page| page.text rescue "" }

    {
      text: pages.join("\n\n"),
      pages: pages,
      page_count: reader.page_count
    }
  rescue => e
    Rails.logger.error "[UniversalDocumentReader] Error reading PDF: #{e.message}"
    raise ReadError, "Failed to read PDF file: #{e.message}"
  end

  # Extract plain text from any supported document type
  # Useful for full-text search indexing
  # @return [String] Plain text content
  def extract_text
    case file_type
    when :excel
      data = read_excel
      data[:data].flat_map { |sheet| sheet[:rows].flatten }.compact.join(" ")
    when :word
      read_word[:text]
    when :pdf
      read_pdf[:text]
    else
      raise UnsupportedFileTypeError, "Cannot extract text from: #{filename}"
    end
  rescue => e
    Rails.logger.warn "[UniversalDocumentReader] Text extraction failed: #{e.message}"
    ""
  end

  # Read any supported file type
  # @return [Hash] Content appropriate for file type
  def read
    case file_type
    when :excel then read_excel
    when :word then read_word
    when :pdf then read_pdf
    else
      raise UnsupportedFileTypeError, "Unsupported file type: #{filename}"
    end
  end

  # Check file type helpers
  def excel?
    file_type == :excel
  end

  def word?
    file_type == :word
  end

  def pdf?
    file_type == :pdf
  end

  def image?
    file_type == :image
  end

  def supported?
    SUPPORTED_TYPES.keys.include?(file_type)
  end

  # Get metadata about the file
  # @return [Hash] { type: Symbol, extension: String, size: Integer }
  def metadata
    {
      type: file_type,
      extension: extension,
      filename: filename,
      supported: supported?,
      readable: readable?
    }
  end

  private

  def extract_filename(file_or_path)
    case file_or_path
    when String
      File.basename(file_or_path)
    when ActionDispatch::Http::UploadedFile
      file_or_path.original_filename
    when StorageBlob
      file_or_path.file_name || "unknown"
    else
      "unknown"
    end
  end

  def extension
    @extension ||= File.extname(filename).delete_prefix(".").downcase
  end

  def detect_file_type
    SUPPORTED_TYPES.each do |type, extensions|
      return type if extensions.include?(extension)
    end
    :unknown
  end

  def file_io
    @file_io ||= case file
    when String
      File.open(file, "rb")
    when ActionDispatch::Http::UploadedFile
      file.tempfile
    when StorageBlob
      StringIO.new(file.download)
    when StringIO, Tempfile, File
      file
    else
      raise ReadError, "Unsupported file source: #{file.class}"
    end
  end

  def file_path
    case file
    when String
      file
    when ActionDispatch::Http::UploadedFile
      file.tempfile.path
    when Tempfile
      file.path
    else
      # For blobs/StringIO, write to temp file
      temp = Tempfile.new(["doc", ".#{extension}"])
      temp.binmode
      temp.write(file_io.read)
      file_io.rewind if file_io.respond_to?(:rewind)
      temp.close
      temp.path
    end
  end

  def open_spreadsheet
    TeeemXl::SpreadsheetAdapter.open(file_path, extension: extension)
  end

  def open_word_document
    Docx::Document.open(file_path)
  end

  # Convert Word document to HTML with formatting preservation
  # Returns complete HTML document with styles for PDF conversion
  def convert_word_to_html(doc)
    html_parts = doc.paragraphs.map do |para|
      next if para.text.blank?
      "<p>#{paragraph_to_html(para)}</p>"
    end

    wrap_with_document_styles(html_parts.compact.join("\n"))
  end

  # Convert a paragraph's runs to HTML, preserving inline formatting
  def paragraph_to_html(para)
    # The docx gem exposes the XML node - parse runs with formatting
    para.node.xpath(".//w:r", "w" => "http://schemas.openxmlformats.org/wordprocessingml/2006/main").map do |run_node|
      text = run_node.xpath(".//w:t", "w" => "http://schemas.openxmlformats.org/wordprocessingml/2006/main").map(&:text).join
      next if text.blank?

      apply_run_formatting(text, run_node)
    end.compact.join
  end

  # Apply bold/italic/underline formatting based on run properties
  def apply_run_formatting(text, run_node)
    escaped = ERB::Util.html_escape(text)

    # Extract formatting from w:rPr (run properties)
    props = run_node.at_xpath(".//w:rPr", "w" => "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
    return escaped unless props

    # Bold (w:b or w:b with val="1" or val="true")
    if props.at_xpath(".//w:b", "w" => "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
      escaped = "<strong>#{escaped}</strong>"
    end

    # Italic
    if props.at_xpath(".//w:i", "w" => "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
      escaped = "<em>#{escaped}</em>"
    end

    # Underline
    if props.at_xpath(".//w:u", "w" => "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
      escaped = "<u>#{escaped}</u>"
    end

    escaped
  end

  # Wrap HTML content in a complete document with styles
  def wrap_with_document_styles(html_content)
    <<~HTML
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Times New Roman', Georgia, serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 2cm;
            color: #000;
          }
          p { margin: 0 0 12pt 0; }
          strong { font-weight: bold; }
          em { font-style: italic; }
          u { text-decoration: underline; }
        </style>
      </head>
      <body>
        #{html_content}
      </body>
      </html>
    HTML
  end

  def readable?
    case file_type
    when :excel, :word, :pdf
      true
    else
      false
    end
  end

  # Custom errors
  class UnsupportedFileTypeError < StandardError; end
  class ReadError < StandardError; end
end
