# frozen_string_literal: true

module Gl
  # Records each AI categorization attempt for rate limiting and analytics
  #
  class AiCategorizationAttempt < ApplicationRecord
    self.table_name = "gl_ai_categorization_attempts"

    # Associations
    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :suggested_account, class_name: "Gl::Account", optional: true

    # Validations
    validates :transaction_description, presence: true

    # Scopes
    scope :successful, -> { where(was_successful: true) }
    scope :failed, -> { where(was_successful: false) }
    scope :recent, ->(period = 1.hour) { where("created_at > ?", period.ago) }
    scope :today, -> { where("created_at >= ?", Date.current.beginning_of_day) }

    # Rate limit check
    def self.rate_limit_remaining(company, threshold: 200, period: 1.hour)
      used = where(corporate_company: company)
             .where("created_at > ?", period.ago)
             .count

      [threshold - used, 0].max
    end

    # Usage statistics
    def self.usage_stats(company, period: 7.days)
      base = where(corporate_company: company)
             .where("created_at > ?", period.ago)

      {
        total_attempts: base.count,
        successful: base.successful.count,
        failed: base.failed.count,
        success_rate: base.count.zero? ? 0 : (base.successful.count.to_f / base.count * 100).round(1),
        average_confidence: base.successful.average(:confidence)&.round(3) || 0
      }
    end
  end
end
