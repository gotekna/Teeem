# frozen_string_literal: true

# THE ONE SSoT for PDF text extraction
#
# Consolidates all PDF::Reader usage from:
# - DocumentVerificationService
# - InvoiceParsingService
# - SyncedEmail
# - AsicConnectService
#
# Usage:
#   result = PdfTextExtractionService.extract(pdf_content)
#   result = PdfTextExtractionService.extract(file_path)
#   result = PdfTextExtractionService.extract(storage_blob)  # StorageBlob SSoT
#
class PdfTextExtractionService
  class ExtractionError < StandardError; end

  DEFAULT_OPTIONS = {
    max_pages: nil,           # Limit pages to process (nil = all)
    max_chars_per_page: 2000, # Truncate long pages
    join_pages: false,        # true = single string, false = array
    include_page_numbers: true
  }.freeze

  def initialize(options = {})
    @options = DEFAULT_OPTIONS.merge(options)
  end

  # Main entry point - class method
  def self.extract(source, **options)
    new(options).extract(source)
  end

  # Extract text from any source
  def extract(source)
    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    content = normalize_source(source)

    result = extract_with_pdf_reader(content)

    {
      success: result[:text].present?,
      text: result[:text],
      pages: result[:pages],
      page_count: result[:page_count],
      method: :pdf_reader,
      duration_ms: duration_ms(start_time),
      error: nil
    }
  rescue PDF::Reader::MalformedPDFError => e
    Rails.logger.warn "[PdfTextExtraction] Malformed PDF: #{e.message}"
    { success: false, text: "", pages: [], page_count: 0, error: "Malformed PDF: #{e.message}", method: :error }
  rescue StandardError => e
    Rails.logger.error "[PdfTextExtraction] Error: #{e.message}"
    { success: false, text: "", pages: [], page_count: 0, error: e.message, method: :error }
  end

  private

  # Normalize any source to binary content
  def normalize_source(source)
    case source
    when String
      # Could be binary content or a file path
      if source.encoding == Encoding::BINARY || source.start_with?("%PDF")
        source
      elsif File.exist?(source)
        File.binread(source)
      else
        # Assume it's binary content with wrong encoding
        source.dup.force_encoding(Encoding::BINARY)
      end
    when StorageBlob
      source.download
    when Tempfile, File
      source.rewind if source.respond_to?(:rewind)
      content = source.binmode.read
      source.rewind if source.respond_to?(:rewind)
      content
    else
      raise ArgumentError, "Unknown source type: #{source.class}. Expected String, Blob, or File."
    end
  end

  # Extract text using PDF::Reader
  def extract_with_pdf_reader(content)
    Tempfile.create(["extraction", ".pdf"], binmode: true) do |file|
      file.write(content)
      file.rewind

      reader = PDF::Reader.new(file.path)
      pages_to_process = if @options[:max_pages]
        reader.pages.first(@options[:max_pages])
      else
        reader.pages
      end

      pages = []
      full_text = []

      pages_to_process.each_with_index do |page, index|
        page_text = extract_page_text(page)
        truncated = truncate_text(page_text)

        if @options[:include_page_numbers]
          pages << { page: index + 1, text: truncated }
        end
        full_text << truncated
      end

      {
        text: @options[:join_pages] ? full_text.join("\n") : full_text.join("\n\n"),
        pages: pages,
        page_count: reader.page_count
      }
    end
  end

  # Extract text from a single page with error handling
  def extract_page_text(page)
    page.text.to_s.strip
  rescue StandardError => e
    Rails.logger.warn "[PdfTextExtraction] Error extracting page text: #{e.message}"
    ""
  end

  # Truncate text to max chars per page
  def truncate_text(text)
    return text unless @options[:max_chars_per_page]
    text[0...@options[:max_chars_per_page]]
  end

  # Calculate duration in milliseconds
  def duration_ms(start_time)
    ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).to_i
  end
end
