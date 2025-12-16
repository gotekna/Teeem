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

  MONTH_NAMES = {
    "january" => "01", "february" => "02", "march" => "03", "april" => "04",
    "may" => "05", "june" => "06", "july" => "07", "august" => "08",
    "september" => "09", "october" => "10", "november" => "11", "december" => "12",
    "jan" => "01", "feb" => "02", "mar" => "03", "apr" => "04",
    "jun" => "06", "jul" => "07", "aug" => "08", "sep" => "09",
    "oct" => "10", "nov" => "11", "dec" => "12"
  }.freeze

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
      normalized
    else
      normalized
    end
  end

  def build_search_candidates(value, field_name)
    candidates = [ value.to_s, value.to_s.downcase, value.to_s.upcase ]

    case field_name
    when "supplier_abn", "billing_company_abn"
      # ABN might appear with or without spaces: "31 632 157 941" or "31632157941"
      clean = value.to_s.gsub(/\s|-/, "")
      if clean.length == 11
        candidates << clean
        candidates << "#{clean[0..1]} #{clean[2..4]} #{clean[5..7]} #{clean[8..10]}"
      end

    when "invoice_date", "due_date"
      # Handle multiple date formats
      # AI gives: 2025-12-11 or 11/12/2025
      # OCR might have: "11", "December", "2025" as separate words or "11/12/2025"
      date_str = value.to_s

      # Try to parse the date
      begin
        date = Date.parse(date_str)
        day = date.day.to_s
        month_num = date.month.to_s.rjust(2, "0")
        year = date.year.to_s

        # Add various formats the date might appear as
        candidates << day  # Just the day number to find it
        candidates << "#{day}/#{month_num}/#{year}"
        candidates << "#{day}-#{month_num}-#{year}"
        candidates << "#{day} #{Date::MONTHNAMES[date.month]} #{year}"
        candidates << Date::MONTHNAMES[date.month]  # Month name to find it
        candidates << Date::MONTHNAMES[date.month]&.downcase
      rescue ArgumentError
        # If date parsing fails, just use the raw value
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
        # Just the integer part
        candidates << parts[0]
        candidates << "$#{parts[0]}"
      end

    when "supplier_name", "billing_company_name"
      # Company names: case variations and without suffixes
      name = value.to_s
      candidates << name.upcase
      candidates << name.downcase
      # First word only (often most distinctive)
      first_word = name.split.first
      candidates << first_word if first_word
      candidates << first_word&.upcase
    end

    candidates.compact.uniq
  end

  def find_best_match_in_ocr(candidates, field_name)
    best_match = nil
    best_score = 0

    @ocr_result[:words].each_with_index do |word, idx|
      word_text = word[:text].to_s
      word_lower = word_text.downcase

      candidates.each do |candidate|
        candidate_lower = candidate.to_s.downcase

        # Try exact match first (case-insensitive)
        if word_lower == candidate_lower
          return build_match_result(word, [ word ], word_text, 1.0, true)
        end

        # Try fuzzy matching (contains, starts with, etc.) - case-insensitive
        if word_lower.include?(candidate_lower) || candidate_lower.include?(word_lower)
          score = calculate_similarity(word_lower, candidate_lower)
          if score > best_score && score > 0.6  # Lower threshold for fuzzy match
            # Look at surrounding words to build complete value
            surrounding_words = get_surrounding_words(idx, 5)
            combined_text = surrounding_words.map { |w| w[:text] }.join(" ")
            combined_lower = combined_text.downcase

            if combined_lower.include?(candidate_lower) || candidate_lower.include?(combined_lower)
              best_match = build_match_result(word, surrounding_words, combined_text, score, false)
              best_score = score
            else
              # Even if combined text doesn't match, return the single word match
              if score > best_score
                best_match = build_match_result(word, [ word ], word_text, score, false)
                best_score = score
              end
            end
          end
        end
      end
    end

    # Special handling for multi-word fields - search for first significant word
    if best_match.nil? && %w[supplier_name billing_company_name].include?(field_name)
      best_match = find_multiword_match(candidates, field_name)
    end

    # Special handling for dates - look for day + month pattern
    if best_match.nil? && %w[invoice_date due_date].include?(field_name)
      best_match = find_date_match(candidates.first, field_name)
    end

    best_match
  end

  # Find matches for multi-word values like company names
  def find_multiword_match(candidates, field_name)
    # Get the first significant word from candidates
    first_candidate = candidates.first.to_s
    significant_words = first_candidate.split.reject { |w| w.downcase.match?(/^(pty|ltd|limited|inc|the|a|an)$/) }
    return nil if significant_words.empty?

    first_word = significant_words.first&.upcase

    @ocr_result[:words].each_with_index do |word, idx|
      if word[:text].upcase == first_word
        # Found the first word, now look for following words
        surrounding = get_surrounding_words(idx, significant_words.length + 2)
        combined = surrounding.map { |w| w[:text] }.join(" ")
        return build_match_result(word, surrounding, combined, 0.85, false)
      end
    end

    nil
  end

  # Find date matches by looking for day number followed by month
  def find_date_match(date_value, field_name)
    return nil if date_value.blank?

    begin
      date = Date.parse(date_value.to_s)
      day_str = date.day.to_s
      month_name = Date::MONTHNAMES[date.month]&.downcase

      @ocr_result[:words].each_with_index do |word, idx|
        # Look for the day number
        if word[:text] == day_str || word[:text] == day_str.rjust(2, "0")
          # Check if next word is the month
          next_words = get_surrounding_words(idx, 3)
          combined_lower = next_words.map { |w| w[:text].downcase }.join(" ")

          if combined_lower.include?(month_name) || combined_lower.include?(month_name[0..2])
            return build_match_result(word, next_words, next_words.map { |w| w[:text] }.join(" "), 0.9, false)
          end
        end

        # Also look for month name first
        if word[:text].downcase == month_name || word[:text].downcase == month_name[0..2]
          surrounding = get_surrounding_words(idx, 3)
          combined = surrounding.map { |w| w[:text] }.join(" ")
          return build_match_result(word, surrounding, combined, 0.85, false)
        end
      end
    rescue ArgumentError
      nil
    end

    nil
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
