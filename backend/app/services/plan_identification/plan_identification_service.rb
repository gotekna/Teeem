# frozen_string_literal: true

module PlanIdentification
  # ============================================================================
  # THE SINGLE SOURCE OF TRUTH FOR PLAN IDENTIFICATION
  # ============================================================================
  #
  # All plan type/category identification MUST go through this service.
  #
  # Usage:
  #   result = PlanIdentificationService.identify(pdf_content, job)
  #   result = PlanIdentificationService.identify_from_text(sheet_name, job)
  #   result = PlanIdentificationService.reidentify(job_plan)
  #
  # Pipeline:
  #   Layer 1: OCR Extraction (future - Phase 2)
  #   Layer 2: Pattern Matching (current - uses fuzzy string matching)
  #   Layer 3: AI Validation (when confidence < threshold)
  #   Layer 4: Decision Engine (combines layer outputs)
  #   Layer 5: Learning Loop (future - Phase 5)
  #
  # SSoT Enforcement:
  #   - PlanSetService → MUST use this service
  #   - PlanAiAnalysisJob → MUST use this service
  #   - JobPlansController → MUST use this service
  #   - Any future plan identification → MUST use this service
  #
  class PlanIdentificationService
    # Confidence thresholds (defaults - can be overridden by AiServiceConfig)
    AUTO_ASSIGN_THRESHOLD = 95       # Auto-assign without review
    SPOT_CHECK_THRESHOLD = 80        # Auto-assign but flag for spot-check
    REVIEW_THRESHOLD = 60            # Auto-assign but queue for review
    HUMAN_REQUIRED_THRESHOLD = 60    # Below this, require human review

    SERVICE_TYPE = "plan_identification"

    def self.identify(pdf_content, job, page_number: 1, processable: nil)
      new(job).identify_from_pdf(pdf_content, page_number, processable: processable)
    end

    def self.identify_from_text(sheet_name, job)
      new(job).identify_from_text(sheet_name)
    end

    def self.reidentify(job_plan)
      new(job_plan.job).reidentify_plan(job_plan)
    end

    def initialize(job)
      @job = job
      @plan_types = PlanType.active
      @config = AiServiceConfig.for(SERVICE_TYPE)
    end

    # Identify from PDF content (full pipeline)
    # Uses AiProcessingPipeline with configurable OCR/AI settings
    def identify_from_pdf(pdf_content, page_number = 1, processable: nil)
      Rails.logger.info "[PlanIdentificationService] Starting identification for page #{page_number}"

      # Use the configurable pipeline
      pipeline = AiProcessingPipeline.new(
        service_type: SERVICE_TYPE,
        processable: processable
      )

      # Run the pipeline
      pipeline_result = pipeline.process(pdf_content, filename: processable&.try(:file_name))

      # Extract plan type from result
      plan_type_id = pipeline_result[:type_id]
      final_plan_type = plan_type_id ? @plan_types.find_by(id: plan_type_id) : nil

      # If pipeline didn't find a type but has AI data, try to match
      if final_plan_type.nil? && pipeline_result[:ai]
        ai_type = pipeline_result.dig(:ai, :type)
        final_plan_type = @plan_types.find_by("LOWER(name) = ?", ai_type&.downcase) if ai_type
      end

      # Get sheet info from AI result
      sheet_info = pipeline_result.dig(:ai, :sheet_info) || {}

      # Calculate status
      confidence = pipeline_result[:confidence] || 0
      status = determine_status(confidence)

      # Find matching job_plan_tab based on plan type
      job_plan_tab = find_job_plan_tab(final_plan_type)

      # Build result
      result = Result.new(
        plan_type: final_plan_type,
        plan_category: final_plan_type&.plan_categories&.first,
        job_plan_tab: job_plan_tab,
        confidence: confidence,
        status: status,
        display_name: sheet_info[:name],
        short_name: build_short_name_from_pipeline(sheet_info),
        sheet_number: sheet_info[:number],
        sheet_name: sheet_info[:name],
        sheet_date: sheet_info[:date],
        sheet_issue: sheet_info[:issue],
        match_reason: pipeline_result[:method],
        ai_invoked: pipeline_result[:ai].present?,
        log_id: pipeline_result[:log_id]
      )

      log_identification_result(result, pipeline_result)

      result
    end

    # Legacy method - direct AI identification (bypasses OCR layer)
    # Use this when you specifically want AI-only processing
    def identify_from_pdf_legacy(pdf_content, page_number = 1)
      Rails.logger.info "[PlanIdentificationService] Legacy identification for page #{page_number}"

      # Layer 3 first: AI extracts sheet info from PDF
      ai_result = AiValidationLayer.extract(pdf_content, page_number: page_number, plan_types: @plan_types)

      # If AI extracted a sheet name, run pattern matching on it
      pattern_result = if ai_result.sheet_name.present?
        PatternMatchingLayer.match(ai_result.sheet_name, @plan_types)
      else
        PatternMatchingLayer::MatchResult.new(reason: "no_sheet_name")
      end

      # Determine final plan type (prefer pattern match, fallback to AI suggestion)
      final_plan_type = pattern_result.plan_type || ai_result.plan_type

      # Calculate combined confidence
      confidence = calculate_confidence(pattern_result, ai_result)

      # Determine status
      status = determine_status(confidence)

      # Find matching job_plan_tab based on plan type
      job_plan_tab = find_job_plan_tab(final_plan_type)

      # Build result
      Result.new(
        plan_type: final_plan_type,
        plan_category: final_plan_type&.plan_categories&.first,
        job_plan_tab: job_plan_tab,
        confidence: confidence,
        status: status,
        display_name: ai_result.sheet_name,
        short_name: build_short_name(ai_result),
        sheet_number: ai_result.sheet_number,
        sheet_name: ai_result.sheet_name,
        sheet_date: ai_result.sheet_date,
        sheet_issue: ai_result.sheet_issue,
        match_reason: pattern_result.reason,
        ai_invoked: true
      )
    end

    # Identify from text only (pattern matching, optionally invoke AI)
    def identify_from_text(sheet_name, invoke_ai: false)
      Rails.logger.info "[PlanIdentificationService] Identifying from text: #{sheet_name}"

      # Layer 2: Pattern matching
      pattern_result = PatternMatchingLayer.match(sheet_name, @plan_types)

      # Determine final plan type
      final_plan_type = pattern_result.plan_type

      # Find matching job_plan_tab
      job_plan_tab = find_job_plan_tab(final_plan_type)

      # Determine status
      status = determine_status(pattern_result.confidence)

      Result.new(
        plan_type: final_plan_type,
        plan_category: final_plan_type&.plan_categories&.first,
        job_plan_tab: job_plan_tab,
        confidence: pattern_result.confidence,
        status: status,
        display_name: sheet_name,
        sheet_name: sheet_name,
        match_reason: pattern_result.reason,
        ai_invoked: false
      )
    end

    # Re-identify an existing job plan (download PDF and run full pipeline)
    def reidentify_plan(job_plan)
      revision = job_plan.current_revision
      return nil unless revision&.sharepoint_file_id.present?

      # Download the file from SharePoint
      credential = OrganizationSharePointCredential.active_credential
      return nil unless credential

      client = MicrosoftGraphClient.new(credential)
      content = client.download_file(revision.sharepoint_file_id)
      return nil unless content

      identify_from_pdf(content, 1)
    end

    # Find the next available variant suffix for a plan type
    # Returns nil if no suffix needed (first use of this type)
    # Returns 'a', 'b', 'c', ... if type already exists
    def self.find_variant_suffix(job, plan_type_id, exclude_plan_id: nil)
      existing_suffixes = job.job_plans
        .where(plan_type_id: plan_type_id)
        .then { |scope| exclude_plan_id ? scope.where.not(id: exclude_plan_id) : scope }
        .pluck(:variant_suffix)

      return nil if existing_suffixes.empty?

      ('a'..'z').each do |suffix|
        return suffix unless existing_suffixes.include?(suffix)
      end

      "z#{existing_suffixes.count + 1}"
    end

    private

    def calculate_confidence(pattern_result, ai_result)
      # Weight pattern matching more heavily when it's confident
      if pattern_result.matched?
        # Boost confidence if AI agrees
        if ai_result.plan_type == pattern_result.plan_type
          [pattern_result.confidence + 10, 100].min
        else
          pattern_result.confidence
        end
      elsif ai_result.plan_type.present?
        # Use AI confidence when pattern didn't match
        [ai_result.confidence, 85].min  # Cap AI-only at 85%
      else
        0
      end
    end

    def determine_status(confidence)
      case confidence
      when AUTO_ASSIGN_THRESHOLD..100
        "auto_assigned"
      when SPOT_CHECK_THRESHOLD...AUTO_ASSIGN_THRESHOLD
        "spot_check"
      when REVIEW_THRESHOLD...SPOT_CHECK_THRESHOLD
        "needs_review"
      else
        "human_required"
      end
    end

    def find_job_plan_tab(plan_type)
      return nil unless plan_type.present?

      category_ids = plan_type.plan_categories.pluck(:id)
      return nil if category_ids.empty?

      @job.job_plan_tabs.find_by(plan_category_id: category_ids)
    end

    def build_short_name(ai_result)
      parts = []
      parts << ai_result.sheet_number if ai_result.sheet_number.present?
      parts << ai_result.sheet_name if ai_result.sheet_name.present?
      parts.join(" - ").presence
    end

    def build_short_name_from_pipeline(sheet_info)
      parts = []
      parts << sheet_info[:number] if sheet_info[:number].present?
      parts << sheet_info[:name] if sheet_info[:name].present?
      parts.join(" - ").presence
    end

    def log_identification(result, pattern_result, ai_result)
      Rails.logger.info(
        "[PlanIdentificationService] Identified: " \
        "plan_type=#{result.plan_type&.name || 'none'}, " \
        "confidence=#{result.confidence}%, " \
        "status=#{result.status}, " \
        "pattern=#{pattern_result.reason}, " \
        "ai_invoked=#{result.ai_invoked}"
      )
    end

    def log_identification_result(result, pipeline_result)
      Rails.logger.info(
        "[PlanIdentificationService] Pipeline result: " \
        "plan_type=#{result.plan_type&.name || 'none'}, " \
        "confidence=#{result.confidence}%, " \
        "status=#{result.status}, " \
        "method=#{pipeline_result[:method]}, " \
        "ocr=#{pipeline_result[:ocr] ? 'yes' : 'no'}, " \
        "ai=#{pipeline_result[:ai] ? 'yes' : 'no'}, " \
        "log_id=#{pipeline_result[:log_id]}"
      )
    end
  end
end
