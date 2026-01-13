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
#   # With company seal:
#   converter = WordToPdfConverter.new(add_company_seal: true)
#   result = converter.convert(docx_content, filename: "certificate.docx")
#
class WordToPdfConverter
  def initialize(options = {})
    @add_company_seal = options[:add_company_seal] || false
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

    # Optionally stamp company seal
    if @add_company_seal
      pdf = stamp_company_seal(pdf)
    end

    # Generate output filename
    pdf_filename = filename.sub(/\.docx?$/i, ".pdf")

    Rails.logger.info "[WordToPdfConverter] SUCCESS: #{pdf_filename} (#{pdf.bytesize} bytes)"

    {
      success: true,
      pdf: pdf,
      filename: pdf_filename,
      pages: count_pages(pdf),
      original_paragraphs: word_data[:paragraph_count]
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

  # Stamp company seal onto PDF using HexaPDF
  def stamp_company_seal(pdf_content)
    document = HexaPDF::Document.new(io: StringIO.new(pdf_content))

    # Get last page for seal
    page = document.pages.last
    return pdf_content unless page

    box = page.box
    canvas = page.canvas(type: :overlay)

    # Calculate position based on seal_position
    seal_size = 80
    case @seal_position
    when :bottom_right
      x = box.width - seal_size - 40
      y = 40
    when :bottom_left
      x = 40
      y = 40
    when :top_right
      x = box.width - seal_size - 40
      y = box.height - seal_size - 40
    else
      x = box.width - seal_size - 40
      y = 40
    end

    # Add company seal image if exists
    seal_path = Rails.root.join("app", "assets", "images", "company_seal.png")
    if File.exist?(seal_path)
      image = document.images.add(seal_path.to_s)
      canvas.image(image, at: [x, y], width: seal_size, height: seal_size)
      Rails.logger.info "[WordToPdfConverter] Company seal stamped at #{@seal_position}"
    else
      Rails.logger.warn "[WordToPdfConverter] Company seal image not found: #{seal_path}"
    end

    output = StringIO.new
    document.write(output)
    output.string
  end

  def count_pages(pdf_content)
    doc = HexaPDF::Document.new(io: StringIO.new(pdf_content))
    doc.pages.count
  rescue
    1
  end
end
