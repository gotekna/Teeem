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

    private

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
