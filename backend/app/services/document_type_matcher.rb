# frozen_string_literal: true

# DocumentTypeMatcher - Smart document-to-type matching with confidence scores
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: THE ONE service for matching filenames to DocumentTypes     ║
# ║                                                                    ║
# ║  Matching Priority:                                                ║
# ║    1. Exact name match → 100% confidence                          ║
# ║    2. Alias match → 90% confidence                                ║
# ║    3. Pattern match → 80% confidence                              ║
# ║    4. Fuzzy word overlap → 40-70% confidence                      ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Usage:
#   DocumentTypeMatcher.suggest("1 Constitution.docx")
#   # => [{ document_type: <Constitution>, confidence: 100, match_type: "exact" }]
#
#   DocumentTypeMatcher.suggest("Table of Forms & Documents Lodged with ASIC.docx")
#   # => [{ document_type: <Company Setup>, confidence: 90, match_type: "alias" }]
#
class DocumentTypeMatcher
  # Suggest DocumentTypes for a given filename
  # @param filename [String] The filename to match
  # @param scope [String, nil] Optional scope filter (company, job, contacts, etc.)
  # @param limit [Integer] Maximum number of suggestions (default: 5)
  # @return [Array<Hash>] Ranked suggestions with confidence scores
  def self.suggest(filename, scope: nil, limit: 5)
    new(filename, scope: scope, limit: limit).suggest
  end

  def initialize(filename, scope: nil, limit: 5)
    @filename = filename
    @scope = scope
    @limit = limit
    @normalized_filename = normalize(filename)
    @filename_words = extract_words(filename)
  end

  def suggest
    document_types = scope_filtered_types
    matches = []

    document_types.each do |dt|
      match = find_best_match(dt)
      matches << match if match
    end

    # Sort by confidence (descending), then by name
    matches
      .sort_by { |m| [-m[:confidence], m[:document_type].name] }
      .first(@limit)
  end

  private

  def scope_filtered_types
    types = DocumentType.where(active: true)
    types = types.where(scope: @scope) if @scope.present?
    types
  end

  def find_best_match(document_type)
    # Try matching strategies in priority order
    match = try_exact_match(document_type) ||
            try_alias_match(document_type) ||
            try_pattern_match(document_type) ||
            try_fuzzy_match(document_type)

    return nil unless match

    {
      document_type: document_type,
      confidence: match[:confidence],
      match_type: match[:match_type],
      matched_term: match[:matched_term]
    }
  end

  # Strategy 1: Exact name match (100% confidence)
  def try_exact_match(document_type)
    name_normalized = normalize(document_type.name)
    display_normalized = normalize(document_type.display_name) if document_type.display_name.present?

    if @normalized_filename.include?(name_normalized)
      return { confidence: 100, match_type: "exact", matched_term: document_type.name }
    end

    if display_normalized && @normalized_filename.include?(display_normalized)
      return { confidence: 100, match_type: "exact", matched_term: document_type.display_name }
    end

    nil
  end

  # Strategy 2: Alias match (90% confidence)
  # Uses word boundary matching to prevent false positives like "CT" matching "Directors"
  def try_alias_match(document_type)
    aliases = document_type.aliases || []
    aliases += DocumentType::DEFAULT_ALIASES[document_type.name] || [] if defined?(DocumentType::DEFAULT_ALIASES)

    aliases.each do |alias_term|
      alias_normalized = normalize(alias_term)
      next if alias_normalized.empty?

      # For short aliases (1-3 chars), require exact word match
      # For longer aliases, allow substring matching
      if alias_normalized.length <= 3
        # Must match as a complete word
        if @normalized_filename.split(" ").include?(alias_normalized)
          return { confidence: 90, match_type: "alias", matched_term: alias_term }
        end
      else
        # Longer aliases can match as substring
        if @normalized_filename.include?(alias_normalized)
          return { confidence: 90, match_type: "alias", matched_term: alias_term }
        end
      end
    end

    nil
  end

  # Strategy 3: Pattern match (80% confidence)
  def try_pattern_match(document_type)
    patterns = document_type.filename_patterns || []

    patterns.each do |pattern|
      begin
        regex = Regexp.new(pattern, Regexp::IGNORECASE)
        if regex.match?(@normalized_filename)
          return { confidence: 80, match_type: "pattern", matched_term: pattern }
        end
      rescue RegexpError
        # Skip invalid patterns
        Rails.logger.warn "[DocumentTypeMatcher] Invalid pattern '#{pattern}' for #{document_type.name}"
      end
    end

    nil
  end

  # Strategy 4: Fuzzy word overlap (40-70% confidence)
  def try_fuzzy_match(document_type)
    # Get words from document type name and aliases
    dt_words = extract_words(document_type.name)
    dt_words += extract_words(document_type.display_name) if document_type.display_name.present?
    (document_type.aliases || []).each { |a| dt_words += extract_words(a) }
    dt_words = dt_words.uniq

    return nil if dt_words.empty? || @filename_words.empty?

    # Calculate overlap ratio
    common_words = @filename_words & dt_words
    return nil if common_words.empty?

    # Require at least 2 matching words for fuzzy match
    return nil if common_words.length < 2

    # Calculate confidence based on overlap ratio
    overlap_ratio = common_words.length.to_f / [dt_words.length, @filename_words.length].min
    confidence = (40 + (overlap_ratio * 30)).round  # 40-70% range

    {
      confidence: confidence,
      match_type: "fuzzy",
      matched_term: common_words.join(", ")
    }
  end

  # Normalize a string for comparison
  def normalize(str)
    return "" unless str
    str.to_s
       .downcase
       .gsub(/[^a-z0-9\s]/, " ")  # Replace non-alphanumeric with space
       .gsub(/\s+/, " ")          # Collapse multiple spaces
       .strip
  end

  # Extract meaningful words from a string
  def extract_words(str)
    return [] unless str
    normalize(str)
      .split(" ")
      .reject { |w| w.length < 3 }  # Ignore short words
      .reject { |w| STOP_WORDS.include?(w) }
  end

  # Common stop words to ignore in fuzzy matching
  STOP_WORDS = %w[
    the and for with from this that are was were
    doc docx pdf txt file document documents
  ].freeze
end
