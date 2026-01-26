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
#   # Use template config for signature positions (SSoT for template-based docs):
#   config = DocumentType.find_by(name: "Minutes").signature_field_config
#   converter = WordToPdfConverter.new(signature_field_config: config)
#   result = converter.convert(docx_content, filename: "minutes.docx")
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
    # Template-based signature field config (from DocumentType.signature_field_config)
    # Format: [{signatory_type, page_number, x_percent, y_percent, width_percent, height_percent}]
    @signature_field_config = options[:signature_field_config]
    # Optional signature image to use (path to PNG/JPG file)
    @signature_image_path = options[:signature_image_path]
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

    # Stamp signatures based on mode
    signature_added = false
    signatures_stamped = 0

    if @signature_field_config.present? && @signature_field_config.is_a?(Array) && @signature_field_config.any?
      # Use template-based signature field config (SSoT)
      pdf = stamp_signatures_at_config_positions(pdf, @signature_field_config)
      signatures_stamped = @signature_field_config.count { |f| !f["has_existing_signature"] && !f[:has_existing_signature] }
      signature_added = signatures_stamped > 0
      Rails.logger.info "[WordToPdfConverter] Stamped #{signatures_stamped} signatures at configured positions"
    elsif @add_signature_if_missing || @add_company_seal
      # Legacy mode: Check if signature is needed and add at default position
      has_signature = document_has_signature?(pdf)

      if !has_signature
        pdf = stamp_company_signature(pdf)
        signature_added = true
        Rails.logger.info "[WordToPdfConverter] Signature added at default position (none detected in document)"
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

  # Stamp signatures at configured positions (from DocumentType.signature_field_config)
  # @param pdf_content [String] PDF binary content
  # @param config [Array] Array of field configs with positions as percentages
  # @return [String] Modified PDF content
  def stamp_signatures_at_config_positions(pdf_content, config)
    document = HexaPDF::Document.new(io: StringIO.new(pdf_content))
    signature_path = @signature_image_path || find_signature_image

    config.each do |field|
      # Skip fields that already have signatures
      next if field["has_existing_signature"] || field[:has_existing_signature]

      # Get page (1-indexed in config, 0-indexed in HexaPDF)
      page_number = (field["page_number"] || field[:page_number] || 1).to_i
      page = document.pages[page_number - 1]
      next unless page

      box = page.box
      canvas = page.canvas(type: :overlay)

      # Convert percentage positions to PDF coordinates
      # PDF coordinates: origin at bottom-left, y increases upward
      # Config: y_percent is 0 at top, 100 at bottom
      x_percent = (field["x_percent"] || field[:x_percent] || 70).to_f
      y_percent = (field["y_percent"] || field[:y_percent] || 85).to_f
      width_percent = (field["width_percent"] || field[:width_percent] || 20).to_f
      height_percent = (field["height_percent"] || field[:height_percent] || 8).to_f

      # Calculate pixel positions
      field_width = (width_percent / 100.0) * box.width
      field_height = (height_percent / 100.0) * box.height
      x = (x_percent / 100.0) * box.width - (field_width / 2)  # Center horizontally
      y = box.height - ((y_percent / 100.0) * box.height) - (field_height / 2)  # Convert from top-origin to bottom-origin

      signatory_type = field["signatory_type"] || field[:signatory_type] || "director"
      signatory_name = field["signatory_name"] || field[:signatory_name]

      if signature_path && File.exist?(signature_path)
        # Stamp signature image
        begin
          image = document.images.add(signature_path.to_s)
          canvas.image(image, at: [ x, y ], width: field_width, height: field_height)
        rescue => e
          Rails.logger.warn "[WordToPdfConverter] Could not add signature image: #{e.message}"
          # Fall back to text signature
          stamp_text_signature(canvas, x, y, field_width, signatory_type, signatory_name)
        end
      else
        # Draw text-based signature placeholder
        stamp_text_signature(canvas, x, y, field_width, signatory_type, signatory_name)
      end

      # Add label below signature
      canvas.font("Helvetica", size: 9)
      canvas.fill_color("333333")
      label = signatory_name || signatory_type.to_s.titleize
      canvas.text(label, at: [ x + 10, y - 12 ])
    end

    output = StringIO.new
    document.write(output)
    output.string
  end

  # Draw a text-based signature placeholder (line + label)
  def stamp_text_signature(canvas, x, y, width, signatory_type, signatory_name = nil)
    # Draw signature line
    canvas.stroke_color("000000")
    canvas.line(x, y + 20, x + width, y + 20)
    canvas.stroke

    # Add "Authorised Signatory" or type text above line
    canvas.font("Helvetica", size: 8)
    canvas.fill_color("666666")
    type_label = case signatory_type.to_s.downcase
    when "director" then "Director"
    when "secretary" then "Secretary"
    when "witness" then "Witness"
    else "Authorised Signatory"
    end
    canvas.text(type_label, at: [ x + 5, y + 25 ])
  end
end
