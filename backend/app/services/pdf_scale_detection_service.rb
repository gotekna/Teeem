# frozen_string_literal: true

# PdfScaleDetectionService - AI-powered scale detection from PDF plans
#
# Uses Claude vision to analyze the title block area of construction plans
# and detect the drawing scale (e.g., "1:100", "1/4" = 1'-0"").
#
# Usage:
#   service = PdfScaleDetectionService.new
#   result = service.detect_scale(image_base64: base64_data, media_type: "image/png")
#   # => { scale: "1:100", scale_ratio: 100, unit: "metric", confidence: 0.95 }
#
class PdfScaleDetectionService
  include AnthropicClient

  # Use Sonnet for vision tasks (Haiku doesn't support vision well)
  self.default_claude_model = CLAUDE_SONNET

  SYSTEM_PROMPT = <<~PROMPT
    You are an expert at reading architectural and construction drawings. Your task is to identify the drawing scale from the title block or scale notation on the plan.

    Common scale formats:
    - Metric: "1:100", "1:50", "1:200", "1:500", "SCALE 1:100"
    - Imperial: "1/4" = 1'-0"", "1/8" = 1'-0"", "3/16" = 1'-0""
    - Percentage: "1% = 1m", "2% = 1m"
    - NTS (Not To Scale) - indicate this if found

    Look for:
    1. Scale notation in the title block (usually bottom right)
    2. Scale bars with measurements
    3. "SCALE:" or "SC:" labels
    4. Multiple scales (some drawings have different scales for different views)

    Return your analysis as JSON with this exact structure:
    {
      "detected": true/false,
      "scale_text": "the exact text found (e.g., '1:100' or '1/4\" = 1\\'-0\"')",
      "scale_ratio": numeric_ratio (e.g., 100 for 1:100, 48 for 1/4"=1'-0"),
      "unit": "metric" or "imperial",
      "confidence": 0.0 to 1.0,
      "notes": "any relevant observations"
    }

    If multiple scales are found, return the primary/main scale.
    If no scale is found, set detected: false and explain in notes.
  PROMPT

  # Detect scale from an image of a PDF page
  #
  # @param image_base64 [String] Base64 encoded image data
  # @param media_type [String] Image MIME type (image/png, image/jpeg)
  # @return [Hash] Detection result with scale info
  def detect_scale(image_base64:, media_type: "image/png")
    content = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: media_type,
          data: image_base64
        }
      },
      {
        type: "text",
        text: "Analyze this construction drawing and identify the scale. Focus on the title block area (usually bottom right) or any scale notation visible. Return the result as JSON."
      }
    ]

    response = call_claude_with_content(
      content: content,
      system: SYSTEM_PROMPT,
      max_tokens: 500
    )

    result = parse_claude_json(response)

    # Normalize the result
    {
      detected: result[:detected] || false,
      scale_text: result[:scale_text],
      scale_ratio: result[:scale_ratio]&.to_f,
      unit: result[:unit] || "metric",
      confidence: result[:confidence]&.to_f || 0.0,
      notes: result[:notes],
      reference_mm: calculate_reference_mm(result[:scale_ratio], result[:unit])
    }
  rescue StandardError => e
    Rails.logger.error "[PdfScaleDetectionService] Error detecting scale: #{e.message}"
    {
      detected: false,
      error: e.message,
      confidence: 0.0
    }
  end

  # Detect scale from a specific region of the image (e.g., title block)
  #
  # @param image_base64 [String] Base64 encoded image of the region
  # @param media_type [String] Image MIME type
  # @param region_description [String] Description of the region for context
  # @return [Hash] Detection result
  def detect_scale_from_region(image_base64:, media_type: "image/png", region_description: "title block")
    content = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: media_type,
          data: image_base64
        }
      },
      {
        type: "text",
        text: "This is the #{region_description} area of a construction drawing. Find and identify the scale notation. Return the result as JSON."
      }
    ]

    response = call_claude_with_content(
      content: content,
      system: SYSTEM_PROMPT,
      max_tokens: 500
    )

    result = parse_claude_json(response)

    {
      detected: result[:detected] || false,
      scale_text: result[:scale_text],
      scale_ratio: result[:scale_ratio]&.to_f,
      unit: result[:unit] || "metric",
      confidence: result[:confidence]&.to_f || 0.0,
      notes: result[:notes],
      reference_mm: calculate_reference_mm(result[:scale_ratio], result[:unit])
    }
  rescue StandardError => e
    Rails.logger.error "[PdfScaleDetectionService] Error detecting scale from region: #{e.message}"
    {
      detected: false,
      error: e.message,
      confidence: 0.0
    }
  end

  private

  # Calculate reference length in mm for common scales
  # This helps the user understand what a standard reference line should measure
  #
  # @param scale_ratio [Float] The scale ratio (e.g., 100 for 1:100)
  # @param unit [String] "metric" or "imperial"
  # @return [Float, nil] Suggested reference length in mm
  def calculate_reference_mm(scale_ratio, unit)
    return nil unless scale_ratio&.positive?

    if unit == "imperial"
      # For imperial scales, suggest a 1 foot reference
      # 1 foot = 304.8mm
      304.8
    else
      # For metric scales, suggest a 1 meter reference
      # 1 meter = 1000mm
      1000.0
    end
  end
end
