# frozen_string_literal: true

# Orchestrates the AI processing pipeline for all services
#
# Pipeline:
#   Layer 1: OCR Text Extraction (if enabled)
#   Layer 2: Pattern Matching (service-specific)
#   Layer 3: AI Validation (if confidence < threshold)
#   Decision Engine: Choose best result
#
# Usage:
#   pipeline = AiProcessingPipeline.new(service_type: 'plan_identification', processable: job_plan)
#   result = pipeline.process(pdf_content, filename: 'Floor Plan.pdf')
#
class AiProcessingPipeline
  attr_reader :config, :log

  def initialize(service_type:, processable: nil)
    @service_type = service_type
    @processable = processable
    @config = AiServiceConfig.for(service_type)
    @log = AiProcessingLog.new(
      service_type: service_type,
      processable: processable
    )
  end

  # Process PDF content through the pipeline
  def process(pdf_content, filename: nil, context: {})
    @log.input_identifier = filename
    @context = context
    start_time = monotonic_time

    # Layer 1: OCR Text Extraction
    ocr_result = run_ocr_layer(pdf_content)

    # Layer 2: Pattern Matching
    pattern_result = run_pattern_layer(ocr_result)

    # Layer 3: AI Validation (if needed)
    ai_result = run_ai_layer(pdf_content, pattern_result)

    # Decision Engine
    final = decide(ocr_result, pattern_result, ai_result)

    # Save log
    @log.final_type = final[:type]
    @log.final_confidence = final[:confidence]
    @log.decision_method = final[:method]
    @log.total_duration_ms = duration_ms(start_time)
    @log.save!

    # Return result with log reference
    build_result(final, ocr_result, pattern_result, ai_result)
  end

  private

  # Layer 1: OCR Text Extraction
  def run_ocr_layer(pdf_content)
    return nil unless @config.ocr_enabled?

    start_time = monotonic_time
    result = PdfTextExtractionService.extract(pdf_content)

    @log.ocr_result = result
    @log.ocr_duration_ms = duration_ms(start_time)

    result
  end

  # Layer 2: Pattern Matching (service-specific)
  def run_pattern_layer(ocr_result)
    return nil unless ocr_result&.dig(:success) && ocr_result[:text].present?

    case @service_type
    when "plan_identification"
      run_plan_pattern_matching(ocr_result[:text])
    when "document_verification"
      run_document_pattern_matching(ocr_result[:text])
    else
      nil
    end
  end

  # Layer 3: AI Validation
  def run_ai_layer(pdf_content, pattern_result)
    confidence = pattern_result&.dig(:confidence) || 0
    return nil unless @config.should_call_ai?(confidence)

    start_time = monotonic_time
    result = case @service_type
    when "plan_identification"
      run_plan_ai_validation(pdf_content)
    when "document_verification"
      run_document_ai_validation(pdf_content)
    when "invoice_parsing"
      run_invoice_ai_validation(pdf_content)
    else
      nil
    end

    if result
      @log.ai_result = result
      @log.ai_duration_ms = duration_ms(start_time)
    end

    result
  end

  # Plan Identification: Pattern Matching
  def run_plan_pattern_matching(text)
    plan_types = PlanType.active.to_a
    result = PlanIdentification::PatternMatchingLayer.match_from_text(text, plan_types)

    pattern_data = {
      matched: result.plan_type.present?,
      type: result.plan_type&.name,
      type_id: result.plan_type&.id,
      confidence: result.confidence,
      reason: result.reason
    }

    @log.pattern_result = pattern_data
    pattern_data
  end

  # Plan Identification: AI Validation
  def run_plan_ai_validation(pdf_content)
    plan_types = PlanType.active.to_a
    result = PlanIdentification::AiValidationLayer.extract(
      pdf_content,
      plan_types: plan_types
    )

    {
      type: result.plan_type&.name,
      type_id: result.plan_type&.id,
      confidence: result.confidence,
      reasoning: result.reasoning,
      sheet_number: result.sheet_number,
      sheet_name: result.sheet_name,
      sheet_date: result.sheet_date,
      sheet_issue: result.sheet_issue
    }
  end

  # Document Verification: Pattern Matching
  def run_document_pattern_matching(text)
    # TODO: Implement document type pattern matching
    # For now, return no match - AI will handle it
    { matched: false, confidence: 0 }
  end

  # Document Verification: AI Validation
  def run_document_ai_validation(pdf_content)
    # TODO: Integrate with DocumentVerificationService
    # For now, return nil to skip AI
    nil
  end

  # Invoice Parsing: AI Validation
  def run_invoice_ai_validation(pdf_content)
    # TODO: Integrate with InvoiceParsingService
    # For now, return nil to skip AI
    nil
  end

  # Decision Engine: Choose best result
  def decide(ocr_result, pattern_result, ai_result)
    # Priority 1: AI result with high confidence
    if ai_result && ai_result[:confidence].to_i >= 80
      return {
        type: ai_result[:type],
        type_id: ai_result[:type_id],
        confidence: ai_result[:confidence],
        method: "ai_validated",
        ai_data: ai_result
      }
    end

    # Priority 2: Pattern match succeeded
    if pattern_result && pattern_result[:matched]
      method = ai_result ? "ocr_plus_ai" : "ocr_only"
      return {
        type: pattern_result[:type],
        type_id: pattern_result[:type_id],
        confidence: pattern_result[:confidence],
        method: method,
        pattern_data: pattern_result
      }
    end

    # Priority 3: AI result with any confidence
    if ai_result && ai_result[:type].present?
      return {
        type: ai_result[:type],
        type_id: ai_result[:type_id],
        confidence: ai_result[:confidence],
        method: "ai_only",
        ai_data: ai_result
      }
    end

    # No result
    {
      type: nil,
      type_id: nil,
      confidence: 0,
      method: "failed"
    }
  end

  # Build final result object
  def build_result(final, ocr_result, pattern_result, ai_result)
    {
      success: final[:type].present?,
      type: final[:type],
      type_id: final[:type_id],
      confidence: final[:confidence],
      method: final[:method],
      log_id: @log.id,
      ocr: ocr_result ? {
        success: ocr_result[:success],
        text_length: ocr_result[:text]&.length || 0,
        page_count: ocr_result[:page_count],
        duration_ms: @log.ocr_duration_ms
      } : nil,
      pattern: pattern_result,
      ai: ai_result ? {
        type: ai_result[:type],
        confidence: ai_result[:confidence],
        sheet_info: {
          number: ai_result[:sheet_number],
          name: ai_result[:sheet_name],
          date: ai_result[:sheet_date],
          issue: ai_result[:sheet_issue]
        },
        duration_ms: @log.ai_duration_ms
      } : nil,
      total_duration_ms: @log.total_duration_ms
    }
  end

  def monotonic_time
    Process.clock_gettime(Process::CLOCK_MONOTONIC)
  end

  def duration_ms(start_time)
    ((monotonic_time - start_time) * 1000).to_i
  end
end
