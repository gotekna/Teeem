# frozen_string_literal: true

module PlanIdentification
  # Layer 3: AI Validation
  #
  # Uses Claude Vision to:
  # 1. Extract sheet information from PDF images (sheet_number, sheet_name, etc.)
  # 2. Validate/correct pattern matching results
  #
  # Only invoked when pattern matching confidence < threshold
  #
  class AiValidationLayer
    CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

    class ExtractionResult
      attr_accessor :sheet_number, :sheet_name, :sheet_date, :sheet_issue,
                    :plan_type, :confidence, :reasoning

      def initialize(attrs = {})
        attrs.each do |key, value|
          send("#{key}=", value) if respond_to?("#{key}=")
        end
        @confidence ||= 0
      end

      def success?
        sheet_name.present? || sheet_number.present?
      end

      def to_h
        {
          sheet_number: sheet_number,
          sheet_name: sheet_name,
          sheet_date: sheet_date,
          sheet_issue: sheet_issue,
          plan_type_id: plan_type&.id,
          confidence: confidence,
          reasoning: reasoning
        }
      end
    end

    def self.extract(pdf_content, page_number: 1, plan_types: nil)
      new(plan_types).extract(pdf_content, page_number)
    end

    def self.validate(pdf_content, pattern_result:, plan_types: nil)
      new(plan_types).validate(pdf_content, pattern_result)
    end

    def initialize(plan_types = nil)
      @plan_types = plan_types || PlanType.active
    end

    def extract(pdf_content, page_number = 1)
      return empty_result("no_api_key") unless ENV["ANTHROPIC_API_KEY"].present?

      begin
        # Convert PDF to image
        image_data = pdf_to_image(pdf_content)
        return empty_result("image_conversion_failed") unless image_data

        # Call Claude Vision
        response = call_claude_for_extraction(image_data, page_number)
        build_extraction_result(response)
      rescue StandardError => e
        Rails.logger.error "[AiValidationLayer] Extraction failed: #{e.message}"
        empty_result("extraction_error: #{e.message}")
      end
    end

    def validate(pdf_content, pattern_result)
      return empty_result("no_api_key") unless ENV["ANTHROPIC_API_KEY"].present?

      begin
        image_data = pdf_to_image(pdf_content)
        return empty_result("image_conversion_failed") unless image_data

        # Call Claude Vision with pattern match context for validation
        response = call_claude_for_validation(image_data, pattern_result)
        build_validation_result(response, pattern_result)
      rescue StandardError => e
        Rails.logger.error "[AiValidationLayer] Validation failed: #{e.message}"
        empty_result("validation_error: #{e.message}")
      end
    end

    private

    def empty_result(reason)
      ExtractionResult.new(reasoning: reason)
    end

    def pdf_to_image(pdf_content)
      Tempfile.create(["plan_page", ".pdf"], binmode: true) do |pdf_file|
        pdf_file.write(pdf_content)
        pdf_file.rewind

        image = MiniMagick::Image.open(pdf_file.path)
        image.format "png"
        image.density 150
        image.resize "2000x2000>"

        image.to_blob
      end
    rescue StandardError => e
      Rails.logger.error "[AiValidationLayer] PDF to image conversion failed: #{e.message}"
      nil
    end

    def call_claude_for_extraction(image_data, page_number)
      client = Anthropic::Client.new(access_token: ENV["ANTHROPIC_API_KEY"])
      image_base64 = Base64.strict_encode64(image_data)

      response = client.messages(
        parameters: {
          model: CLAUDE_MODEL,
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: image_base64
                  }
                },
                {
                  type: "text",
                  text: build_extraction_prompt
                }
              ]
            }
          ]
        }
      )

      parse_json_response(response.dig("content", 0, "text"))
    end

    def call_claude_for_validation(image_data, pattern_result)
      client = Anthropic::Client.new(access_token: ENV["ANTHROPIC_API_KEY"])
      image_base64 = Base64.strict_encode64(image_data)

      response = client.messages(
        parameters: {
          model: CLAUDE_MODEL,
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: image_base64
                  }
                },
                {
                  type: "text",
                  text: build_validation_prompt(pattern_result)
                }
              ]
            }
          ]
        }
      )

      parse_json_response(response.dig("content", 0, "text"))
    end

    def build_extraction_prompt
      plan_type_list = @plan_types.pluck(:name).join(", ")

      <<~PROMPT
        This is an architectural/construction plan sheet. Extract the sheet information from the title block (usually in the bottom right corner or right edge).

        Return ONLY valid JSON with no additional text:
        {
          "sheet_number": "The sheet/drawing number (e.g., 'A001', 'S-101', '01', '03a')",
          "sheet_name": "The drawing type/title (e.g., 'Perspective', 'Ground Floor Plan', 'Elevation 1')",
          "sheet_date": "The date on the drawing (e.g., '15/12/2025')",
          "sheet_issue": "The issue/revision status (e.g., 'Working Drawings', 'For Construction', 'Contract Drawings')",
          "suggested_plan_type": "Best match from this list: #{plan_type_list}",
          "confidence": 85,
          "reasoning": "Brief explanation of why you chose this plan type"
        }

        CRITICAL INSTRUCTIONS:
        - sheet_name: The drawing TYPE only (e.g., "Perspective", "Ground Floor Plan", "Elevation 1", "Electrical", "Cabinetry Detail")
          Do NOT include project address or job name - just the drawing type.
        - sheet_number: Just the number/code (e.g., "01", "03a", "A3", "101-KIT")
        - sheet_date: Look for "Date:" field
        - sheet_issue: Look for "Issue:" field (e.g., "Working Drawings", "Contract Drawings", "For Construction")
        - suggested_plan_type: Pick the BEST match from the list provided
        - confidence: 0-100 how confident you are in the plan type match
        - Return null for fields you cannot find
      PROMPT
    end

    def build_validation_prompt(pattern_result)
      plan_type_list = @plan_types.pluck(:name).join(", ")
      suggested = pattern_result.plan_type&.name || "Unknown"

      <<~PROMPT
        This is an architectural/construction plan sheet. Our pattern matching system suggests this is: "#{suggested}" (#{pattern_result.confidence}% confident, reason: #{pattern_result.reason}).

        Please validate this suggestion by examining the title block.

        Return ONLY valid JSON:
        {
          "sheet_name": "The actual drawing type from the title block",
          "pattern_match_correct": true/false,
          "correct_plan_type": "If pattern match is wrong, the correct type from: #{plan_type_list}",
          "confidence": 85,
          "reasoning": "Why you agree/disagree with the pattern match"
        }
      PROMPT
    end

    def parse_json_response(text)
      return {} if text.blank?

      json_match = text.match(/\{[\s\S]*\}/)
      return {} unless json_match

      JSON.parse(json_match[0]).transform_keys(&:to_sym)
    rescue JSON::ParserError => e
      Rails.logger.error "[AiValidationLayer] JSON parse error: #{e.message}"
      {}
    end

    def build_extraction_result(response)
      plan_type = if response[:suggested_plan_type].present?
        @plan_types.find_by("LOWER(name) = ?", response[:suggested_plan_type].to_s.downcase)
      end

      ExtractionResult.new(
        sheet_number: response[:sheet_number]&.strip,
        sheet_name: response[:sheet_name]&.strip,
        sheet_date: response[:sheet_date]&.strip,
        sheet_issue: response[:sheet_issue]&.strip,
        plan_type: plan_type,
        confidence: response[:confidence] || 0,
        reasoning: response[:reasoning]
      )
    end

    def build_validation_result(response, pattern_result)
      # If AI agrees with pattern match, use pattern result's plan type
      if response[:pattern_match_correct]
        ExtractionResult.new(
          sheet_name: response[:sheet_name],
          plan_type: pattern_result.plan_type,
          confidence: [pattern_result.confidence, response[:confidence] || 85].max,
          reasoning: "AI confirmed: #{response[:reasoning]}"
        )
      else
        # AI disagrees - use its suggestion
        plan_type = if response[:correct_plan_type].present?
          @plan_types.find_by("LOWER(name) = ?", response[:correct_plan_type].to_s.downcase)
        end

        ExtractionResult.new(
          sheet_name: response[:sheet_name],
          plan_type: plan_type,
          confidence: response[:confidence] || 0,
          reasoning: "AI corrected: #{response[:reasoning]}"
        )
      end
    end
  end
end
