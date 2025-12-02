class DocumentVerificationFeedback < ApplicationRecord
  belongs_to :company_document
  belongs_to :user

  # Valid action types
  ACTIONS = %w[accepted rejected modified].freeze

  validates :action, presence: true, inclusion: { in: ACTIONS }

  scope :by_company, ->(code) { where(company_code: code) }
  scope :corrections, -> { where(action: %w[rejected modified]) }
  scope :recent, -> { order(created_at: :desc) }

  # Get recent corrections for a specific company to use in AI prompts
  # Returns feedback where user disagreed with or modified AI suggestions
  def self.learning_examples_for(company_code, limit: 5)
    by_company(company_code)
      .corrections
      .recent
      .limit(limit)
  end

  # Build learning context string for AI prompts
  def self.build_learning_context(company_code, limit: 5)
    examples = learning_examples_for(company_code, limit: limit)

    return nil if examples.empty?

    lines = examples.map do |f|
      case f.action
      when "rejected"
        "- AI suggested '#{f.ai_suggested_name}' but user kept '#{f.user_final_name}'"
      when "modified"
        "- AI suggested '#{f.ai_suggested_name}' but user changed to '#{f.user_final_name}'"
      end
    end.compact

    lines.join("\n")
  end
end
