# frozen_string_literal: true

require "hexapdf"

# ESignatureBadgeDetector - Detects blue signature badges in PDF documents
# and creates ESignatureField records at their positions.
#
# Used by DirectorChangeService and BPMN tasks to enable the stamper
# to overlay actual signatures exactly where the visual badges appear.
#
# The badge is a light-blue rectangle (#e8f4fd background, #2196F3 border)
# rendered by the HTML templates. This service parses the PDF content stream
# to find those rectangles.
#
# Matching strategy (in order):
#   1. Email text match: signer's email found on same page as badge
#   2. Order-based fallback: badges assigned to signers by page order
#      (works when PDF fonts use glyph encoding instead of raw ASCII)
#
# ⚠️ DO NOT SIMPLIFY - Chrome PDF coordinate handling (Feb 2026)
# ════════════════════════════════════════════════════════════════
# Chrome/Grover PDFs use a cm transform like [0.24, 0, 0, -0.24, 0, 842.88]
# which means coordinates are in a SCALED, Y-FLIPPED user space (y increases
# downward from top, like HTML). The detector must extract the cm transform
# to correctly convert user-space coordinates to page percentages.
# ❌ WRONG: Assume standard PDF coords (y=0 at bottom, increases upward)
# ✅ CORRECT: Detect cm transform, apply scale + direction to coordinates
# ════════════════════════════════════════════════════════════════
#
class ESignatureBadgeDetector
  # Badge background color: #e8f4fd = RGB(0.91, 0.957, 0.992)
  BADGE_COLOR_R = 0.91
  BADGE_COLOR_G = 0.957
  BADGE_COLOR_B = 0.992
  COLOR_TOLERANCE = 0.03

  # Minimum badge dimensions in user-space units (filters out tiny colored rects)
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
    signers = @request.signers.order(:signing_order).to_a

    # First pass: try email-based matching (original strategy)
    email_matched = try_email_matching(document, signers)
    return if email_matched

    # Second pass: find all badges and assign by page order
    # This handles PDFs where fonts use glyph encoding (emails not in raw stream)
    Rails.logger.info("[ESignatureBadgeDetector] Email matching failed, using order-based matching")
    try_order_matching(document, signers)
  rescue => e
    Rails.logger.warn("[ESignatureBadgeDetector] Badge detection failed: #{e.message}")
  end

  private

  # Try to match badges to signers by finding signer email on the same page.
  # A signer may have badges on MULTIPLE pages (e.g. one per position in director change).
  # Returns true if at least one field was created.
  def try_email_matching(document, signers)
    fields_created = 0

    signers.each do |signer|
      badges = find_all_badges_for_signer(document, signer.email)
      next if badges.empty?

      badges.each do |badge_info|
        @request.fields.create!(
          e_signature_signer: signer,
          field_type: "signature",
          page_number: badge_info[:page_number],
          x_percent: badge_info[:x_percent],
          y_percent: badge_info[:y_percent],
          width_percent: badge_info[:width_percent],
          height_percent: badge_info[:height_percent],
          required: true,
          label: "Signature — Page #{badge_info[:page_number]}"
        )
        fields_created += 1
      end
    end

    fields_created > 0
  end

  # Find all badge rectangles across all pages, then distribute to signers in order.
  # The document generation order matches signer signing_order:
  #   - Minutes page (first signer/chairperson)
  #   - Resignation pages (ceasing directors in order)
  #   - Consent pages (new appointments in order)
  # Badges are distributed evenly: with 6 badges and 2 signers, each gets 3.
  def try_order_matching(document, signers)
    all_badges = find_all_badges(document)
    return if all_badges.empty?

    Rails.logger.info("[ESignatureBadgeDetector] Found #{all_badges.size} badges for #{signers.size} signers")

    # Distribute badges evenly across signers in page order
    badges_per_signer = (all_badges.size.to_f / signers.size).ceil
    signers.each_with_index do |signer, signer_idx|
      start_idx = signer_idx * badges_per_signer
      signer_badges = all_badges[start_idx, badges_per_signer] || []

      signer_badges.each do |badge_info|
        @request.fields.create!(
          e_signature_signer: signer,
          field_type: "signature",
          page_number: badge_info[:page_number],
          x_percent: badge_info[:x_percent],
          y_percent: badge_info[:y_percent],
          width_percent: badge_info[:width_percent],
          height_percent: badge_info[:height_percent],
          required: true,
          label: "Signature — Page #{badge_info[:page_number]}"
        )
      end
    end
  end

  # Find all badge positions across all pages, sorted by page number.
  def find_all_badges(document)
    badges = []

    document.pages.each_with_index do |page, index|
      stream = extract_page_stream(page)
      next unless stream

      badge_rects = find_badge_rects_in_stream(stream)
      next if badge_rects.empty?

      box = page.box
      cm = extract_cm_transform(stream)

      badge_rects.each do |badge_rect|
        badges << convert_rect_to_percent(badge_rect, box, cm, index + 1)
      end
    end

    badges
  end

  # Find ALL badge positions for a signer across all pages.
  # A signer may appear on multiple pages (e.g. minutes + 3 resignation documents).
  # Returns an array of badge info hashes for pages where signer's email + badge found.
  def find_all_badges_for_signer(document, signer_email)
    badges = []

    document.pages.each_with_index do |page, index|
      stream = extract_page_stream(page)
      next unless stream

      # Page must contain BOTH the signer's email AND a blue badge
      next unless stream.include?(signer_email)

      badge_rects = find_badge_rects_in_stream(stream)
      next if badge_rects.empty?

      box = page.box
      cm = extract_cm_transform(stream)

      badge_rects.each do |badge_rect|
        badges << convert_rect_to_percent(badge_rect, box, cm, index + 1)
      end
    end

    badges
  end

  # Extract the initial cm (concat matrix) transform from the page stream.
  # Chrome/Grover PDFs typically start with: a 0 0 d 0 f cm
  # where d < 0 means Y is flipped (HTML-style: y increases downward).
  # Returns { scale_x:, scale_y:, y_flip:, ty: } or nil if no cm found.
  def extract_cm_transform(stream)
    # Match the first cm operator in the stream
    # Format: a b c d e f cm (6 numbers followed by "cm")
    match = stream.match(/(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+cm/)
    return nil unless match

    a = match[1].to_f  # x scale
    d = match[4].to_f  # y scale (negative = y-flip)
    f = match[6].to_f  # y translation

    {
      scale_x: a.abs,
      scale_y: d.abs,
      y_flip: d < 0,
      ty: f
    }
  end

  # Convert a badge rectangle from user-space coordinates to page percentages.
  # Handles Chrome's scaled+flipped coordinate system via the cm transform.
  def convert_rect_to_percent(badge_rect, box, cm, page_number)
    x = badge_rect[:x]
    y = badge_rect[:y]
    w = badge_rect[:width]
    h = badge_rect[:height]

    if cm && cm[:scale_x] > 0 && cm[:scale_y] > 0
      # Chrome PDF: coordinates are in scaled user space
      # Convert to PDF points by applying the scale factor
      scale_x = cm[:scale_x]
      scale_y = cm[:scale_y]

      x_pt = x * scale_x
      w_pt = w * scale_x
      h_pt = h * scale_y

      if cm[:y_flip]
        # Y is flipped: y=0 is at TOP, increases downward (HTML-style)
        # y in stream = distance from top in user-space units
        y_top_pt = y * scale_y  # distance from top in PDF points
        y_pct = (y_top_pt / box.height * 100).clamp(1.0, 90.0).round(1)
      else
        # Standard PDF: y=0 at bottom, increases upward
        y_pt = y * scale_y
        badge_top = y_pt + h_pt
        y_pct = ((box.height - badge_top) / box.height * 100).clamp(1.0, 90.0).round(1)
      end

      x_pct = (x_pt / box.width * 100).clamp(1.0, 90.0).round(1)
      w_pct = (w_pt / box.width * 100).clamp(10.0, 50.0).round(1)
      h_pct = (h_pt / box.height * 100).clamp(5.0, 20.0).round(1)
    else
      # No cm transform or unknown format: assume standard PDF coordinates
      badge_top = y + h
      x_pct = ((x - 5) / box.width * 100).clamp(1.0, 90.0).round(1)
      y_pct = ((box.height - badge_top - 5) / box.height * 100).clamp(1.0, 90.0).round(1)
      w_pct = ((w + 20) / box.width * 100).clamp(10.0, 50.0).round(1)
      h_pct = ((h + 20) / box.height * 100).clamp(5.0, 20.0).round(1)
    end

    {
      page_number: page_number,
      x_percent: x_pct,
      y_percent: y_pct,
      width_percent: w_pct,
      height_percent: h_pct
    }
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

  # Parse a PDF content stream to find all blue badge background shapes.
  # Handles both simple rectangles (re) and Bezier curve paths (m/l/c)
  # used by PDF renderers for rounded rectangles.
  # Returns array of { x:, y:, width:, height: } in PDF points.
  def find_badge_rects_in_stream(stream)
    return [] if stream.blank?

    # PDF numbers can omit leading zero (e.g. .9098 instead of 0.9098)
    tokens = stream.scan(/-?(?:\d+\.?\d*|\.\d+)|[a-zA-Z\*]+/)
    badge_color_active = false
    path_points = []
    badge_rects = []

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
          path_points = [] if badge_color_active
        end
      when "m"
        # moveto: x y m — starts a new subpath
        if badge_color_active && i >= 2
          path_points << [tokens[i - 2].to_f, tokens[i - 1].to_f]
        end
      when "l"
        # lineto: x y l
        if badge_color_active && i >= 2
          path_points << [tokens[i - 2].to_f, tokens[i - 1].to_f]
        end
      when "c"
        # curveto: x1 y1 x2 y2 x3 y3 c (Bezier control + end points)
        if badge_color_active && i >= 6
          path_points << [tokens[i - 6].to_f, tokens[i - 5].to_f]
          path_points << [tokens[i - 4].to_f, tokens[i - 3].to_f]
          path_points << [tokens[i - 2].to_f, tokens[i - 1].to_f]
        end
      when "re"
        # Rectangle shorthand: x y w h re
        if badge_color_active && i >= 4
          x = tokens[i - 4].to_f
          y = tokens[i - 3].to_f
          w = tokens[i - 2].to_f
          h = tokens[i - 1].to_f
          if w.abs > MIN_BADGE_WIDTH && h.abs > MIN_BADGE_HEIGHT
            badge_rects << { x: x, y: y, width: w.abs, height: h.abs }
          end
        end
      when "f", "F"
        # Fill operator — check if accumulated path forms a badge-sized shape
        if badge_color_active && path_points.size >= 3
          xs = path_points.map(&:first)
          ys = path_points.map(&:last)
          w = xs.max - xs.min
          h = ys.max - ys.min
          if w > MIN_BADGE_WIDTH && h > MIN_BADGE_HEIGHT
            badge_rects << { x: xs.min, y: ys.min, width: w, height: h }
          end
        end
        badge_color_active = false
        path_points = []
      when "n", "S", "s"
        # End path without fill / stroke only — reset path tracking
        path_points = []
      end
    end

    badge_rects
  end
end
