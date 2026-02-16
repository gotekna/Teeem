# frozen_string_literal: true

# OcrPatternMatcherService - OCR/text-based document classification
#
# Extracts first-page text from PDFs using OcrTextExtractorService (SSoT),
# then searches the extracted text for DocumentType names, aliases, and
# description keywords.
#
# Accepts an optional `document_types:` array to avoid redundant DB queries
# when called from DocumentClassificationService (which caches them).
#
# Returns:
#   - status: "completed" (found text), "not_applicable" (non-PDF), "error"
#   - document_type, confidence, matched_terms, text_preview
#
# Usage:
#   result = OcrPatternMatcherService.new(docsort_item).classify
#   result = OcrPatternMatcherService.new(docsort_item, document_types: cached_types).classify
#
class OcrPatternMatcherService
  MAX_TEXT_PREVIEW = 200

  def initialize(docsort_item, document_types: nil)
    @item = docsort_item
    @content_type = docsort_item.content_type || ""
    @document_types = document_types
  end

  def classify
    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    unless pdf?
      return {
        document_type: nil,
        confidence: 0.0,
        status: "not_applicable",
        reason: "Not a PDF file",
        duration_ms: duration_ms(start_time)
      }
    end

    unless @item.storage_blob.present?
      return {
        document_type: nil,
        confidence: 0.0,
        status: "not_applicable",
        reason: "No file content available",
        duration_ms: duration_ms(start_time)
      }
    end

    text = extract_first_page_text
    if text.blank?
      return {
        document_type: nil,
        confidence: 0.0,
        status: "completed",
        reason: "No text extracted from PDF",
        matched_terms: [],
        text_preview: "",
        duration_ms: duration_ms(start_time)
      }
    end

    match = search_text_for_document_types(text)

    {
      document_type: match[:document_type],
      confidence: match[:confidence],
      status: "completed",
      matched_terms: match[:matched_terms],
      text_preview: text.first(MAX_TEXT_PREVIEW),
      duration_ms: duration_ms(start_time)
    }
  rescue StandardError => e
    Rails.logger.error "[OcrPatternMatcher] Error: #{e.message}"
    {
      document_type: nil,
      confidence: 0.0,
      status: "error",
      reason: e.message,
      duration_ms: duration_ms(start_time)
    }
  end

  private

  def pdf?
    @content_type == "application/pdf"
  end

  def extract_first_page_text
    content = @item.storage_blob.download
    result = OcrTextExtractorService.extract(content, max_pages: 1, join_pages: true)
    result[:success] ? result[:text].to_s.strip : ""
  end

  # Use cached document types if provided, otherwise query
  def active_document_types
    @document_types || DocumentType.where(active: true).to_a
  end

  # Search extracted text for DocumentType names, aliases, and description keywords
  # Returns the best match with confidence and matched terms
  def search_text_for_document_types(text)
    normalized_text = text.downcase

    best_match = { document_type: nil, confidence: 0.0, matched_terms: [] }

    active_document_types.each do |doc_type|
      matched_terms = []

      # Check name
      if normalized_text.include?(doc_type.name.downcase)
        matched_terms << doc_type.name
      end

      # Check aliases (database JSONB array)
      if doc_type.aliases.is_a?(Array)
        doc_type.aliases.each do |a|
          next if a.blank?
          if normalized_text.include?(a.to_s.strip.downcase)
            matched_terms << a.to_s.strip
          end
        end
      end

      # Check description keywords (comma/newline/semicolon-separated)
      if doc_type.description.present?
        extract_keywords(doc_type.description).each do |keyword|
          next if keyword.length < 3
          if normalized_text.include?(keyword.downcase)
            matched_terms << keyword
          end
        end
      end

      next if matched_terms.empty?

      # Calculate confidence based on match quality
      confidence = calculate_confidence(matched_terms, doc_type, text)

      if confidence > best_match[:confidence]
        best_match = {
          document_type: doc_type.name.parameterize(separator: "_"),
          confidence: confidence,
          matched_terms: matched_terms.uniq
        }
      end
    end

    best_match
  end

  # Extract keywords from description text (split by comma, newline, semicolon)
  def extract_keywords(description)
    description.split(/[,;\n]+/).map(&:strip).reject(&:blank?)
  end

  def calculate_confidence(matched_terms, doc_type, text)
    base = 0.7

    # Exact name match in text is stronger
    if matched_terms.include?(doc_type.name)
      base = 0.85
    end

    # Multiple terms matched = higher confidence
    base += [matched_terms.length - 1, 2].min * 0.05

    # If the term appears early in the document (first 500 chars), boost confidence
    first_section = text.first(500).downcase
    if matched_terms.any? { |t| first_section.include?(t.downcase) }
      base += 0.05
    end

    [base, 0.95].min
  end

  def duration_ms(start_time)
    ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).to_i
  end
end
