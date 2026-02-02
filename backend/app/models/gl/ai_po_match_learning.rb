# frozen_string_literal: true

module Gl
  # Stores user feedback on AI PO matching for learning
  # Used to improve future match suggestions
  class AiPoMatchLearning < ApplicationRecord
    self.table_name = "gl_ai_po_match_learnings"

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :bill_inbox
    belongs_to :purchase_order
    belongs_to :user, optional: true

    # Scopes
    scope :accepted, -> { where(was_accepted: true) }
    scope :rejected, -> { where(was_accepted: false) }
    scope :recent, -> { order(created_at: :desc) }

    # Validation
    validates :bill_inbox_id, presence: true
    validates :purchase_order_id, presence: true

    # Analytics methods
    def self.acceptance_rate(company = nil)
      scope = company ? where(corporate_company: company) : all
      total = scope.count
      return 0.0 if total.zero?

      accepted = scope.accepted.count
      (accepted.to_f / total * 100).round(1)
    end

    def self.common_rejection_patterns(company = nil, limit: 10)
      scope = company ? where(corporate_company: company) : all

      scope.rejected
           .group(:match_data)
           .order("COUNT(*) DESC")
           .limit(limit)
           .pluck(:match_data)
    end

    # Get similar past matches to help with current matching
    def self.find_similar_matches(bill_supplier_name:, bill_amount:, company:, limit: 5)
      # Find accepted matches with similar supplier or amount
      where(corporate_company: company)
        .accepted
        .where("bill_supplier_name ILIKE ? OR ABS(bill_amount - ?) < ?",
               "%#{bill_supplier_name}%",
               bill_amount,
               bill_amount * 0.2)
        .order(created_at: :desc)
        .limit(limit)
    end
  end
end
