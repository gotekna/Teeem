# frozen_string_literal: true

module Gl
  # Tracks AI PO matching attempts for rate limiting and analytics
  class AiPoMatchAttempt < ApplicationRecord
    self.table_name = "gl_ai_po_match_attempts"

    belongs_to :corporate_company
    belongs_to :bill_inbox, optional: true

    # Scopes for analytics
    scope :today, -> { where("created_at >= ?", Date.current.beginning_of_day) }
    scope :this_hour, -> { where("created_at >= ?", 1.hour.ago) }
    scope :successful, -> { where(successful: true) }
    scope :with_match, -> { where.not(matched_po_id: nil) }

    # Get usage stats
    def self.usage_stats(company)
      {
        today: where(corporate_company: company).today.count,
        this_hour: where(corporate_company: company).this_hour.count,
        total: where(corporate_company: company).count,
        match_rate: calculate_match_rate(company)
      }
    end

    def self.calculate_match_rate(company)
      total = where(corporate_company: company).count
      return 0.0 if total.zero?

      matched = where(corporate_company: company).with_match.count
      (matched.to_f / total * 100).round(1)
    end
  end
end
