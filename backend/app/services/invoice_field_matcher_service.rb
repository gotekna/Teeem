# frozen_string_literal: true

# Matches AI-extracted invoice fields with exact OCR coordinates
# Compares AI interpretation with OCR text positions to provide precise locations
#
# Usage:
#   matcher = InvoiceFieldMatcherService.new(ocr_result, ai_result)
#   comparison = matcher.compare!
#   # => { fields: { invoice_number: {ai_value, ocr_value, coordinates, match_confidence} }, ... }
#
class InvoiceFieldMatcherService
  # Fields we want to match between AI and OCR
  MATCHABLE_FIELDS = %w[
    invoice_number
    invoice_date
    due_date
    subtotal
    tax_amount
    total_amount
    supplier_name
    supplier_abn
    billing_company_name
    billing_company_abn
    payment_reference
    balance_due
  ].freeze

  def initialize(ocr_result, ai_result)
    @ocr_result = ocr_result
    @ai_result = ai_result
  end

  def compare!
    return {} if @ocr_result.blank? || @ai_result.blank?
    return {} if @ocr_result[:words].blank?

    fields_comparison = {}

    MATCHABLE_FIELDS.each do |field|
      ai_value = @ai_result[field.to_sym]
      next if ai_value.blank?

      # Find matching OCR words for this field value
      match_result = find_ocr_match(ai_value.to_s, field)

      fields_comparison[field] = {
        ai_value: ai_value,
        ocr_match: match_result[:ocr_value],
        coordinates: match_result[:coordinates],
        match_confidence: match_result[:confidence],
        exact_match: match_result[:exact_match],
        ocr_words: match_result[:ocr_words]
      }
    end

    {
      fields: fields_comparison,
      overall_match_rate: calculate_match_rate(fields_comparison),
      timestamp: Time.current
    }
  end

  private

  def find_ocr_match(ai_value, field_name)
    # Clean and normalize the AI value for matching
    normalized_ai = normalize_value(ai_value, field_name)

    return no_match_result if normalized_ai.blank?

    # Build search candidates (different ways the value might appear)
    candidates = build_search_candidates(ai_value, field_name)

    # Search through OCR words for the best match
    best_match = find_best_match_in_ocr(candidates, field_name)

    best_match || no_match_result
  end

  def normalize_value(value, field_name)
    return value if value.blank?

    # Remove common formatting for matching
    normalized = value.to_s.strip

    # Field-specific normalization
    case field_name
    when "supplier_abn", "billing_company_abn"
      normalized.gsub(/\s|-/, "")  # Remove spaces and dashes from ABN
    when "subtotal", "tax_amount", "total_amount", "balance_due"
      normalized.gsub(/[$,\s]/, "")  # Remove currency symbols and commas
    when "invoice_date", "due_date"
      # Keep dates as-is for now (could parse and format consistently)
      normalized
    else
      normalized
    end
  end

  def build_search_candidates(value, field_name)
    candidates = [ value.to_s ]

    case field_name
    when "supplier_abn", "billing_company_abn"
      # ABN might appear with or without spaces: "31 632 157 941" or "31632157941"
      clean = value.to_s.gsub(/\s|-/, "")
      if clean.length == 11
        candidates << clean
        candidates << "#{clean[0..1]} #{clean[2..4]} #{clean[5..7]} #{clean[8..10]}"
      end
    when "subtotal", "tax_amount", "total_amount", "balance_due"
      # Money might appear as: 14730.15, $14,730.15, 14730, etc
      numeric = value.to_s.gsub(/[$,\s]/, "")
      candidates << numeric
      candidates << "$#{numeric}"
      # Add formatted version
      if numeric.include?(".")
        parts = numeric.split(".")
        formatted = parts[0].reverse.gsub(/(\d{3})(?=\d)/, '\1,').reverse
        candidates << "#{formatted}.#{parts[1]}"
        candidates << "$#{formatted}.#{parts[1]}"
      end
    end

    candidates.uniq
  end

  def find_best_match_in_ocr(candidates, field_name)
    best_match = nil
    best_score = 0

    @ocr_result[:words].each_with_index do |word, idx|
      candidates.each do |candidate|
        # Try exact match first
        if word[:text] == candidate
          return build_match_result(word, [ word ], candidate, 1.0, true)
        end

        # Try fuzzy matching (contains, starts with, etc.)
        if word[:text].include?(candidate) || candidate.include?(word[:text])
          score = calculate_similarity(word[:text], candidate)
          if score > best_score && score > 0.7  # Threshold for fuzzy match
            # Look at surrounding words to build complete value
            surrounding_words = get_surrounding_words(idx, 3)
            combined_text = surrounding_words.map { |w| w[:text] }.join(" ")

            if combined_text.include?(candidate) || candidate.include?(combined_text)
              best_match = build_match_result(word, surrounding_words, combined_text, score, false)
              best_score = score
            end
          end
        end
      end
    end

    best_match
  end

  def get_surrounding_words(center_idx, radius)
    start_idx = [ 0, center_idx - radius ].max
    end_idx = [ center_idx + radius, @ocr_result[:words].length - 1 ].min

    @ocr_result[:words][start_idx..end_idx]
  end

  def build_match_result(primary_word, all_words, ocr_value, confidence, exact_match)
    # Calculate bounding box encompassing all matched words
    coords = calculate_combined_coordinates(all_words)

    {
      ocr_value: ocr_value,
      coordinates: coords,
      confidence: confidence,
      exact_match: exact_match,
      ocr_words: all_words.map { |w| w[:text] }
    }
  end

  def calculate_combined_coordinates(words)
    return {} if words.empty?

    # Get the bounding box that encompasses all words
    min_x = words.map { |w| w[:x] }.min
    min_y = words.map { |w| w[:y] }.min
    max_x = words.map { |w| w[:x] + w[:width] }.max
    max_y = words.map { |w| w[:y] + w[:height] }.max

    {
      x: min_x,
      y: min_y,
      width: max_x - min_x,
      height: max_y - min_y,
      page: words.first[:page]
    }
  end

  def calculate_similarity(str1, str2)
    # Simple Levenshtein-like similarity score (0.0 to 1.0)
    # For production, could use a gem like 'fuzzy_match' or 'levenshtein'

    return 1.0 if str1 == str2
    return 0.0 if str1.blank? || str2.blank?

    # Simple containment check
    if str1.length > str2.length
      str1.include?(str2) ? 0.8 : 0.0
    else
      str2.include?(str1) ? 0.8 : 0.0
    end
  end

  def calculate_match_rate(fields_comparison)
    return 0.0 if fields_comparison.empty?

    matched_count = fields_comparison.values.count { |f| f[:exact_match] || f[:match_confidence] > 0.7 }
    total_count = fields_comparison.size

    (matched_count.to_f / total_count * 100).round(1)
  end

  def no_match_result
    {
      ocr_value: nil,
      coordinates: nil,
      confidence: 0.0,
      exact_match: false,
      ocr_words: []
    }
  end
end
