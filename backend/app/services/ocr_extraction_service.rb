# frozen_string_literal: true

# Extracts text and bounding box coordinates from PDFs using Tesseract OCR
# Provides exact pixel locations for each word/field in the document
#
# Usage:
#   service = OcrExtractionService.new(bill_inbox)
#   result = service.extract!
#   # => { text: "full text", words: [{text, x, y, width, height, confidence, page}], pages: [...] }
#
class OcrExtractionService
  def initialize(bill_inbox)
    @bill = bill_inbox
  end

  def extract!
    return {} unless @bill.storage_reference.present?

    Rails.logger.info "[OCR] Starting OCR extraction for BillInbox ##{@bill.id}"

    # Convert PDF to images
    images = pdf_to_images

    # Run OCR on each page
    pages_data = images.map.with_index do |image_path, page_num|
      extract_page(image_path, page_num + 1)
    end

    # Combine results
    all_words = pages_data.flat_map { |page| page[:words] }
    full_text = pages_data.map { |page| page[:text] }.join("\n\n")

    {
      text: full_text,
      words: all_words,
      pages: pages_data,
      extracted_at: Time.current,
      ocr_engine: "tesseract",
      ocr_version: tesseract_version
    }
  rescue StandardError => e
    Rails.logger.error "[OCR] Error extracting BillInbox ##{@bill.id}: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    { error: e.message }
  end

  private

  def pdf_to_images
    content = @bill.download_invoice_file
    raise "Failed to download file from SharePoint" if content.nil?

    images = []

    Tempfile.create([ "invoice", ".pdf" ], binmode: true) do |pdf_file|
      pdf_file.write(content)
      pdf_file.rewind

      # Use MiniMagick to convert each PDF page to PNG
      # Higher density = better OCR accuracy
      image = MiniMagick::Image.open(pdf_file.path)
      image.format "png"
      image.density 300  # DPI - high quality for accurate OCR
      image.colorspace "Gray"  # Grayscale can improve OCR accuracy

      # Check if PDF has multiple pages
      num_pages = image.pages.length

      if num_pages > 1
        # Split multi-page PDF
        image.pages.each_with_index do |page, idx|
          page_file = Tempfile.new([ "page_#{idx}", ".png" ], binmode: true)
          page.write(page_file.path)
          images << page_file.path
        end
      else
        # Single page
        page_file = Tempfile.new([ "page_0", ".png" ], binmode: true)
        image.write(page_file.path)
        images << page_file.path
      end
    end

    images
  end

  def extract_page(image_path, page_number)
    # Run Tesseract with TSV output (includes bounding boxes)
    # Config: tessedit_create_tsv=1 outputs tab-separated values with coordinates
    image = RTesseract.new(image_path, lang: "eng")

    # Get bounding box data (word level)
    # Tesseract TSV format: level, page_num, block_num, par_num, line_num, word_num,
    #                       left, top, width, height, conf, text
    tsv_file = image.to_tsv

    # RTesseract returns a File object, so read its contents
    tsv_data = if tsv_file.respond_to?(:read)
                 tsv_file.rewind if tsv_file.respond_to?(:rewind)
                 tsv_file.read
               else
                 tsv_file.to_s
               end

    # Parse TSV to extract words with coordinates
    words = parse_tsv_data(tsv_data, page_number, image_path)

    # Get plain text
    text = image.to_s

    {
      page: page_number,
      text: text,
      words: words,
      image_width: get_image_width(image_path),
      image_height: get_image_height(image_path)
    }
  end

  def parse_tsv_data(tsv_data, page_number, image_path)
    return [] if tsv_data.blank?

    # Get image dimensions for calculating percentages
    img_width = get_image_width(image_path)
    img_height = get_image_height(image_path)

    words = []
    lines = tsv_data.split("\n")

    # Skip header row
    lines[1..-1]&.each do |line|
      parts = line.split("\t")
      next if parts.length < 12

      level = parts[0].to_i
      next unless level == 5  # Level 5 = word level

      left = parts[6].to_i
      top = parts[7].to_i
      width = parts[8].to_i
      height = parts[9].to_i
      confidence = parts[10].to_f
      text = parts[11]&.strip

      next if text.blank? || text == ""

      # Convert pixel coordinates to percentages (0.0 to 1.0)
      # This matches the format Claude uses in field_locations
      words << {
        text: text,
        x: left.to_f / img_width,
        y: top.to_f / img_height,
        width: width.to_f / img_width,
        height: height.to_f / img_height,
        confidence: confidence / 100.0,  # Convert 0-100 to 0.0-1.0
        page: page_number,
        # Also store pixel coordinates for debugging
        pixel_x: left,
        pixel_y: top,
        pixel_width: width,
        pixel_height: height
      }
    end

    words
  end

  def get_image_width(image_path)
    image = MiniMagick::Image.open(image_path)
    image.width
  end

  def get_image_height(image_path)
    image = MiniMagick::Image.open(image_path)
    image.height
  end

  def tesseract_version
    `tesseract --version 2>&1`.lines.first&.strip || "unknown"
  rescue StandardError
    "unknown"
  end
end
