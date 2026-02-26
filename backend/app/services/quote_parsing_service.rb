# frozen_string_literal: true

# QuoteParsingService - Extract structured data from supplier quote PDFs using AI
#
# Lightweight service for custom quote responses. Uses Claude Haiku for fast
# extraction (~1-2s) of key quote fields from small (1-5 page) PDFs.
#
# Usage:
#   result = QuoteParsingService.new.extract!(warehouse_document)
#   # => { price_quoted: 12500.0, quote_number: "QR-2024-87", ... }
#
class QuoteParsingService
  include AnthropicClient

  class ExtractionError < StandardError; end

  def extract!(warehouse_document)
    blob = warehouse_document.storage_blob
    raise ExtractionError, "No storage blob attached" unless blob

    Rails.logger.info "[QuoteParsing] Starting extraction for WarehouseDocument ##{warehouse_document.id}"

    # Extract text from PDF
    content = blob.download
    raise ExtractionError, "Failed to download document" unless content.present?

    ocr_result = OcrTextExtractorService.extract(content, join_pages: true, max_pages: 5)
    text = ocr_result[:text]

    if text.blank?
      Rails.logger.warn "[QuoteParsing] No text extracted from document"
      return empty_result
    end

    # Call Claude Haiku for fast extraction
    response = call_claude(
      prompt: build_prompt(text),
      model: CLAUDE_HAIKU,
      max_tokens: 2000
    )

    result = parse_claude_json(response)
    normalize_result(result)
  rescue StandardError => e
    Rails.logger.error "[QuoteParsing] Error extracting WarehouseDocument ##{warehouse_document&.id}: #{e.message}"
    empty_result.merge(error: e.message)
  end

  private

  def build_prompt(text)
    <<~PROMPT
      Extract quote/pricing details from this supplier quote document. Return ONLY valid JSON with no additional text.

      Document Content:
      #{text.truncate(6000)}

      Extract and return this exact JSON structure:
      {
        "price_quoted": total_amount_as_number_ex_gst_if_possible_or_null,
        "quote_number": "quote or reference number string or null",
        "valid_to": "YYYY-MM-DD format expiry date or null",
        "notes_summary": "brief summary of key terms: payment terms, lead time, inclusions/exclusions (max 200 chars) or null",
        "line_items": [
          {"description": "item description", "amount": numeric_amount}
        ],
        "confidence": 0.0_to_1.0
      }

      Important:
      - price_quoted should be the total ex-GST if distinguishable, otherwise the total amount
      - Dates must be YYYY-MM-DD format
      - All amounts should be numbers, not strings
      - Return null for fields you cannot find
      - line_items should capture the main pricing breakdown if available (top-level items only)
      - confidence should reflect certainty about the extracted price

      Return ONLY the JSON, no explanations.
    PROMPT
  end

  def normalize_result(result)
    return empty_result if result.blank?

    {
      priceQuoted: safe_float(result[:price_quoted]),
      quoteNumber: result[:quote_number].presence,
      validTo: safe_date(result[:valid_to]),
      notesSummary: result[:notes_summary].presence,
      lineItems: normalize_line_items(result[:line_items]),
      confidence: (result[:confidence] || 0).to_f.clamp(0, 1)
    }
  end

  def normalize_line_items(items)
    return [] unless items.is_a?(Array)

    items.filter_map do |item|
      next unless item.is_a?(Hash) && item[:description].present?

      {
        description: item[:description].to_s.truncate(200),
        amount: safe_float(item[:amount])
      }
    end
  end

  def safe_float(val)
    return nil if val.blank?
    Float(val)
  rescue ArgumentError, TypeError
    nil
  end

  def safe_date(val)
    return nil if val.blank?
    Date.parse(val.to_s).to_s
  rescue ArgumentError
    nil
  end

  def empty_result
    {
      priceQuoted: nil,
      quoteNumber: nil,
      validTo: nil,
      notesSummary: nil,
      lineItems: [],
      confidence: 0
    }
  end
end
