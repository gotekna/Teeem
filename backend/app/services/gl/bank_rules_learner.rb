# frozen_string_literal: true

module Gl
  # Learns from manual bank transaction categorizations to suggest new rules
  # Watches user behavior and proposes rules when patterns emerge
  #
  # SSoT: This is THE service for AI-powered bank rule suggestions
  #
  class BankRulesLearner
    include AnthropicClient

    # Minimum occurrences before suggesting a rule
    MIN_PATTERN_COUNT = 3

    # Confidence threshold for suggestions
    MIN_CONFIDENCE = 0.7

    def initialize(corporate)
      @company = corporate
    end

    # Analyze recent categorizations and suggest rules
    def suggest_rules(limit: 10)
      patterns = find_patterns
      suggestions = []

      patterns.each do |pattern|
        next if rule_already_exists?(pattern)
        next if pattern[:count] < MIN_PATTERN_COUNT

        suggestion = build_suggestion(pattern)
        suggestions << suggestion if suggestion[:confidence] >= MIN_CONFIDENCE
      end

      suggestions
        .sort_by { |s| -s[:confidence] }
        .first(limit)
    end

    # Record a manual categorization for learning
    def record_categorization(bank_line:, account:, user: nil)
      BankRuleLearning.create!(
        corporate: @company,
        bank_line_id: bank_line.id,
        gl_account: account,
        user: user,
        transaction_description: normalize_description(bank_line.description),
        transaction_amount: bank_line.amount,
        transaction_type: bank_line.amount.to_d >= 0 ? "credit" : "debit",
        payee_name: extract_payee(bank_line.description),
        learned_at: Time.current
      )
    end

    # Auto-create a rule from a suggestion
    def create_rule_from_suggestion(suggestion)
      BankRule.create!(
        corporate: @company,
        name: suggestion[:suggested_name],
        match_type: suggestion[:match_type],
        match_value: suggestion[:match_value],
        gl_account_id: suggestion[:account_id],
        transaction_type: suggestion[:transaction_type],
        auto_created: true,
        confidence: suggestion[:confidence],
        pattern_count: suggestion[:pattern_count]
      )
    end

    # Get learning statistics
    def stats
      learnings = BankRuleLearning.where(corporate: @company)

      {
        total_learnings: learnings.count,
        unique_patterns: learnings.distinct.count(:transaction_description),
        rules_created: BankRule.where(corporate: @company, auto_created: true).count,
        top_accounts: top_learned_accounts,
        recent_learnings: learnings.order(created_at: :desc).limit(10).map { |l| learning_json(l) }
      }
    end

    private

    def find_patterns
      # Group learnings by normalized description and account
      BankRuleLearning
        .where(corporate: @company)
        .where("learned_at > ?", 90.days.ago)
        .group(:transaction_description, :gl_account_id, :transaction_type)
        .having("COUNT(*) >= ?", MIN_PATTERN_COUNT)
        .order("COUNT(*) DESC")
        .limit(50)
        .pluck(:transaction_description, :gl_account_id, :transaction_type, Arel.sql("COUNT(*)"))
        .map do |desc, account_id, txn_type, count|
          {
            description: desc,
            account_id: account_id,
            transaction_type: txn_type,
            count: count
          }
        end
    end

    def rule_already_exists?(pattern)
      BankRule.where(corporate: @company)
              .where("LOWER(match_value) = LOWER(?)", pattern[:description])
              .exists?
    end

    def build_suggestion(pattern)
      account = Account.find_by(id: pattern[:account_id])
      return nil unless account

      # Calculate confidence based on consistency
      total_for_desc = BankRuleLearning
        .where(corporate: @company, transaction_description: pattern[:description])
        .count

      consistency = pattern[:count].to_f / total_for_desc
      confidence = [(consistency * 0.7) + (pattern[:count] / 20.0 * 0.3), 1.0].min

      {
        suggested_name: "Auto: #{pattern[:description].truncate(30)}",
        match_type: determine_match_type(pattern[:description]),
        match_value: pattern[:description],
        account_id: pattern[:account_id],
        account_name: account.name,
        account_code: account.code,
        transaction_type: pattern[:transaction_type],
        pattern_count: pattern[:count],
        confidence: confidence.round(2),
        sample_transactions: sample_transactions(pattern[:description])
      }
    end

    def determine_match_type(description)
      # If description looks like it has variable parts, use contains
      if description.match?(/\d{4,}/) || description.length > 50
        "contains"
      else
        "exact"
      end
    end

    def normalize_description(description)
      return "" unless description

      # Remove common variable parts (dates, reference numbers, etc.)
      description
        .gsub(/\d{2}\/\d{2}\/\d{2,4}/, "") # Dates
        .gsub(/\d{6,}/, "")                 # Long numbers (refs)
        .gsub(/\s+/, " ")                   # Multiple spaces
        .strip
        .downcase
    end

    def extract_payee(description)
      return "" unless description

      # Try to extract payee name (usually first part before reference numbers)
      parts = description.split(/\s+/)
      payee_parts = parts.take_while { |p| !p.match?(/^\d{4,}$/) }
      payee_parts.join(" ").truncate(100)
    end

    def sample_transactions(description)
      BankRuleLearning
        .where(corporate: @company, transaction_description: description)
        .order(created_at: :desc)
        .limit(5)
        .pluck(:transaction_amount, :learned_at)
        .map { |amount, date| { amount: amount, date: date } }
    end

    def top_learned_accounts
      BankRuleLearning
        .where(corporate: @company)
        .joins(:gl_account)
        .group("gl_accounts.id", "gl_accounts.name", "gl_accounts.code")
        .order("COUNT(*) DESC")
        .limit(10)
        .pluck("gl_accounts.name", "gl_accounts.code", Arel.sql("COUNT(*)"))
        .map { |name, code, count| { name: name, code: code, count: count } }
    end

    def learning_json(learning)
      {
        id: learning.id,
        description: learning.transaction_description,
        amount: learning.transaction_amount,
        account: learning.gl_account&.name,
        learned_at: learning.learned_at
      }
    end
  end
end
