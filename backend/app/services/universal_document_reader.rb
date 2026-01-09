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
    when ActiveStorage::Blob
      file_or_path.filename.to_s
    when ActiveStorage::Attached::One
      file_or_path.filename.to_s
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
    when ActiveStorage::Blob
      StringIO.new(file.download)
    when ActiveStorage::Attached::One
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

  def convert_word_to_html(doc)
    # Convert Word paragraphs to HTML with basic formatting
    html_parts = doc.paragraphs.map do |para|
      text = para.text
      next if text.blank?

      # Wrap in paragraph tag
      "<p>#{ERB::Util.html_escape(text)}</p>"
    end

    html_parts.compact.join("\n")
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
