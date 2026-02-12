# frozen_string_literal: true

# DocumentClassificationService - 3-method document classification
#
# SSoT: THE ONE service for classifying documents in DocSort
#
# Runs all 3 classification methods independently and stores results for each:
#   1. Name Match — filename patterns + DocumentTypeMatcher (fast, <50ms)
#   2. Content Match — OCR/text search via ContentMatchService (100-500ms for PDFs)
#   3. AI Match — Claude Haiku when enabled (500-2000ms)
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

  # Filename patterns for common document types
  FILENAME_PATTERNS = {
    'invoice' => [
      /\binvoice\b/i, /\binv[-_.\s]?\d+/i, /\btax\s*invoice\b/i,
      /\breceipt\b/i, /\bbill\b/i
    ],
    'plan' => [
      /\bplan[s]?\b/i, /\bdrawing[s]?\b/i, /\bfloor\s*plan\b/i,
      /\bsite\s*plan\b/i, /\barchitectural\b/i, /\bstructural\b/i,
      /\belev(ation)?\b/i, /\bsection\b/i, /\bdetail[s]?\b/i,
      /\.dwg$/i, /\.dxf$/i,
      /^A[-_]?\d{2,3}/i, /^S[-_]?\d{2,3}/i, /^E[-_]?\d{2,3}/i
    ],
    'quote' => [
      /\bquote\b/i, /\bquotation\b/i, /\bestimate\b/i,
      /\bproposal\b/i, /\bprice[-_.\s]?list\b/i, /\bbudget\b/i
    ],
    'contract' => [
      /\bcontract\b/i, /\bagreement\b/i, /\bterms\b/i,
      /\bscope\s*of\s*work\b/i, /\bsow\b/i,
      /\bmaster\s*services?\s*agreement\b/i, /\bmsa\b/i
    ],
    'purchase_order' => [
      /\bpurchase[-_.\s]?order\b/i, /\bpo[-_.\s]?\d+/i, /\border[-_.\s]?\d+/i
    ],
    'work_order' => [
      /\bwork[-_.\s]?order\b/i, /\bwo[-_.\s]?\d+/i,
      /\bservice[-_.\s]?order\b/i, /\bjob[-_.\s]?sheet\b/i
    ],
    'certificate' => [
      /\bcertificate\b/i, /\bcert\b/i, /\bcompliance\b/i,
      /\binsurance\b/i, /\bwarranty\b/i, /\bguarantee\b/i,
      /\blicen[cs]e\b/i
    ],
    'compliance' => [
      /\bsafety\b/i, /\bswms\b/i, /\bmsds\b/i, /\bsds\b/i,
      /\brisk[-_.\s]?assessment\b/i, /\bmethod[-_.\s]?statement\b/i,
      /\binduction\b/i, /\btraining\b/i
    ],
    'correspondence' => [
      /\bletter\b/i, /\bmemo\b/i, /\bmeeting[-_.\s]?minutes\b/i,
      /\bminutes\b/i, /\bnotes\b/i, /\breport\b/i
    ]
  }.freeze

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
  end

  # Main classification entry point - runs all methods, picks winner
  def classify!
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
    {
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
  end

  private

  # ═══════════════════════════════════════════════════════════════
  # Method 1: Name Match (filename patterns + DocumentTypeMatcher)
  # ═══════════════════════════════════════════════════════════════
  def run_name_match
    start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    # Run filename pattern matching
    filename_result = classify_by_filename

    # Run DocumentTypeMatcher (SSoT for document type matching)
    matcher_result = classify_by_document_type_matcher

    # Also check content type hints
    type_hint = classify_by_content_type

    # Merge: take the best of filename pattern, content type, and DTM
    candidates = [filename_result, matcher_result]

    # If content type hint matches filename result, boost it
    if type_hint[:document_type] && filename_result[:document_type] == type_hint[:document_type]
      filename_result[:confidence] = [filename_result[:confidence] + 0.1, 1.0].min
      filename_result[:signals] = (filename_result[:signals] || []) + ["content_type_match"]
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
  # Method 2: Content Match (OCR text search via ContentMatchService)
  # ═══════════════════════════════════════════════════════════════
  def run_content_match
    result = ContentMatchService.new(@item).classify

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
  # Existing helpers (kept from original)
  # ═══════════════════════════════════════════════════════════════

  def classify_by_filename
    return empty_result('filename') if @filename.blank?

    matches = []

    FILENAME_PATTERNS.each do |doc_type, patterns|
      matched_patterns = patterns.select { |pattern| @filename.match?(pattern) }
      next if matched_patterns.empty?

      confidence = calculate_pattern_confidence(matched_patterns, patterns.length)

      matches << {
        document_type: doc_type,
        confidence: confidence,
        method: 'filename_pattern',
        signals: matched_patterns.map { |p| p.source.gsub(/[^a-zA-Z0-9]/, '_')[0..30] },
        classified_at: Time.current
      }
    end

    matches.max_by { |m| m[:confidence] } || empty_result('filename')
  end

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
  rescue
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
        result = PdfTextExtractionService.extract(content, pages: [1], join_pages: true)
        context[:first_page_text] = result[:text].to_s.first(2000) if result[:success]
      rescue StandardError => e
        Rails.logger.debug "[DocumentClassificationService] PDF extraction failed: #{e.message}"
      end
    end

    context
  end

  def build_classification_prompt(context)
    <<~PROMPT
      Classify this document into one of these categories:
      - invoice: Bills, tax invoices, receipts
      - plan: Construction drawings, floor plans, architectural documents
      - quote: Quotations, estimates, proposals, price lists
      - contract: Contracts, agreements, terms, scope of work
      - purchase_order: Purchase orders
      - work_order: Work orders, job sheets
      - certificate: Certificates, licenses, insurance, warranties
      - compliance: Safety documents, SWMS, risk assessments
      - correspondence: Letters, memos, meeting minutes
      - email: Email messages
      - general: Other documents

      Document info:
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

  def calculate_pattern_confidence(matched_patterns, total_patterns)
    base_confidence = 0.8
    match_bonus = (matched_patterns.length - 1) * 0.05
    [base_confidence + match_bonus, 0.95].min
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
end
