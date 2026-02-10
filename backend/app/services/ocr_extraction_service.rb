# frozen_string_literal: true

# Extracts text and word-level bounding boxes from PDFs using Claude Vision
# Replaced Tesseract OCR (Feb 2026) to eliminate system package dependencies
#
# Usage:
#   service = OcrExtractionService.new(bill_inbox)
#   result = service.extract!
#   # => { text: "full text", words: [{text, x, y, width, height, confidence, page}], pages: [...] }
#
class OcrExtractionService
  include AnthropicClient

  def initialize(bill_inbox)
    @bill = bill_inbox
  end

  def extract!
    raise "MiniMagick is only available on the worker dyno." unless defined?(MiniMagick)
    return {} unless @bill.storage_reference.present?

    Rails.logger.info "[OCR] Starting Claude Vision extraction for BillInbox ##{@bill.id}"

    @temp_files = []

    # Convert PDF to images for Claude Vision
    images = pdf_to_images

    # Extract text + word positions from each page via Claude Vision
    pages_data = images.map.with_index do |image_path, page_num|
      extract_page_with_vision(image_path, page_num + 1)
    end

    # Combine results
    all_words = pages_data.flat_map { |page| page[:words] }
    full_text = pages_data.map { |page| page[:text] }.join("\n\n")

    {
      text: full_text,
      words: all_words,
      pages: pages_data,
      extracted_at: Time.current,
      ocr_engine: "claude_vision",
      ocr_version: CLAUDE_HAIKU
    }
  rescue StandardError => e
    Rails.logger.error "[OCR] Error extracting BillInbox ##{@bill.id}: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    { error: e.message }
  ensure
    cleanup_temp_files
  end

  private

  def pdf_to_images
    content = @bill.download_invoice_file
    raise "Failed to download file from SharePoint" if content.nil?

    images = []

    Tempfile.create(["invoice", ".pdf"], binmode: true) do |pdf_file|
      pdf_file.write(content)
      pdf_file.rewind

      image = MiniMagick::Image.open(pdf_file.path)
      image.format "png"
      image.density 200
      image.colorspace "Gray"

      num_pages = image.pages.length

      if num_pages > 1
        image.pages.each_with_index do |page, idx|
          page_file = Tempfile.new(["page_#{idx}", ".png"], binmode: true)
          @temp_files << page_file
          page.write(page_file.path)
          images << page_file.path
        end
      else
        page_file = Tempfile.new(["page_0", ".png"], binmode: true)
        @temp_files << page_file
        image.write(page_file.path)
        images << page_file.path
      end
    end

    images
  end

  def extract_page_with_vision(image_path, page_number)
    image_data = Base64.strict_encode64(File.binread(image_path))
    img = MiniMagick::Image.open(image_path)
    img_width = img.width.to_f
    img_height = img.height.to_f

    response = call_claude_with_content(
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: image_data
          }
        },
        {
          type: "text",
          text: word_extraction_prompt
        }
      ],
      model: CLAUDE_HAIKU,
      max_tokens: 4096
    )

    result_text = extract_claude_text(response)
    parse_vision_response(result_text, page_number, img_width, img_height)
  end

  def word_extraction_prompt
    <<~PROMPT
      Extract ALL text from this document image. Return ONLY valid JSON with no additional text.

      Return this exact structure:
      {
        "text": "the complete text content of the page, preserving line breaks",
        "words": [
          {"text": "word", "x": 0.05, "y": 0.10, "w": 0.08, "h": 0.02},
          {"text": "another", "x": 0.14, "y": 0.10, "w": 0.10, "h": 0.02}
        ]
      }

      For each word:
      - text: the word as it appears
      - x: left edge as fraction of image width (0.0 = left, 1.0 = right)
      - y: top edge as fraction of image height (0.0 = top, 1.0 = bottom)
      - w: word width as fraction of image width
      - h: word height as fraction of image height

      Extract EVERY word including numbers, dates, amounts, headers, footers, and fine print.
      Coordinates must be as accurate as possible.
      Return ONLY the JSON, no explanations.
    PROMPT
  end

  def parse_vision_response(text, page_number, img_width, img_height)
    return empty_page_result(page_number) if text.blank?

    json_match = text.match(/\{[\s\S]*\}/)
    return empty_page_result(page_number) unless json_match

    data = JSON.parse(json_match[0])

    words = (data["words"] || []).filter_map do |w|
      next if w["text"].blank?

      x = w["x"].to_f.clamp(0.0, 1.0)
      y = w["y"].to_f.clamp(0.0, 1.0)
      width = w["w"].to_f.clamp(0.0, 1.0)
      height = w["h"].to_f.clamp(0.0, 1.0)

      {
        text: w["text"].strip,
        x: x,
        y: y,
        width: width,
        height: height,
        confidence: 0.95,
        page: page_number,
        pixel_x: (x * img_width).round,
        pixel_y: (y * img_height).round,
        pixel_width: (width * img_width).round,
        pixel_height: (height * img_height).round
      }
    end

    {
      page: page_number,
      text: data["text"] || words.map { |w| w[:text] }.join(" "),
      words: words,
      image_width: img_width.to_i,
      image_height: img_height.to_i
    }
  rescue JSON::ParserError => e
    Rails.logger.error "[OCR] Failed to parse Claude Vision response: #{e.message}"
    empty_page_result(page_number)
  end

  def empty_page_result(page_number)
    { page: page_number, text: "", words: [], image_width: 0, image_height: 0 }
  end

  def cleanup_temp_files
    return unless @temp_files

    @temp_files.each do |f|
      f.close unless f.closed?
      f.unlink
    rescue StandardError => e
      Rails.logger.debug "[OCR] Failed to clean up temp file: #{e.message}"
    end
    @temp_files = []
  end
end
