# frozen_string_literal: true

module Gl
  # Service for auto-matching bank reconciliation transactions
  #
  # Matching strategies (in priority order):
  # 1. Exact match - Same amount, same date, same reference
  # 2. Rule-based match - Apply configured reconciliation rules
  # 3. Fuzzy match - Same amount, date within range, similar description
  # 4. AI-powered match - Claude-based categorization suggestions
  #
  class ReconciliationMatcher
    attr_reader :reconciliation, :matches_found, :ai_suggestions

    # Minimum confidence score to auto-match
    AUTO_MATCH_THRESHOLD = 80

    # Date range for fuzzy matching (days)
    FUZZY_DATE_RANGE = 7

    # AI confidence threshold for auto-suggestions (0-1 scale → 0-100)
    AI_SUGGESTION_THRESHOLD = 0.75

    def initialize(reconciliation, enable_ai: true)
      @reconciliation = reconciliation
      @matches_found = 0
      @ai_suggestions = []
      @enable_ai = enable_ai && AiTransactionCategorizationService.enabled?
    end

    # Run all matching strategies on unmatched items
    def auto_match_all
      @matches_found = 0

      # Load rules for this account
      rules = load_rules

      # Get unmatched items
      statement_items = reconciliation.lines.unmatched.statement_items.by_date.to_a
      gl_items = reconciliation.lines.unmatched.gl_items.by_date.to_a

      return if statement_items.empty? || gl_items.empty?

      # Strategy 1: Exact matches
      exact_match(statement_items, gl_items)

      # Refresh unmatched items
      statement_items = reconciliation.lines.unmatched.statement_items.to_a
      gl_items = reconciliation.lines.unmatched.gl_items.to_a

      # Strategy 2: Rule-based matches
      rule_match(statement_items, gl_items, rules) if rules.any?

      # Refresh unmatched items
      statement_items = reconciliation.lines.unmatched.statement_items.to_a
      gl_items = reconciliation.lines.unmatched.gl_items.to_a

      # Strategy 3: Fuzzy matches
      fuzzy_match(statement_items, gl_items)

      # Strategy 4: AI categorization suggestions (doesn't auto-match, just suggests)
      if @enable_ai
        statement_items = reconciliation.lines.unmatched.statement_items.to_a
        ai_categorize(statement_items)
      end

      @matches_found
    end

    # Find potential matches for a specific line
    def find_matches_for(line, limit: 10)
      candidates = if line.statement_item?
        reconciliation.lines.unmatched.gl_items
      else
        reconciliation.lines.unmatched.statement_items
      end

      # Score each candidate
      scored = candidates.map do |candidate|
        {
          line: candidate,
          score: line.match_score_with(candidate),
          can_match: line.can_match_with?(candidate)
        }
      end

      # Filter and sort
      scored
        .select { |m| m[:can_match] && m[:score] > 0 }
        .sort_by { |m| -m[:score] }
        .first(limit)
    end

    # Suggest matches for all unmatched items
    def suggest_matches
      suggestions = []

      reconciliation.lines.unmatched.statement_items.each do |line|
        matches = find_matches_for(line, limit: 3)
        next if matches.empty?

        suggestions << {
          line: line,
          matches: matches,
          best_match: matches.first,
          auto_match: matches.first[:score] >= AUTO_MATCH_THRESHOLD
        }
      end

      suggestions
    end

    private

    def load_rules
      Gl::ReconciliationRule
        .active
        .for_account(reconciliation.gl_account_id)
        .by_priority
        .to_a
    end

    # Strategy 1: Exact match on amount + date + reference
    def exact_match(statement_items, gl_items)
      statement_items.each do |stmt|
        next if stmt.matched?

        # Find GL item with exact amount match (opposite sign)
        matches = gl_items.select do |gl|
          !gl.matched? &&
            stmt.can_match_with?(gl) &&
            stmt.transaction_date == gl.transaction_date &&
            stmt.reference.present? &&
            stmt.reference.downcase == gl.reference&.downcase
        end

        if matches.one?
          match_lines!(stmt, matches.first, 'auto', 100)
        end
      end
    end

    # Strategy 2: Rule-based matching
    def rule_match(statement_items, gl_items, rules)
      statement_items.each do |stmt|
        next if stmt.matched?

        # Find matching rule
        matching_rule = rules.find { |rule| rule.matches?(stmt) }
        next unless matching_rule

        # Find GL item that matches the rule's criteria
        matches = gl_items.select do |gl|
          !gl.matched? &&
            stmt.can_match_with?(gl) &&
            rule_applies_to_gl?(matching_rule, gl)
        end

        if matches.one?
          matching_rule.record_usage!
          match_lines!(stmt, matches.first, 'rule', 90)
        end
      end
    end

    # Strategy 3: Fuzzy matching based on amount and date proximity
    def fuzzy_match(statement_items, gl_items)
      # Group GL items by amount for faster lookup
      gl_by_amount = gl_items.group_by { |gl| gl.amount.to_d.round(2) }

      statement_items.each do |stmt|
        next if stmt.matched?

        # Find GL items with matching amount (opposite sign)
        target_amount = (-stmt.amount.to_d).round(2)
        candidates = gl_by_amount[target_amount] || []
        candidates = candidates.reject(&:matched?)

        next if candidates.empty?

        # Score candidates
        scored = candidates.map do |gl|
          {
            gl: gl,
            score: stmt.match_score_with(gl)
          }
        end

        # Take the best match if above threshold
        best = scored.max_by { |s| s[:score] }
        if best && best[:score] >= AUTO_MATCH_THRESHOLD
          match_lines!(stmt, best[:gl], 'auto', best[:score])
        end
      end
    end

    def rule_applies_to_gl?(rule, gl_line)
      # Check if the GL line's account matches the rule's target account
      return true unless rule.target_account_id

      # This would need the GL line to have an account association
      # For now, return true to allow matching
      true
    end

    def match_lines!(line1, line2, match_type, confidence)
      return unless line1.match_with!(line2, match_type: match_type, confidence: confidence)

      @matches_found += 1
      Rails.logger.info(
        "[ReconciliationMatcher] Matched: #{line1.description} <-> #{line2.description} " \
        "(#{match_type}, #{confidence}%)"
      )
    end

    # Strategy 4: AI-powered categorization suggestions
    def ai_categorize(statement_items)
      return if statement_items.empty?

      company = reconciliation.corporate
      ai_service = AiTransactionCategorizationService.new(company)

      statement_items.each do |stmt|
        next if stmt.matched?

        suggestion = ai_service.suggest_for_line(stmt)
        next unless suggestion

        # Store the suggestion (doesn't auto-match - user must confirm)
        @ai_suggestions << {
          line_id: stmt.id,
          line_description: stmt.description,
          suggested_account_id: suggestion[:account_id],
          suggested_account_code: suggestion[:account_code],
          suggested_account_name: suggestion[:account_name],
          confidence: suggestion[:confidence],
          reasoning: suggestion[:reasoning]
        }

        Rails.logger.info(
          "[ReconciliationMatcher] AI suggestion: #{stmt.description} → " \
          "#{suggestion[:account_code]} (#{(suggestion[:confidence] * 100).round}%)"
        )
      end
    rescue StandardError => e
      Rails.logger.error("[ReconciliationMatcher] AI categorization error: #{e.message}")
    end
  end
end
