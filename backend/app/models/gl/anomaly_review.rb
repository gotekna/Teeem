# frozen_string_literal: true

module Gl
  # Tracks reviewed anomalies to prevent re-alerting
  class AnomalyReview < ApplicationRecord
    self.table_name = "gl_anomaly_reviews"

    # Associations
    belongs_to :corporate, foreign_key: "company_id"
    belongs_to :reviewed_by, class_name: "User", optional: true

    # Validations
    validates :transaction_type, presence: true
    validates :transaction_id, presence: true
    validates :status, presence: true, inclusion: {
      in: %w[acknowledged false_positive confirmed_fraud under_investigation resolved]
    }

    # Scopes
    scope :pending, -> { where(status: %w[acknowledged under_investigation]) }
    scope :resolved, -> { where(status: %w[false_positive confirmed_fraud resolved]) }
    scope :recent, -> { order(created_at: :desc) }

    # Check if a transaction has been reviewed
    def self.reviewed?(transaction_type, transaction_id)
      exists?(transaction_type: transaction_type, transaction_id: transaction_id)
    end

    # Get review for a transaction
    def self.for_transaction(transaction_type, transaction_id)
      find_by(transaction_type: transaction_type, transaction_id: transaction_id)
    end
  end
end
