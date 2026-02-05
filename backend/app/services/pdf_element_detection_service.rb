# frozen_string_literal: true

# PdfElementDetectionService - AI-powered detection of architectural elements from PDF plans
#
# Uses Claude vision to analyze construction drawings and detect walls, doors, windows,
# and other elements that can be converted to measurements.
#
# Usage:
#   service = PdfElementDetectionService.new
#   result = service.detect_elements(image_base64: base64_data)
#   # => { elements: [{ type: "wall", points: [...], length_estimate: 5.2 }, ...] }
#
class PdfElementDetectionService
  include AnthropicClient

  # Use Sonnet for vision tasks
  self.default_claude_model = CLAUDE_SONNET

  ELEMENT_TYPES = %w[wall door window opening stair column beam].freeze

  SYSTEM_PROMPT = <<~PROMPT
    You are an expert at reading architectural and construction drawings. Your task is to identify and locate architectural elements in floor plans.

    Elements to detect:
    - **Walls**: Both internal and external walls. Look for thick lines, hatched areas, or parallel lines.
    - **Doors**: Look for door swings (arcs), door symbols, or gaps in walls with door indicators.
    - **Windows**: Look for window symbols (usually thin lines crossing walls) or glass indicators.
    - **Openings**: Doorless openings or pass-throughs between spaces.
    - **Stairs**: Look for step patterns, stair symbols, or arrows indicating up/down.
    - **Columns**: Look for filled squares/circles, structural grid intersections.
    - **Beams**: Look for dashed lines, beam notation, or structural elements.

    For each element found, provide:
    1. Type of element
    2. Approximate location as a bounding box (normalized 0-1 coordinates relative to image)
    3. For linear elements (walls, beams): estimated length in drawing units if visible
    4. For openings (doors, windows): estimated width if visible
    5. Confidence level (0-1)
    6. Any notes (e.g., "internal wall", "sliding door", "fixed window")

    Return your analysis as JSON with this structure:
    {
      "detected": true/false,
      "element_count": number,
      "elements": [
        {
          "id": "unique_id",
          "type": "wall|door|window|opening|stair|column|beam",
          "bbox": { "x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0 },
          "points": [{"x": 0.0-1.0, "y": 0.0-1.0}, ...],
          "estimated_value": number_or_null,
          "estimated_unit": "m|mm|ft|in|null",
          "confidence": 0.0-1.0,
          "notes": "description"
        }
      ],
      "drawing_info": {
        "has_dimensions": true/false,
        "has_scale_bar": true/false,
        "drawing_type": "floor_plan|elevation|section|detail|other",
        "notes": "any observations about the drawing"
      }
    }

    Focus on accuracy over completeness - it's better to confidently identify fewer elements than to guess at uncertain ones.
  PROMPT

  # Detect architectural elements from an image of a PDF page
  #
  # @param image_base64 [String] Base64 encoded image data
  # @param media_type [String] Image MIME type (image/png, image/jpeg)
  # @param element_types [Array<String>] Optional filter for specific element types
  # @return [Hash] Detection result with elements array
  def detect_elements(image_base64:, media_type: "image/png", element_types: nil)
    filter_types = element_types&.select { |t| ELEMENT_TYPES.include?(t) } || ELEMENT_TYPES

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
        text: build_detection_prompt(filter_types)
      }
    ]

    response = call_claude_with_content(
      content: content,
      system: SYSTEM_PROMPT,
      max_tokens: 2000
    )

    result = parse_claude_json(response)

    # Normalize and validate the result
    normalize_result(result)
  rescue StandardError => e
    Rails.logger.error "[PdfElementDetectionService] Error detecting elements: #{e.message}"
    {
      detected: false,
      element_count: 0,
      elements: [],
      error: e.message
    }
  end

  # Detect elements from a specific region of the drawing
  #
  # @param image_base64 [String] Base64 encoded image of the region
  # @param media_type [String] Image MIME type
  # @param element_types [Array<String>] Optional filter for specific element types
  # @return [Hash] Detection result
  def detect_elements_in_region(image_base64:, media_type: "image/png", element_types: nil, region_description: "selected area")
    filter_types = element_types&.select { |t| ELEMENT_TYPES.include?(t) } || ELEMENT_TYPES

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
        text: "This is the #{region_description} of a construction drawing. " + build_detection_prompt(filter_types)
      }
    ]

    response = call_claude_with_content(
      content: content,
      system: SYSTEM_PROMPT,
      max_tokens: 2000
    )

    result = parse_claude_json(response)
    normalize_result(result)
  rescue StandardError => e
    Rails.logger.error "[PdfElementDetectionService] Error detecting elements in region: #{e.message}"
    {
      detected: false,
      element_count: 0,
      elements: [],
      error: e.message
    }
  end

  private

  # Build the detection prompt with optional type filtering
  def build_detection_prompt(filter_types)
    if filter_types.length < ELEMENT_TYPES.length
      "Analyze this construction drawing and identify the following elements: #{filter_types.join(', ')}. " \
        "Return the result as JSON with element locations and details."
    else
      "Analyze this construction drawing and identify all architectural elements (walls, doors, windows, openings, stairs, columns, beams). " \
        "Return the result as JSON with element locations and details."
    end
  end

  # Normalize the detection result
  def normalize_result(result)
    elements = (result[:elements] || []).map.with_index do |element, idx|
      normalize_element(element, idx)
    end

    {
      detected: elements.any?,
      element_count: elements.length,
      elements: elements,
      drawing_info: result[:drawing_info] || {},
      raw_response: result
    }
  end

  # Normalize a single element
  def normalize_element(element, index)
    {
      id: element[:id] || "element_#{index + 1}",
      type: normalize_element_type(element[:type]),
      bbox: normalize_bbox(element[:bbox]),
      points: normalize_points(element[:points]),
      estimated_value: element[:estimated_value]&.to_f,
      estimated_unit: element[:estimated_unit],
      confidence: (element[:confidence]&.to_f || 0.5).clamp(0.0, 1.0),
      notes: element[:notes]
    }
  end

  # Normalize element type to known types
  def normalize_element_type(type)
    type_str = type.to_s.downcase.strip
    ELEMENT_TYPES.find { |t| type_str.include?(t) } || "other"
  end

  # Normalize bounding box coordinates
  def normalize_bbox(bbox)
    return nil unless bbox.is_a?(Hash)

    {
      x: (bbox[:x] || bbox["x"])&.to_f&.clamp(0.0, 1.0) || 0.0,
      y: (bbox[:y] || bbox["y"])&.to_f&.clamp(0.0, 1.0) || 0.0,
      width: (bbox[:width] || bbox["width"])&.to_f&.clamp(0.0, 1.0) || 0.1,
      height: (bbox[:height] || bbox["height"])&.to_f&.clamp(0.0, 1.0) || 0.1
    }
  end

  # Normalize points array
  def normalize_points(points)
    return [] unless points.is_a?(Array)

    points.map do |point|
      next nil unless point.is_a?(Hash)

      {
        x: (point[:x] || point["x"])&.to_f&.clamp(0.0, 1.0) || 0.0,
        y: (point[:y] || point["y"])&.to_f&.clamp(0.0, 1.0) || 0.0
      }
    end.compact
  end
end
