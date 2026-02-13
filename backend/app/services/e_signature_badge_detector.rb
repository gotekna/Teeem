# frozen_string_literal: true

# ESignatureBadgeDetector - Detects blue signature badges in PDF documents
# and creates ESignatureField records at their positions.
#
# Used by DirectorChangeService and BPMN tasks to enable the stamper
# to overlay actual signatures exactly where the visual badges appear.
#
# The badge is a light-blue rectangle (#e8f4fd background, #2196F3 border)
# rendered by the HTML templates. This service parses the PDF content stream
# to find those rectangles and matches them to signers by email text.
#
class ESignatureBadgeDetector
  # Badge background color: #e8f4fd = RGB(0.91, 0.957, 0.992)
  BADGE_COLOR_R = 0.91
  BADGE_COLOR_G = 0.957
  BADGE_COLOR_B = 0.992
  COLOR_TOLERANCE = 0.03

  # Minimum badge dimensions in PDF points (filters out tiny colored rects)
  MIN_BADGE_WIDTH = 50
  MIN_BADGE_HEIGHT = 15

  # Create ESignatureField records for each signer by detecting their
  # badge position in the PDF. Fails silently if detection errors occur.
  def self.create_fields_from_pdf!(request, pdf_content)
    new(request, pdf_content).create_fields!
  end

  def initialize(request, pdf_content)
    @request = request
    @pdf_content = pdf_content
  end

  def create_fields!
    document = HexaPDF::Document.new(io: StringIO.new(@pdf_content))

    @request.signers.order(:signing_order).each do |signer|
      badge_info = find_badge_for_signer(document, signer.email)
      next unless badge_info

      @request.fields.create!(
        e_signature_signer: signer,
        field_type: "signature",
        page_number: badge_info[:page_number],
        x_percent: badge_info[:x_percent],
        y_percent: badge_info[:y_percent],
        width_percent: badge_info[:width_percent],
        height_percent: badge_info[:height_percent],
        required: true,
        label: "Signature"
      )
    end
  rescue => e
    # Don't fail the request if field detection fails - legacy stamper handles it
    Rails.logger.warn("[ESignatureBadgeDetector] Badge detection failed: #{e.message}")
  end

  private

  # Find the page and position of a signer's signature badge.
  # Searches each page for both the signer's email AND a blue badge rectangle.
  def find_badge_for_signer(document, signer_email)
    document.pages.each_with_index do |page, index|
      stream = extract_page_stream(page)
      next unless stream

      # Page must contain BOTH the signer's email AND a blue badge
      next unless stream.include?(signer_email)

      badge_rect = find_badge_rect_in_stream(stream)
      next unless badge_rect

      box = page.box
      badge_top = badge_rect[:y] + badge_rect[:height]

      return {
        page_number: index + 1,
        x_percent: ((badge_rect[:x] - 5) / box.width * 100).clamp(1.0, 90.0).round(1),
        y_percent: ((box.height - badge_top - 5) / box.height * 100).clamp(1.0, 90.0).round(1),
        width_percent: ((badge_rect[:width] + 20) / box.width * 100).clamp(10.0, 50.0).round(1),
        height_percent: ((badge_rect[:height] + 20) / box.height * 100).clamp(5.0, 20.0).round(1)
      }
    end

    nil
  end

  # Extract the decompressed content stream from a PDF page
  def extract_page_stream(page)
    contents = page[:Contents]
    return nil unless contents

    if contents.is_a?(Array) || contents.is_a?(HexaPDF::PDFArray)
      contents.map { |ref|
        obj = ref.is_a?(HexaPDF::Reference) ? page.document.object(ref) : ref
        obj.stream_decoded rescue obj.stream.to_s
      }.join("\n")
    else
      contents.stream_decoded rescue contents.stream.to_s
    end
  rescue => e
    Rails.logger.debug("[ESignatureBadgeDetector] Stream extraction failed: #{e.message}")
    nil
  end

  # Parse a PDF content stream to find a blue badge background rectangle.
  # Tokenizes the stream and looks for the badge fill color followed by a rectangle.
  # Returns { x:, y:, width:, height: } in PDF points, or nil.
  def find_badge_rect_in_stream(stream)
    return nil if stream.blank?

    tokens = stream.scan(/-?\d+\.?\d*|[a-zA-Z\*]+/)
    badge_color_active = false
    last_badge_rect = nil

    tokens.each_with_index do |token, i|
      case token
      when "rg"
        # Non-stroking fill color: 3 preceding tokens are r, g, b
        if i >= 3
          r = tokens[i - 3].to_f
          g = tokens[i - 2].to_f
          b = tokens[i - 1].to_f
          badge_color_active = (r - BADGE_COLOR_R).abs < COLOR_TOLERANCE &&
                               (g - BADGE_COLOR_G).abs < COLOR_TOLERANCE &&
                               (b - BADGE_COLOR_B).abs < COLOR_TOLERANCE
        end
      when "re"
        # Rectangle: 4 preceding tokens are x, y, width, height
        if badge_color_active && i >= 4
          x = tokens[i - 4].to_f
          y = tokens[i - 3].to_f
          w = tokens[i - 2].to_f
          h = tokens[i - 1].to_f
          if w.abs > MIN_BADGE_WIDTH && h.abs > MIN_BADGE_HEIGHT
            last_badge_rect = { x: x, y: y, width: w.abs, height: h.abs }
          end
        end
      when "f", "F", "B", "b"
        badge_color_active = false
      end
    end

    last_badge_rect
  end
end
