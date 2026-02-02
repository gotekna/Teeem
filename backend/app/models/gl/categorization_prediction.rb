# frozen_string_literal: true

module Gl
  # AI prediction for transaction categorization
  class CategorizationPrediction < ApplicationRecord
    self.table_name = "gl_categorization_predictions"

    STATUSES = %w[pending accepted rejected corrected].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :bank_transaction, class_name: "Gl::BankTransaction", optional: true
    belongs_to :predicted_category, class_name: "Gl::TransactionCategory", optional: true
    belongs_to :predicted_account, class_name: "Gl::Account", optional: true
    belongs_to :actual_category, class_name: "Gl::TransactionCategory", optional: true
    belongs_to :actual_account, class_name: "Gl::Account", optional: true
    belongs_to :reviewed_by, class_name: "User", optional: true

    validates :confidence_score, presence: true, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1 }
    validates :status, inclusion: { in: STATUSES }

    scope :pending, -> { where(status: "pending") }
    scope :high_confidence, -> { where("confidence_score >= 0.8") }
    scope :low_confidence, -> { where("confidence_score < 0.5") }
    scope :recent, -> { order(created_at: :desc) }

    # Accept the prediction
    def accept!(user)
      update!(
        status: "accepted",
        actual_category: predicted_category,
        actual_account: predicted_account,
        reviewed_by: user,
        reviewed_at: Time.current
      )

      # Learn from acceptance
      predicted_category&.learn_from_transaction!(bank_transaction&.description)
    end

    # Reject the prediction
    def reject!(user, reason: nil)
      update!(
        status: "rejected",
        reviewed_by: user,
        reviewed_at: Time.current,
        rejection_reason: reason
      )
    end

    # Correct with different category
    def correct!(user, category:, account: nil)
      update!(
        status: "corrected",
        actual_category: category,
        actual_account: account || category&.default_account,
        reviewed_by: user,
        reviewed_at: Time.current
      )

      # Learn from correction
      category&.learn_from_transaction!(bank_transaction&.description)
    end

    # Generate prediction for a transaction
    def self.predict!(transaction, company)
      categories = company.gl_transaction_categories.active
      description = transaction.description.to_s

      # Score each category
      scores = categories.map do |cat|
        [cat, cat.match_score(description)]
      end.to_h

      # Get best match
      best_match = scores.max_by { |_, score| score }
      return nil if best_match.nil? || best_match[1] < 0.1

      category = best_match[0]
      confidence = best_match[1]

      create!(
        corporate_company: company,
        bank_transaction: transaction,
        predicted_category: category,
        predicted_account: category.default_account,
        confidence_score: confidence,
        features_used: {
          description: description,
          amount: transaction.amount,
          matched_keywords: category.keywords.select { |kw| description.downcase.include?(kw.downcase) }
        }
      )
    end

    # Prediction accuracy stats
    def self.accuracy_stats(company)
      predictions = where(corporate_company: company).where.not(status: "pending")

      total = predictions.count
      return { accuracy: 0, total: 0 } if total.zero?

      correct = predictions.where(status: "accepted").count
      corrected = predictions.where(status: "corrected").count

      {
        total: total,
        correct: correct,
        corrected: corrected,
        rejected: predictions.where(status: "rejected").count,
        accuracy: (correct.to_f / total * 100).round(1),
        avg_confidence: predictions.average(:confidence_score)&.round(2)
      }
    end
  end
end
