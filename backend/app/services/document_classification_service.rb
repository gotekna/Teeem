# frozen_string_literal: true

# DocumentClassificationService - 3-method document classification
#
# SSoT: THE ONE service for classifying documents in DocSort
#
# Runs all 3 classification methods independently and stores results for each:
#   1. Name Match — DocumentTypeMatcher + content type hints (fast, <50ms)
#   2. Content Match — OCR/text search via OcrPatternMatcherService (100-500ms for PDFs)
#   3. AI Match — Claude Haiku when enabled (500-2000ms)
#
# All methods use DocumentType records from the database (not hardcoded categories).
# Results are logged to AIProcessingLog for accuracy tracking and learning.
#
# The winner is picked by confidence, preferring name > content > ai on ties.
#
# classification_result JSONB structure:
#   {
#     document_type: "constitution",
#     confidence: 1.0,
#     method: "document_type_matcher",
#     winner: "name_match",
#     methods: {
#       name_match:    { document_type: ..., confidence: ..., status: "completed", ... },
#       content_match: { document_type: ..., confidence: ..., status: "completed", ... },
#       ai_match:      { document_type: ..., confidence: ..., status: "disabled", ... }
#     },
#     suggestions: [...],
#     classified_at: "..."
#   }
#
# Usage:
#   result = DocumentClassificationService.new(docsort_item).classify!
#
class DocumentClassificationService
  include AnthropicClient

  CONTENT_TYPE_HINTS = {
    'message/rfc822' => 'email',
    'application/vnd.ms-outlook' => 'email',
    '.eml' => 'email',
    '.msg' => 'email',
    '.dwg' => 'plan',
    '.dxf' => 'plan'
  }.freeze

  # Priority order for tie-breaking (lower index = higher priority)
  METHOD_PRIORITY = %w[name_match content_match ai_match].freeze

  def initialize(docsort_item)
    @item = docsort_item
    @filename = docsort_item.original_filename || ''
    @content_type = docsort_item.content_type || ''
    @subject = docsort_item.subject || ''
    # Cache active document types once - shared across all 3 methods
    @active_document_types = DocumentType.where(active: true).to_a
  end

  # Main classification entry point - runs all methods, picks winner
  def classify!
    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    # Run all 3 methods independently
    name_result = run_name_match
    content_result = run_content_match
    ai_result = run_ai_match

    methods = {
      name_match: name_result,
      content_match: content_result,
      ai_match: ai_result
    }

    # Pick the best result
    winner_key, winner_result = pick_winner(methods)

    # Build suggestions from DocumentTypeMatcher (always available from name_match)
    suggestions = name_result[:suggestions] || []

    # Build final result with backward-compatible top-level keys + new methods hash
    result = {
      document_type: winner_result[:document_type] || "general",
      confidence: winner_result[:confidence] || 0.0,
      method: winner_result[:method] || "default",
      winner: winner_key.to_s,
      methods: methods,
      signals: winner_result[:signals] || [],
      matched_document_type: winner_result[:matched_document_type],
      suggestions: suggestions,
      classified_at: Time.current
    }

    # Log to AIProcessingLog (non-blocking)
    log_classification(result, duration_ms(start_time))

    result
  end

  private

  # ═══════════════════════════════════════════════════════════════
  # Method 1: Name Match (DocumentTypeMatcher + content type hints)
  # ═══════════════════════════════════════════════════════════════
  def run_name_match
    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    # Run DocumentTypeMatcher (SSoT for document type matching from database)
    matcher_result = classify_by_document_type_matcher

    # Also check content type hints (email, CAD files)
    type_hint = classify_by_content_type

    candidates = [matcher_result]

    # If content type hint matches DTM result, boost it
    if type_hint[:document_type] && matcher_result[:document_type] == type_hint[:document_type]
      matcher_result[:confidence] = [matcher_result[:confidence] + 0.1, 1.0].min
      matcher_result[:signals] = (matcher_result[:signals] || []) + ["content_type_match"]
    elsif type_hint[:confidence] >= 0.95
      candidates << type_hint
    end

    best = candidates.max_by { |r| r[:confidence] }

    # Carry suggestions from DTM
    suggestions = matcher_result[:suggestions] || []

    {
      document_type: best[:document_type],
      confidence: best[:confidence],
      method: best[:method],
      status: "completed",
      signals: best[:signals] || [],
      matched_document_type: best[:matched_document_type] || matcher_result[:matched_document_type],
      suggestions: suggestions,
      duration_ms: duration_ms(start_time)
    }
  end

  # ═══════════════════════════════════════════════════════════════
  # Method 2: Content Match (OCR text search via OcrPatternMatcherService)
  # ═══════════════════════════════════════════════════════════════
  def run_content_match
    result = OcrPatternMatcherService.new(@item, document_types: @active_document_types).classify

    {
      document_type: result[:document_type],
      confidence: result[:confidence],
      method: "content_match",
      status: result[:status],
      signals: result[:matched_terms] || [],
      text_preview: result[:text_preview],
      reason: result[:reason],
      duration_ms: result[:duration_ms]
    }
  end

  # ═══════════════════════════════════════════════════════════════
  # Method 3: AI Match (Claude Haiku)
  # ═══════════════════════════════════════════════════════════════
  def run_ai_match
    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    unless ai_classification_enabled?
      return {
        document_type: nil,
        confidence: 0.0,
        method: "ai",
        status: "disabled",
        signals: [],
        reason: "AI classification not enabled",
        duration_ms: duration_ms(start_time)
      }
    end

    context = build_ai_context
    prompt = build_classification_prompt(context)
    response = call_claude(prompt: prompt, max_tokens: 200)
    text = extract_claude_text(response)

    result = parse_ai_response(text)

    {
      document_type: result[:document_type],
      confidence: result[:confidence],
      method: "ai",
      status: "completed",
      signals: result[:signals] || [],
      duration_ms: duration_ms(start_time)
    }
  rescue StandardError => e
    Rails.logger.error "[DocumentClassificationService] AI classification failed: #{e.message}"
    {
      document_type: nil,
      confidence: 0.0,
      method: "ai",
      status: "error",
      signals: [],
      reason: e.message,
      duration_ms: duration_ms(start_time)
    }
  end

  # ═══════════════════════════════════════════════════════════════
  # Winner Selection
  # ═══════════════════════════════════════════════════════════════
  def pick_winner(methods)
    # Only consider methods that completed with a document type
    candidates = methods.select do |_key, result|
      result[:status] == "completed" && result[:document_type].present?
    end

    # If no method found anything, return name_match as winner (will default to "general")
    return [:name_match, methods[:name_match]] if candidates.empty?

    # Sort by confidence (desc), then by priority order (asc) for tie-breaking
    winner_key = candidates.max_by do |key, result|
      priority_bonus = (METHOD_PRIORITY.length - METHOD_PRIORITY.index(key.to_s).to_i) * 0.001
      result[:confidence] + priority_bonus
    end

    [winner_key[0], winner_key[1]]
  end

  # ═══════════════════════════════════════════════════════════════
  # Helpers
  # ═══════════════════════════════════════════════════════════════

  def classify_by_content_type
    if CONTENT_TYPE_HINTS[@content_type]
      return {
        document_type: CONTENT_TYPE_HINTS[@content_type],
        confidence: 0.95,
        method: 'content_type',
        signals: ['content_type_match'],
        classified_at: Time.current
      }
    end

    extension = File.extname(@filename).downcase
    if CONTENT_TYPE_HINTS[extension]
      return {
        document_type: CONTENT_TYPE_HINTS[extension],
        confidence: 0.95,
        method: 'file_extension',
        signals: ['extension_match'],
        classified_at: Time.current
      }
    end

    empty_result('content_type')
  end

  def classify_by_document_type_matcher
    suggestions = DocumentTypeMatcher.suggest(@filename, limit: 5)
    return empty_result('document_type_matcher') if suggestions.empty?

    top_match = suggestions.first
    doc_type = map_document_type_to_docsort_type(top_match[:document_type])

    {
      document_type: doc_type,
      confidence: top_match[:confidence] / 100.0,
      method: 'document_type_matcher',
      signals: [top_match[:match_type], top_match[:matched_term]].compact,
      matched_document_type: top_match[:document_type].name,
      suggestions: suggestions.map { |s|
        {
          name: s[:document_type].name,
          confidence: s[:confidence],
          match_type: s[:match_type],
          matched_term: s[:matched_term]
        }
      },
      classified_at: Time.current
    }
  end

  def ai_classification_enabled?
    ENV['DOCSORT_AI_ENABLED'] == 'true' ||
      (defined?(TenantSetting) && TenantSetting.docsort_ai_enabled?)
  rescue StandardError => e
    Rails.logger.warn "[DocumentClassification] Failed to check AI classification setting: #{e.message}"
    false
  end

  def build_ai_context
    context = {
      filename: @filename,
      content_type: @content_type
    }

    if @item.synced_email.present?
      context[:email_subject] = @subject
      context[:email_from] = @item.from_email
    end

    if @content_type == 'application/pdf' && @item.storage_blob.present?
      begin
        content = @item.storage_blob.download
        result = OcrTextExtractorService.extract(content, pages: [1], join_pages: true)
        context[:first_page_text] = result[:text].to_s.first(2000) if result[:success]
      rescue StandardError => e
        Rails.logger.debug "[DocumentClassificationService] PDF extraction failed: #{e.message}"
      end
    end

    context
  end

  # Build AI prompt dynamically from active DocumentTypes in the database
  def build_classification_prompt(context)
    # Build category list from database
    type_lines = @active_document_types.map do |dt|
      parts = ["- #{dt.name.parameterize(separator: '_')}"]
      parts << ": #{dt.description}" if dt.description.present?
      if dt.aliases.is_a?(Array) && dt.aliases.any?
        parts << " (also known as: #{dt.aliases.first(5).join(', ')})"
      end
      parts.join
    end

    # Always include a general fallback
    unless @active_document_types.any? { |dt| dt.name.parameterize(separator: '_') == 'general' }
      type_lines << "- general: Documents that don't match any other category"
    end

    # Include learning context from recent corrections
    learning = AiProcessingLog.learning_context("document_classification", limit: 10)

    <<~PROMPT
      Classify this document into one of these categories:
      #{type_lines.join("\n")}

      #{"#{learning}\n" if learning.present?}Document info:
      Filename: #{context[:filename]}
      Content type: #{context[:content_type]}
      #{"Email subject: #{context[:email_subject]}" if context[:email_subject]}
      #{"Email from: #{context[:email_from]}" if context[:email_from]}
      #{"First page text (excerpt):\n#{context[:first_page_text]&.first(1000)}" if context[:first_page_text]}

      Respond in JSON format:
      {"document_type": "category_name", "confidence": 0.0-1.0, "reason": "brief explanation"}
    PROMPT
  end

  def parse_ai_response(response_text)
    return empty_result('ai') unless response_text.present?

    json_match = response_text.match(/\{.*\}/m)
    return empty_result('ai') unless json_match

    data = JSON.parse(json_match[0])

    {
      document_type: data['document_type'],
      confidence: data['confidence'].to_f,
      method: 'ai',
      signals: [data['reason']].compact,
      classified_at: Time.current
    }
  rescue JSON::ParserError
    empty_result('ai')
  end

  def map_document_type_to_docsort_type(document_type)
    document_type.name.parameterize(separator: '_')
  end

  def empty_result(method)
    {
      document_type: nil,
      confidence: 0.0,
      method: method,
      signals: [],
      classified_at: Time.current
    }
  end

  def duration_ms(start_time)
    ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).to_i
  end

  # Log classification result to AIProcessingLog for accuracy tracking
  def log_classification(result, total_ms)
    AiProcessingLog.create!(
      service_type: "document_classification",
      input_identifier: @filename,
      processable: @item,
      ocr_result: result.dig(:methods, :content_match),
      pattern_result: result.dig(:methods, :name_match),
      ai_result: result.dig(:methods, :ai_match),
      final_type: result[:document_type],
      final_confidence: ((result[:confidence] || 0) * 100).to_i,
      decision_method: result[:winner],
      total_duration_ms: total_ms,
      ocr_duration_ms: result.dig(:methods, :content_match, :duration_ms),
      ai_duration_ms: result.dig(:methods, :ai_match, :duration_ms)
    )
  rescue StandardError => e
    Rails.logger.error "[DocumentClassificationService] Failed to log classification: #{e.message}"
  end
end
