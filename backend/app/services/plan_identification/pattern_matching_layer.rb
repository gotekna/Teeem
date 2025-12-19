# frozen_string_literal: true

module PlanIdentification
  # Layer 2: Pattern Matching
  #
  # THE SINGLE SOURCE OF TRUTH for plan type matching logic.
  # All plan type matching MUST go through this layer.
  #
  # Matching priority:
  # 1. Exact match (100% confidence)
  # 2. Contains match - sheet name contains plan type name (90%)
  # 3. Partial match - plan type name contains sheet name (85%)
  # 4. Keyword match - common keywords mapped to plan types (70%)
  #
  class PatternMatchingLayer
    # Keyword mappings to plan type names
    # Order matters - more specific keywords should come first
    KEYWORD_MAPPINGS = {
      "perspective" => "PERSPECTIVE",
      "site" => "SITE PLAN",
      "slab" => "SLAB PLAN",
      "floor plan" => "FLOOR PLAN",
      "floor" => "FLOOR PLAN",
      "elevation" => "ELEVATION",
      "roof" => "ROOF PLAN",
      "electrical" => "ELECTRICAL",
      "plumbing" => "PLUMBING",
      "cabinetry" => "CABINETRY",
      "kitchen" => "KIT CABINETRY",
      "section" => "SECTION",
      "detail" => "DETAILS",
      "stormwater" => "STORMWATER",
      "drainage" => "STORMWATER",
      "landscap" => "LANDSCAPE",
      "civil" => "CIVIL",
      "structural" => "STRUCTURAL",
      "framing" => "FRAMING",
      "ceiling" => "CEILING PLAN",
      "lighting" => "LIGHTING",
      "mechanical" => "MECHANICAL",
      "hvac" => "MECHANICAL",
      "a/c" => "MECHANICAL",
      "hydraulic" => "HYDRAULIC"
    }.freeze

    class MatchResult
      attr_accessor :plan_type, :confidence, :reason

      def initialize(plan_type: nil, confidence: 0, reason: nil)
        @plan_type = plan_type
        @confidence = confidence
        @reason = reason
      end

      def matched?
        plan_type.present?
      end
    end

    def self.match(sheet_name, plan_types = nil)
      new(plan_types).match(sheet_name)
    end

    # Match from raw OCR text (longer text that may contain plan type info)
    def self.match_from_text(ocr_text, plan_types = nil)
      new(plan_types).match_from_text(ocr_text)
    end

    def initialize(plan_types = nil)
      @plan_types = plan_types || PlanType.active
    end

    def match(sheet_name)
      return MatchResult.new(reason: "blank_input") if sheet_name.blank?

      normalized = normalize(sheet_name)

      # Try exact match (100% confidence)
      plan_type = exact_match(normalized)
      return MatchResult.new(plan_type: plan_type, confidence: 100, reason: "exact_match") if plan_type

      # Try contains match - sheet name contains plan type name (90%)
      plan_type = contains_match(normalized)
      return MatchResult.new(plan_type: plan_type, confidence: 90, reason: "contains_match") if plan_type

      # Try partial match - plan type name contains sheet name (85%)
      plan_type = partial_match(normalized)
      return MatchResult.new(plan_type: plan_type, confidence: 85, reason: "partial_match") if plan_type

      # Try keyword match (70%)
      plan_type, keyword = keyword_match(normalized)
      return MatchResult.new(plan_type: plan_type, confidence: 70, reason: "keyword_match:#{keyword}") if plan_type

      # No match found
      MatchResult.new(confidence: 0, reason: "no_match")
    end

    # Match from raw OCR text (full page text extraction)
    # This analyzes longer text to find plan type indicators
    def match_from_text(ocr_text)
      return MatchResult.new(reason: "blank_input") if ocr_text.blank?

      normalized = normalize(ocr_text)

      # Strategy 1: Look for plan type names directly in text (85% confidence)
      plan_type = find_plan_type_in_text(normalized)
      if plan_type
        return MatchResult.new(plan_type: plan_type, confidence: 85, reason: "text_contains_type")
      end

      # Strategy 2: Look for keywords in text (75% confidence)
      plan_type, keyword = keyword_match(normalized)
      if plan_type
        return MatchResult.new(plan_type: plan_type, confidence: 75, reason: "text_keyword:#{keyword}")
      end

      # Strategy 3: Extract title block patterns (70% confidence)
      # Look for common patterns like "Drawing: Floor Plan" or "Sheet: Elevation"
      sheet_name = extract_sheet_name_from_text(normalized)
      if sheet_name.present?
        result = match(sheet_name)
        if result.matched?
          # Reduce confidence slightly since we're extracting from raw text
          return MatchResult.new(
            plan_type: result.plan_type,
            confidence: [result.confidence - 10, 60].max,
            reason: "extracted_sheet:#{result.reason}"
          )
        end
      end

      # No match found
      MatchResult.new(confidence: 0, reason: "no_match_in_text")
    end

    private

    # Find plan type names directly in the text
    def find_plan_type_in_text(normalized)
      @plan_types.each do |plan_type|
        plan_name = plan_type.name.downcase
        # Look for the plan type name as a complete phrase
        if normalized.include?(plan_name)
          return plan_type
        end
      end
      nil
    end

    # Extract sheet name from common title block patterns
    def extract_sheet_name_from_text(text)
      # Common patterns in architectural drawings
      patterns = [
        /(?:drawing|sheet|dwg|title)[\s:]+([a-z0-9\s]+(?:plan|elevation|section|detail|schedule|perspective))/i,
        /(?:drawing|sheet|dwg|title)[\s:]+([a-z0-9\s]{3,30})/i,
        /^([a-z]+\s+(?:plan|elevation|section|detail|schedule|perspective))/i
      ]

      patterns.each do |pattern|
        match = text.match(pattern)
        return match[1].strip if match
      end

      nil
    end

    def normalize(text)
      text.to_s.downcase.strip
    end

    def exact_match(normalized)
      @plan_types.find_by("LOWER(name) = ?", normalized)
    end

    def contains_match(normalized)
      # Sheet name contains the plan type name
      # e.g., "Ground Floor Plan" contains "FLOOR PLAN"
      @plan_types.find_by("LOWER(?) LIKE '%' || LOWER(name) || '%'", normalized)
    end

    def partial_match(normalized)
      # Plan type name contains the sheet name
      # e.g., "FLOOR PLAN" contains "floor"
      @plan_types.find_by("LOWER(name) LIKE ?", "%#{normalized}%")
    end

    def keyword_match(normalized)
      KEYWORD_MAPPINGS.each do |keyword, plan_type_name|
        if normalized.include?(keyword)
          plan_type = @plan_types.find_by("LOWER(name) = ?", plan_type_name.downcase)
          return [plan_type, keyword] if plan_type
        end
      end
      [nil, nil]
    end
  end
end
