# frozen_string_literal: true

module Gl
  # AI-enhanced Purchase Order to Invoice matching
  # Adds confidence scoring and AI suggestions when rule-based matching fails
  #
  # SSoT: This is THE AI enhancement layer for BillMatchingService
  # Rule-based matching happens in BillMatchingService
  # AI suggestions happen here when rules don't find a match
  #
  class AiPoInvoiceMatcher
    include AnthropicClient

    # Confidence score thresholds
    EXACT_PO_NUMBER_CONFIDENCE = 100
    SUPPLIER_AMOUNT_CONFIDENCE = 85
    ABN_AMOUNT_CONFIDENCE = 75
    AI_SUGGESTION_MIN_CONFIDENCE = 60

    # Rate limiting for AI calls
    RATE_LIMIT_THRESHOLD = 100
    RATE_LIMIT_PERIOD = 1.hour

    def initialize(bill_inbox, corporate_company: nil)
      @bill = bill_inbox
      @company = corporate_company || @bill.corporate_company
    end

    # Main entry: Find best PO match with confidence scoring
    # Returns: { po: PurchaseOrder, confidence: Integer, reason: String, source: String }
    def find_best_match
      # Try rule-based matches first (with confidence scores)
      match = try_po_number_match ||
              try_supplier_amount_match ||
              try_abn_amount_match

      return match if match && match[:confidence] >= AI_SUGGESTION_MIN_CONFIDENCE

      # No good rule match - try AI
      ai_match = try_ai_match

      # Return best of rule-based or AI
      if match && ai_match
        match[:confidence] >= ai_match[:confidence] ? match : ai_match
      else
        match || ai_match
      end
    end

    # Get all potential matches ranked by confidence
    def all_matches
      matches = []

      # Collect all rule-based candidates
      po_number_match = try_po_number_match
      matches << po_number_match if po_number_match

      supplier_matches = find_supplier_amount_candidates
      matches.concat(supplier_matches)

      abn_matches = find_abn_amount_candidates
      matches.concat(abn_matches)

      # Add AI suggestions if enabled
      if ai_enabled?
        ai_matches = get_ai_suggestions
        matches.concat(ai_matches)
      end

      # Deduplicate by PO ID and sort by confidence
      matches
        .group_by { |m| m[:po].id }
        .values
        .map { |group| group.max_by { |m| m[:confidence] } }
        .sort_by { |m| -m[:confidence] }
    end

    # Record user's match confirmation for learning
    def record_confirmation(po, was_accepted:, user: nil)
      AiPoMatchLearning.create!(
        corporate_company: @company,
        bill_inbox: @bill,
        purchase_order: po,
        was_accepted: was_accepted,
        user: user,
        bill_supplier_name: @bill.supplier_name_raw,
        bill_amount: @bill.total_amount,
        po_supplier_name: po.supplier&.display_name,
        po_amount: po.total,
        match_data: {
          supplier_id_match: @bill.supplier_id == po.supplier_id,
          amount_variance: @bill.total_amount.to_d - po.total.to_d,
          po_status: po.status,
          bill_invoice_number: @bill.invoice_number
        }
      )
    end

    private

    def try_po_number_match
      po_number = @bill.ai_extraction_result&.dig("po_number")
      return nil unless po_number.present?

      # Try exact match
      po = PurchaseOrder.find_by(purchase_order_number: po_number)
      return nil unless po

      # Calculate amount variance for confidence adjustment
      amount_variance = calculate_amount_variance(po)
      confidence = EXACT_PO_NUMBER_CONFIDENCE

      # Reduce confidence if amounts don't match well
      confidence -= 10 if amount_variance[:percent] > 5
      confidence -= 20 if amount_variance[:percent] > 20

      {
        po: po,
        confidence: confidence,
        reason: "PO number '#{po_number}' matched exactly",
        source: "po_number",
        variance: amount_variance
      }
    end

    def try_supplier_amount_match
      candidates = find_supplier_amount_candidates
      candidates.first # Already sorted by confidence
    end

    def find_supplier_amount_candidates
      return [] unless @bill.supplier && @bill.total_amount

      pos = PurchaseOrder
        .where(supplier: @bill.supplier)
        .where(status: %w[sent received invoiced])
        .where("total BETWEEN ? AND ?",
               @bill.total_amount * 0.7,
               @bill.total_amount * 1.3)
        .includes(:supplier)
        .limit(10)

      pos.map do |po|
        variance = calculate_amount_variance(po)
        confidence = calculate_supplier_amount_confidence(variance)

        {
          po: po,
          confidence: confidence,
          reason: "Supplier '#{po.supplier&.display_name}' with amount variance #{variance[:percent].round(1)}%",
          source: "supplier_amount",
          variance: variance
        }
      end.sort_by { |m| -m[:confidence] }
    end

    def try_abn_amount_match
      candidates = find_abn_amount_candidates
      candidates.first
    end

    def find_abn_amount_candidates
      return [] unless @bill.supplier_abn_raw.present? && @bill.total_amount

      abn = @bill.supplier_abn_raw.gsub(/\s/, "")
      contacts = Contact.where("REPLACE(tax_number, ' ', '') = ?", abn)
      return [] if contacts.empty?

      pos = PurchaseOrder
        .where(supplier: contacts)
        .where(status: %w[sent received invoiced])
        .where("total BETWEEN ? AND ?",
               @bill.total_amount * 0.7,
               @bill.total_amount * 1.3)
        .includes(:supplier)
        .limit(10)

      pos.map do |po|
        variance = calculate_amount_variance(po)
        confidence = calculate_abn_amount_confidence(variance)

        {
          po: po,
          confidence: confidence,
          reason: "ABN '#{abn}' matched with amount variance #{variance[:percent].round(1)}%",
          source: "abn_amount",
          variance: variance
        }
      end.sort_by { |m| -m[:confidence] }
    end

    def calculate_amount_variance(po)
      bill_amount = @bill.total_amount.to_d
      po_amount = po.total.to_d

      variance_amount = (bill_amount - po_amount).abs
      variance_percent = po_amount.zero? ? 100.0 : ((variance_amount / po_amount) * 100)

      {
        amount: variance_amount,
        percent: variance_percent,
        direction: bill_amount > po_amount ? "over" : "under"
      }
    end

    def calculate_supplier_amount_confidence(variance)
      base = SUPPLIER_AMOUNT_CONFIDENCE

      # Perfect amount match
      return base + 10 if variance[:percent] < 0.5

      # Small variance
      return base if variance[:percent] < 2

      # Moderate variance
      return base - 10 if variance[:percent] < 5

      # Large variance
      return base - 25 if variance[:percent] < 10

      # Very large variance
      base - 35
    end

    def calculate_abn_amount_confidence(variance)
      base = ABN_AMOUNT_CONFIDENCE

      # Same logic as supplier but lower base
      return base + 10 if variance[:percent] < 0.5
      return base if variance[:percent] < 2
      return base - 10 if variance[:percent] < 5
      return base - 25 if variance[:percent] < 10
      base - 35
    end

    def try_ai_match
      return nil unless ai_enabled?
      return nil if rate_limited?

      suggestions = get_ai_suggestions
      suggestions.first
    end

    def get_ai_suggestions
      return [] unless ai_enabled?
      return [] if rate_limited?

      record_ai_attempt!

      # Get potential POs to analyze
      candidate_pos = find_ai_candidates
      return [] if candidate_pos.empty?

      # Build context for AI
      bill_context = build_bill_context
      po_contexts = candidate_pos.map { |po| build_po_context(po) }

      # Ask AI to rank matches
      prompt = build_ai_prompt(bill_context, po_contexts)
      response = call_claude(prompt)

      parse_ai_response(response, candidate_pos)
    rescue StandardError => e
      Rails.logger.error "[AI-PO-Matcher] AI suggestion failed: #{e.message}"
      []
    end

    def find_ai_candidates
      # Get all POs from the same time period that haven't been fully invoiced
      start_date = (@bill.invoice_date || 30.days.ago) - 60.days
      end_date = (@bill.invoice_date || Date.current) + 30.days

      PurchaseOrder
        .where(status: %w[sent received invoiced approved])
        .where("created_at BETWEEN ? AND ?", start_date, end_date)
        .where("total > 0")
        .where("amount_still_to_be_invoiced > 0 OR amount_still_to_be_invoiced IS NULL")
        .includes(:supplier, :job)
        .order(created_at: :desc)
        .limit(20)
    end

    def build_bill_context
      {
        invoice_number: @bill.invoice_number,
        supplier_name: @bill.supplier_name_raw || @bill.supplier&.display_name,
        supplier_abn: @bill.supplier_abn_raw,
        total_amount: @bill.total_amount,
        invoice_date: @bill.invoice_date,
        description: @bill.ai_extraction_result&.dig("description"),
        line_items: @bill.ai_extraction_result&.dig("line_items")&.first(5),
        po_reference: @bill.ai_extraction_result&.dig("po_number")
      }
    end

    def build_po_context(po)
      {
        id: po.id,
        po_number: po.purchase_order_number,
        supplier_name: po.supplier&.display_name,
        total: po.total,
        job_name: po.job&.name,
        description: po.description,
        status: po.status,
        created_at: po.created_at.to_date,
        line_items: po.line_items.first(5).map do |li|
          { description: li.description, amount: li.total }
        end
      }
    end

    def build_ai_prompt(bill_context, po_contexts)
      <<~PROMPT
        You are an accounts payable assistant matching incoming invoices to purchase orders.

        INCOMING INVOICE:
        #{bill_context.to_json}

        CANDIDATE PURCHASE ORDERS:
        #{po_contexts.to_json}

        For each PO, assess how likely it matches this invoice. Consider:
        1. Supplier name similarity (exact match, partial match, or different)
        2. Amount match (exact, close, or different)
        3. Description/line item similarity
        4. Date proximity
        5. Any PO reference on the invoice

        Return a JSON array of matches, ranked by confidence:
        [
          {"po_id": 123, "confidence": 85, "reason": "Supplier and amount match exactly"},
          {"po_id": 456, "confidence": 60, "reason": "Amount close but different supplier name"}
        ]

        Only include POs with confidence >= 50. Return empty array [] if no good matches.
        Respond ONLY with the JSON array, no other text.
      PROMPT
    end

    def call_claude(prompt)
      # Use Haiku for cost efficiency
      chat_completion(
        model: "claude-3-haiku-20240307",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.1
      )
    end

    def parse_ai_response(response, candidate_pos)
      content = response.dig("content", 0, "text") || ""
      data = JSON.parse(content)

      return [] unless data.is_a?(Array)

      po_lookup = candidate_pos.index_by(&:id)

      data.filter_map do |match|
        po = po_lookup[match["po_id"]]
        next unless po

        confidence = [match["confidence"].to_i, 95].min # Cap AI confidence at 95

        {
          po: po,
          confidence: confidence,
          reason: match["reason"] || "AI suggested match",
          source: "ai_suggestion",
          variance: calculate_amount_variance(po)
        }
      end.sort_by { |m| -m[:confidence] }
    rescue JSON::ParserError => e
      Rails.logger.warn "[AI-PO-Matcher] Failed to parse AI response: #{e.message}"
      []
    end

    def ai_enabled?
      ENV["ANTHROPIC_API_KEY"].present?
    end

    def rate_limited?
      recent_count = AiPoMatchAttempt
        .where(corporate_company: @company)
        .where("created_at > ?", RATE_LIMIT_PERIOD.ago)
        .count

      recent_count >= RATE_LIMIT_THRESHOLD
    end

    def record_ai_attempt!
      AiPoMatchAttempt.create!(
        corporate_company: @company,
        bill_inbox: @bill
      )
    end
  end
end
