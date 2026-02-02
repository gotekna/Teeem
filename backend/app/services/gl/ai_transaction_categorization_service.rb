# frozen_string_literal: true

module Gl
  # AI-powered transaction categorization using Claude
  #
  # Uses Claude Haiku for cost-efficient categorization of bank transactions
  # to suggest appropriate GL accounts based on:
  # - Transaction description and reference
  # - Historical categorization patterns
  # - Chart of accounts context
  #
  # Cost estimate: ~$0.0001-0.0005 per transaction
  #
  class AiTransactionCategorizationService
    include AnthropicClient

    # Rate limiting: max 200 categorizations per hour
    # At $0.0003 avg per call, this caps costs at $0.06/hour or $43/month max
    RATE_LIMIT_THRESHOLD = 200
    RATE_LIMIT_PERIOD = 1.hour

    # Minimum confidence to suggest (0-1)
    MIN_CONFIDENCE = 0.7

    # Cache TTL for account context
    CONTEXT_CACHE_TTL = 1.hour

    attr_reader :company

    def initialize(company)
      @company = company
    end

    # Check if AI categorization is enabled
    def self.enabled?
      ENV["ANTHROPIC_API_KEY"].present?
    end

    # Categorize a single transaction
    #
    # @param transaction [Hash] Transaction data with :description, :amount, :reference, :date
    # @return [Hash] Categorization result with :account_id, :account_code, :account_name, :confidence, :reasoning
    def categorize(transaction)
      return nil unless self.class.enabled?
      return nil if rate_limit_exceeded?

      # Get account context and learning history
      accounts_context = build_accounts_context
      learning_context = build_learning_context(transaction)

      # Call Claude for categorization
      result = call_ai_categorization(transaction, accounts_context, learning_context)

      # Record the AI attempt for rate limiting
      record_ai_attempt(transaction, result)

      result
    rescue StandardError => e
      Rails.logger.error "[AiTransactionCategorizationService] Error: #{e.message}"
      nil
    end

    # Batch categorize multiple transactions
    #
    # @param transactions [Array<Hash>] Array of transaction data
    # @return [Array<Hash>] Array of categorization results
    def batch_categorize(transactions)
      return [] unless self.class.enabled?

      # Process in chunks to respect rate limits
      results = []
      transactions.each_with_index do |txn, idx|
        break if rate_limit_exceeded?

        result = categorize(txn)
        results << { index: idx, transaction: txn, categorization: result }

        # Small delay between calls to be nice to the API
        sleep(0.1) if idx < transactions.length - 1
      end

      results
    end

    # Record user feedback for learning
    #
    # @param transaction [Hash] The transaction that was categorized
    # @param ai_suggestion [Hash] The AI's suggestion
    # @param user_choice [Hash] What the user actually chose
    # @param accepted [Boolean] Whether the user accepted the AI suggestion
    def record_feedback(transaction:, ai_suggestion:, user_choice:, accepted:)
      Gl::AiCategorizationLearning.create!(
        corporate: company,
        transaction_description: normalize_description(transaction[:description]),
        transaction_amount_type: transaction[:amount].to_d >= 0 ? "credit" : "debit",
        transaction_reference: transaction[:reference],
        ai_suggested_account_id: ai_suggestion[:account_id],
        ai_confidence: ai_suggestion[:confidence],
        user_chosen_account_id: user_choice[:account_id],
        was_accepted: accepted,
        feedback_date: Time.current
      )
    end

    # Get suggestions for a reconciliation line
    #
    # @param line [Gl::ReconciliationLine] The reconciliation line
    # @return [Hash, nil] Categorization suggestion or nil
    def suggest_for_line(line)
      return nil unless line.statement_item?
      return nil if line.matched?

      transaction = {
        description: line.description,
        reference: line.reference,
        amount: line.amount,
        date: line.transaction_date
      }

      categorize(transaction)
    end

    private

    def call_ai_categorization(transaction, accounts_context, learning_context)
      prompt = build_prompt(transaction, accounts_context, learning_context)

      response = call_claude(
        prompt: prompt,
        model: CLAUDE_HAIKU,
        max_tokens: 500
      )

      parse_response(response)
    end

    def build_prompt(transaction, accounts_context, learning_context)
      amount_type = transaction[:amount].to_d >= 0 ? "RECEIVED (credit/income)" : "SPENT (debit/expense)"

      <<~PROMPT
        You are an expert accountant categorizing bank transactions for an Australian business.

        TRANSACTION TO CATEGORIZE:
        - Description: #{transaction[:description]}
        - Reference: #{transaction[:reference] || 'N/A'}
        - Amount: $#{transaction[:amount].to_d.abs} #{amount_type}
        - Date: #{transaction[:date]}

        AVAILABLE GL ACCOUNTS:
        #{accounts_context}

        #{learning_context}

        INSTRUCTIONS:
        1. Analyze the transaction description and reference
        2. Match it to the most appropriate GL account from the list
        3. Consider whether this is money IN (revenue) or OUT (expense)
        4. For money OUT: typically expense accounts (6xxx-8xxx)
        5. For money IN: typically revenue accounts (4xxx) or asset/liability clearing

        Return ONLY valid JSON in this exact format:
        {
          "account_code": "6100",
          "confidence": 0.85,
          "reasoning": "Brief explanation of why this account matches"
        }

        confidence must be between 0 and 1 (1 = certain, 0.5 = guess)
        If uncertain, use confidence < 0.7
      PROMPT
    end

    def build_accounts_context
      # Cache the accounts context to reduce DB queries
      Rails.cache.fetch("ai_categorization_accounts_#{company.id}", expires_in: CONTEXT_CACHE_TTL) do
        accounts = Gl::Account.where(corporate: company)
                              .active
                              .where(account_type: %w[revenue expense])
                              .ordered
                              .pluck(:code, :name, :account_type)

        accounts.map { |code, name, type| "#{code} - #{name} (#{type})" }.join("\n")
      end
    end

    def build_learning_context(transaction)
      # Find similar past transactions and what accounts they were assigned to
      similar = Gl::AiCategorizationLearning
        .where(corporate: company)
        .where(was_accepted: true)
        .where(transaction_amount_type: transaction[:amount].to_d >= 0 ? "credit" : "debit")
        .order(feedback_date: :desc)
        .limit(20)

      return "" if similar.empty?

      # Find ones with similar descriptions
      normalized_desc = normalize_description(transaction[:description])
      keywords = normalized_desc.split(/\s+/).reject { |w| w.length < 3 }

      matching = similar.select do |learning|
        keywords.any? { |kw| learning.transaction_description.include?(kw) }
      end.first(5)

      return "" if matching.empty?

      context_lines = matching.map do |l|
        account = Gl::Account.find_by(id: l.user_chosen_account_id)
        next unless account
        "- \"#{l.transaction_description}\" → #{account.code} - #{account.name}"
      end.compact

      return "" if context_lines.empty?

      <<~CONTEXT

        SIMILAR PAST TRANSACTIONS (user-verified categories):
        #{context_lines.join("\n")}
      CONTEXT
    end

    def parse_response(response)
      result = parse_claude_json(response)
      return nil if result.empty?

      account_code = result[:account_code] || result["account_code"]
      confidence = (result[:confidence] || result["confidence"]).to_f
      reasoning = result[:reasoning] || result["reasoning"] || ""

      return nil if confidence < MIN_CONFIDENCE
      return nil unless account_code.present?

      # Find the account
      account = Gl::Account.where(corporate: company)
                           .active
                           .find_by(code: account_code)

      return nil unless account

      {
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
        confidence: confidence,
        reasoning: reasoning,
        method: "ai",
        model: CLAUDE_HAIKU
      }
    end

    def normalize_description(description)
      return "" unless description
      # Normalize: lowercase, remove special chars, collapse whitespace
      description.downcase
                 .gsub(/[^a-z0-9\s]/, " ")
                 .gsub(/\s+/, " ")
                 .strip
    end

    def rate_limit_exceeded?
      recent_count = Gl::AiCategorizationAttempt
        .where(corporate: company)
        .where("created_at > ?", RATE_LIMIT_PERIOD.ago)
        .count

      recent_count >= RATE_LIMIT_THRESHOLD
    end

    def record_ai_attempt(transaction, result)
      Gl::AiCategorizationAttempt.create!(
        corporate: company,
        transaction_description: transaction[:description]&.first(500),
        transaction_amount: transaction[:amount],
        suggested_account_id: result&.dig(:account_id),
        confidence: result&.dig(:confidence),
        was_successful: result.present?
      )
    rescue ActiveRecord::RecordInvalid => e
      Rails.logger.warn "[AiTransactionCategorizationService] Failed to record attempt: #{e.message}"
    end
  end
end
