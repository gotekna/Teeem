# frozen_string_literal: true

module Gl
  # Stores user feedback on AI categorization suggestions
  # Used to improve future suggestions by learning from user corrections
  #
  class AiCategorizationLearning < ApplicationRecord
    self.table_name = "gl_ai_categorization_learnings"

    # Associations
    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"
    belongs_to :ai_suggested_account, class_name: "Gl::Account", optional: true
    belongs_to :user_chosen_account, class_name: "Gl::Account"

    # Validations
    validates :transaction_description, presence: true
    validates :transaction_amount_type, presence: true, inclusion: { in: %w[credit debit] }
    validates :feedback_date, presence: true

    # Scopes
    scope :accepted, -> { where(was_accepted: true) }
    scope :rejected, -> { where(was_accepted: false) }
    scope :for_amount_type, ->(type) { where(transaction_amount_type: type) }
    scope :recent, -> { order(feedback_date: :desc) }

    # Find similar past categorizations
    # @param description [String] Transaction description to match
    # @param amount_type [String] "credit" or "debit"
    # @param limit [Integer] Max results
    # @return [ActiveRecord::Relation]
    def self.find_similar(description:, amount_type:, limit: 10)
      normalized = description.downcase.gsub(/[^a-z0-9\s]/, " ").strip
      keywords = normalized.split(/\s+/).reject { |w| w.length < 3 }

      return none if keywords.empty?

      # Build ILIKE conditions for each keyword
      conditions = keywords.map { "transaction_description ILIKE ?" }
      values = keywords.map { |k| "%#{k}%" }

      where(conditions.join(" OR "), *values)
        .where(transaction_amount_type: amount_type)
        .accepted
        .recent
        .limit(limit)
    end

    # Calculate accuracy rate for AI suggestions
    def self.accuracy_rate
      total = count
      return 0 if total.zero?

      accepted.count.to_f / total
    end

    # Most common corrections (what AI got wrong)
    def self.common_corrections(limit: 10)
      rejected
        .group(:ai_suggested_account_id, :user_chosen_account_id)
        .select(
          :ai_suggested_account_id,
          :user_chosen_account_id,
          "COUNT(*) as correction_count"
        )
        .order("correction_count DESC")
        .limit(limit)
    end
  end
end
