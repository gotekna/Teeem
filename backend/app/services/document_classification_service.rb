# frozen_string_literal: true

# DocumentClassificationService - 3-layer document classification
#
# SSoT: THE ONE service for classifying documents in DocSort
#
# Classification Layers (in priority order):
#   1. Filename patterns (fast, high confidence) - 95% confidence
#   2. DocumentTypeMatcher (SSoT pattern matching) - 80-100% confidence
#   3. AI (Claude Haiku) for uncertain cases - variable confidence
#
# Usage:
#   result = DocumentClassificationService.new(docsort_item).classify!
#   # => { document_type: "invoice", confidence: 0.95, method: "filename_pattern", ... }
#
class DocumentClassificationService
  # Filename patterns for common document types (Layer 1)
  # These are highly reliable - file naming conventions are consistent
  FILENAME_PATTERNS = {
    # Invoices
    'invoice' => [
      /\binvoice\b/i,
      /\binv[-_.\s]?\d+/i,
      /\btax\s*invoice\b/i,
      /\breceipt\b/i,
      /\bbill\b/i
    ],

    # Plans/Drawings
    'plan' => [
      /\bplan[s]?\b/i,
      /\bdrawing[s]?\b/i,
      /\bfloor\s*plan\b/i,
      /\bsite\s*plan\b/i,
      /\barchitectural\b/i,
      /\bstructural\b/i,
      /\belev(ation)?\b/i,
      /\bsection\b/i,
      /\bdetail[s]?\b/i,
      /\.dwg$/i,
      /\.dxf$/i,
      /^A[-_]?\d{2,3}/i,  # A01, A-02, etc (architectural numbering)
      /^S[-_]?\d{2,3}/i,  # S01, S-02, etc (structural numbering)
      /^E[-_]?\d{2,3}/i   # E01, E-02, etc (electrical numbering)
    ],

    # Quotes/Estimates
    'quote' => [
      /\bquote\b/i,
      /\bquotation\b/i,
      /\bestimate\b/i,
      /\bproposal\b/i,
      /\bprice[-_.\s]?list\b/i,
      /\bbudget\b/i
    ],

    # Contracts
    'contract' => [
      /\bcontract\b/i,
      /\bagreement\b/i,
      /\bterms\b/i,
      /\bscope\s*of\s*work\b/i,
      /\bsow\b/i,
      /\bmaster\s*services?\s*agreement\b/i,
      /\bmsa\b/i
    ],

    # Purchase Orders
    'purchase_order' => [
      /\bpurchase[-_.\s]?order\b/i,
      /\bpo[-_.\s]?\d+/i,
      /\border[-_.\s]?\d+/i
    ],

    # Work Orders
    'work_order' => [
      /\bwork[-_.\s]?order\b/i,
      /\bwo[-_.\s]?\d+/i,
      /\bservice[-_.\s]?order\b/i,
      /\bjob[-_.\s]?sheet\b/i
    ],

    # Certificates
    'certificate' => [
      /\bcertificate\b/i,
      /\bcert\b/i,
      /\bcompliance\b/i,
      /\binsurance\b/i,
      /\bwarranty\b/i,
      /\bguarantee\b/i,
      /\blicen[cs]e\b/i
    ],

    # Compliance documents
    'compliance' => [
      /\bsafety\b/i,
      /\bswms\b/i,
      /\bmsds\b/i,
      /\bsds\b/i,
      /\brisk[-_.\s]?assessment\b/i,
      /\bmethod[-_.\s]?statement\b/i,
      /\binduction\b/i,
      /\btraining\b/i
    ],

    # Correspondence
    'correspondence' => [
      /\bletter\b/i,
      /\bmemo\b/i,
      /\bmeeting[-_.\s]?minutes\b/i,
      /\bminutes\b/i,
      /\bnotes\b/i,
      /\breport\b/i
    ]
  }.freeze

  # Content type hints (Layer 1.5 - helps disambiguate)
  CONTENT_TYPE_HINTS = {
    'message/rfc822' => 'email',
    'application/vnd.ms-outlook' => 'email',
    '.eml' => 'email',
    '.msg' => 'email',
    '.dwg' => 'plan',
    '.dxf' => 'plan'
  }.freeze

  def initialize(docsort_item)
    @item = docsort_item
    @filename = docsort_item.original_filename || ''
    @content_type = docsort_item.content_type || ''
    @subject = docsort_item.subject || ''
  end

  # Main classification entry point
  def classify!
    # Layer 1: Filename patterns (fastest, highest confidence for matches)
    result = classify_by_filename
    return result if result[:confidence] >= 0.9

    # Layer 1.5: Content type hints
    type_hint = classify_by_content_type
    if type_hint[:document_type]
      return type_hint if type_hint[:confidence] >= 0.95
      # Boost filename result if content type matches
      if result[:document_type] == type_hint[:document_type]
        result[:confidence] = [result[:confidence] + 0.1, 1.0].min
        result[:signals] << 'content_type_match'
        return result if result[:confidence] >= 0.9
      end
    end

    # Layer 2: DocumentTypeMatcher (SSoT pattern matching)
    matcher_result = classify_by_document_type_matcher
    if matcher_result[:confidence] >= 0.8
      return matcher_result
    end

    # Combine results - take highest confidence
    best_result = [result, matcher_result].max_by { |r| r[:confidence] }

    # Layer 3: AI classification for uncertain cases
    if best_result[:confidence] < 0.6 && ai_classification_enabled?
      ai_result = classify_with_ai
      if ai_result[:confidence] > best_result[:confidence]
        return ai_result
      end
    end

    # Return best result (or default to 'general')
    if best_result[:document_type].nil? || best_result[:confidence] < 0.3
      return {
        document_type: 'general',
        confidence: 0.3,
        method: 'default',
        signals: ['no_match'],
        classified_at: Time.current
      }
    end

    best_result
  end

  private

  # Layer 1: Filename pattern matching
  def classify_by_filename
    return empty_result('filename') if @filename.blank?

    matches = []

    FILENAME_PATTERNS.each do |doc_type, patterns|
      matched_patterns = patterns.select { |pattern| @filename.match?(pattern) }
      next if matched_patterns.empty?

      # Calculate confidence based on number of matches and pattern specificity
      confidence = calculate_pattern_confidence(matched_patterns, patterns.length)

      matches << {
        document_type: doc_type,
        confidence: confidence,
        method: 'filename_pattern',
        signals: matched_patterns.map { |p| p.source.gsub(/[^a-zA-Z0-9]/, '_')[0..30] },
        classified_at: Time.current
      }
    end

    # Return best match
    matches.max_by { |m| m[:confidence] } || empty_result('filename')
  end

  # Layer 1.5: Content type hints
  def classify_by_content_type
    # Check content type directly
    if CONTENT_TYPE_HINTS[@content_type]
      return {
        document_type: CONTENT_TYPE_HINTS[@content_type],
        confidence: 0.95,
        method: 'content_type',
        signals: ['content_type_match'],
        classified_at: Time.current
      }
    end

    # Check file extension
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

  # Layer 2: Use DocumentTypeMatcher (SSoT for document type matching)
  def classify_by_document_type_matcher
    suggestions = DocumentTypeMatcher.suggest(@filename, limit: 3)
    return empty_result('document_type_matcher') if suggestions.empty?

    top_match = suggestions.first
    doc_type = map_document_type_to_docsort_type(top_match[:document_type])

    {
      document_type: doc_type,
      confidence: top_match[:confidence] / 100.0,  # DTM uses 0-100, we use 0-1
      method: 'document_type_matcher',
      signals: [top_match[:match_type], top_match[:matched_term]].compact,
      matched_document_type: top_match[:document_type].name,
      classified_at: Time.current
    }
  end

  # Layer 3: AI classification using Claude Haiku
  def classify_with_ai
    return empty_result('ai') unless ai_classification_enabled?

    # Build context for AI
    context = build_ai_context

    # Call AI service (Claude Haiku for speed/cost)
    prompt = build_classification_prompt(context)
    response = call_ai_service(prompt)

    parse_ai_response(response)
  rescue StandardError => e
    Rails.logger.error "[DocumentClassificationService] AI classification failed: #{e.message}"
    empty_result('ai')
  end

  # Check if AI classification is enabled
  def ai_classification_enabled?
    # Check feature flag or setting
    ENV['DOCSORT_AI_ENABLED'] == 'true' ||
      (defined?(TenantSetting) && TenantSetting.docsort_ai_enabled?)
  rescue
    false
  end

  # Build context for AI classification
  def build_ai_context
    context = {
      filename: @filename,
      content_type: @content_type
    }

    # Add email context if from email
    if @item.synced_email.present?
      context[:email_subject] = @subject
      context[:email_from] = @item.from_email
    end

    # Add first page text if PDF
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

  # Build AI classification prompt
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

  # Call AI service
  def call_ai_service(prompt)
    # Use Claude Haiku for fast/cheap classification
    ClaudeService.call(
      model: 'claude-haiku',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.3
    )
  end

  # Parse AI response
  def parse_ai_response(response)
    return empty_result('ai') unless response.present?

    # Extract JSON from response
    json_match = response.match(/\{.*\}/m)
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

  # Map DocumentType model to DocsortItem document_type
  def map_document_type_to_docsort_type(document_type)
    name = document_type.name.downcase

    # Direct mappings
    return 'invoice' if name.include?('invoice') || name.include?('bill') || name.include?('receipt')
    return 'plan' if name.include?('plan') || name.include?('drawing') || name.include?('architectural')
    return 'quote' if name.include?('quote') || name.include?('estimate') || name.include?('proposal')
    return 'contract' if name.include?('contract') || name.include?('agreement')
    return 'purchase_order' if name.include?('purchase') || name.include?('po ')
    return 'work_order' if name.include?('work order') || name.include?('job sheet')
    return 'certificate' if name.include?('certificate') || name.include?('license') || name.include?('insurance')
    return 'compliance' if name.include?('safety') || name.include?('compliance') || name.include?('swms')
    return 'correspondence' if name.include?('letter') || name.include?('memo') || name.include?('minutes')

    # Default
    'general'
  end

  # Calculate confidence based on pattern matches
  def calculate_pattern_confidence(matched_patterns, total_patterns)
    base_confidence = 0.8

    # More matches = higher confidence
    match_bonus = (matched_patterns.length - 1) * 0.05
    base_confidence += match_bonus

    # Cap at 0.95 (never 100% for pattern matching alone)
    [base_confidence, 0.95].min
  end

  # Empty result helper
  def empty_result(method)
    {
      document_type: nil,
      confidence: 0.0,
      method: method,
      signals: [],
      classified_at: Time.current
    }
  end
end
