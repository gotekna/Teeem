# frozen_string_literal: true

# WordToPdfConverter - THE ONE SSoT for Word to PDF conversion
#
# Converts DOCX files to PDF without Microsoft dependency.
# Pipeline: docx gem (read) → HTML (formatting) → Grover (PDF)
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: No Microsoft Graph API - all conversion done locally       ║
# ║  Uses: docx gem, Grover (Puppeteer), HexaPDF for seal stamping   ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   converter = WordToPdfConverter.new
#   result = converter.convert(docx_content, filename: "document.docx")
#   result[:pdf]  # => PDF binary content
#
#   # Auto-add signature if missing:
#   converter = WordToPdfConverter.new(add_signature_if_missing: true)
#   result = converter.convert(docx_content, filename: "certificate.docx")
#
class WordToPdfConverter
  # Patterns that indicate a signature is present in the document
  SIGNATURE_PATTERNS = [
    /signed\s*by/i,
    /director/i,
    /secretary/i,
    /signature/i,
    /authorised\s*(signatory|officer)/i,
    /executed\s*by/i,
    /witness/i
  ].freeze

  def initialize(options = {})
    @add_company_seal = options[:add_company_seal] || false
    @add_signature_if_missing = options[:add_signature_if_missing] || false
    @seal_position = options[:seal_position] || :bottom_right
  end

  # Convert DOCX content to PDF
  # @param content [String] DOCX file binary content
  # @param filename [String] Original filename (for temp file extension)
  # @return [Hash] { success: true, pdf: binary, filename: "...", pages: N }
  def convert(content, filename: "document.docx")
    # Write to temp file for docx gem
    temp_docx = Tempfile.new(["convert", ".docx"])
    temp_docx.binmode
    temp_docx.write(content)
    temp_docx.close

    # Read Word and convert to HTML with formatting
    reader = UniversalDocumentReader.new(temp_docx.path, filename: filename)
    word_data = reader.read_word
    html = word_data[:html]

    Rails.logger.info "[WordToPdfConverter] Converting #{filename} (#{word_data[:paragraph_count]} paragraphs)"

    # Convert HTML to PDF via Grover
    pdf = Grover.new(html, **grover_options).to_pdf

    # Check if signature is needed and missing
    signature_added = false
    if @add_signature_if_missing || @add_company_seal
      has_signature = document_has_signature?(pdf)

      if !has_signature
        pdf = stamp_company_signature(pdf)
        signature_added = true
        Rails.logger.info "[WordToPdfConverter] Signature added (none detected in document)"
      else
        Rails.logger.info "[WordToPdfConverter] Signature detected, skipping stamp"
      end
    end

    # Generate output filename
    pdf_filename = filename.sub(/\.docx?$/i, ".pdf")

    Rails.logger.info "[WordToPdfConverter] SUCCESS: #{pdf_filename} (#{pdf.bytesize} bytes)"

    {
      success: true,
      pdf: pdf,
      filename: pdf_filename,
      pages: count_pages(pdf),
      original_paragraphs: word_data[:paragraph_count],
      signature_added: signature_added
    }
  rescue StandardError => e
    Rails.logger.error "[WordToPdfConverter] Conversion failed: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    { success: false, error: e.message }
  ensure
    temp_docx&.unlink
  end

  # Check if a file can be converted
  # @param filename [String] The filename to check
  # @return [Boolean] true if convertible
  def self.convertible?(filename)
    return false if filename.blank?
    %w[.doc .docx].include?(File.extname(filename).downcase)
  end

  private

  def grover_options
    {
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" },
      print_background: true,
      prefer_css_page_size: false,
      display_header_footer: false,
      launch_args: ["--no-sandbox", "--disable-dev-shm-usage"]
    }
  end

  # Check if the PDF already contains a signature
  # Looks for signature-related text patterns
  def document_has_signature?(pdf_content)
    # Extract text from PDF using HexaPDF
    document = HexaPDF::Document.new(io: StringIO.new(pdf_content))
    text = ""

    document.pages.each do |page|
      processor = HexaPDF::Content::Processor.new(page)
      processor.on_text_string = ->(str) { text << str << " " }
      processor.process(page.contents) rescue nil
    end

    # Check for signature patterns
    SIGNATURE_PATTERNS.any? { |pattern| text.match?(pattern) }
  rescue => e
    Rails.logger.warn "[WordToPdfConverter] Error checking for signature: #{e.message}"
    false # Assume no signature if we can't read the PDF
  end

  # Stamp company signature onto PDF using HexaPDF
  def stamp_company_signature(pdf_content)
    document = HexaPDF::Document.new(io: StringIO.new(pdf_content))

    # Get last page for signature
    page = document.pages.last
    return pdf_content unless page

    box = page.box
    canvas = page.canvas(type: :overlay)

    # Try to find signature image
    signature_path = find_signature_image

    if signature_path && File.exist?(signature_path)
      # Stamp signature image (bottom right)
      sig_width = 150
      sig_height = 60
      x = box.width - sig_width - 50
      y = 60

      image = document.images.add(signature_path.to_s)
      canvas.image(image, at: [x, y], width: sig_width, height: sig_height)

      # Add "Director" text below signature
      canvas.font("Helvetica", size: 10)
      canvas.fill_color("000000")
      canvas.text("Director", at: [x + 40, y - 12])
    else
      # No signature image - add text signature block
      x = box.width - 200
      y = 80

      # Draw signature line
      canvas.stroke_color("000000")
      canvas.line(x, y + 30, x + 150, y + 30)
      canvas.stroke

      # Add text
      canvas.font("Helvetica", size: 10)
      canvas.fill_color("000000")
      canvas.text("Authorised Signatory", at: [x + 20, y + 15])
      canvas.text("Director", at: [x + 55, y])

      Rails.logger.info "[WordToPdfConverter] Added signature placeholder (no image found)"
    end

    output = StringIO.new
    document.write(output)
    output.string
  end

  # Find signature image in standard locations
  def find_signature_image
    paths = [
      Rails.root.join("app", "assets", "images", "company_signature.png"),
      Rails.root.join("app", "assets", "images", "director_signature.png"),
      Rails.root.join("app", "assets", "images", "company_seal.png"),
      Rails.root.join("storage", "signatures", "default.png")
    ]

    paths.find { |p| File.exist?(p) }
  end

  def count_pages(pdf_content)
    doc = HexaPDF::Document.new(io: StringIO.new(pdf_content))
    doc.pages.count
  rescue
    1
  end
end
