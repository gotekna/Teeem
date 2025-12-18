# frozen_string_literal: true

# Audit trail for every plan identification decision
# Records the full pipeline results: OCR → Pattern Match → AI → Decision
class PlanIdentificationRecord < ApplicationRecord
  self.table_name = "plan_identifications"
  belongs_to :job_plan
  belongs_to :identified_plan_type, class_name: "PlanType", optional: true
  belongs_to :identified_plan_category, class_name: "PlanCategory", optional: true
  belongs_to :reviewed_by, class_name: "User", optional: true

  # Decision statuses
  STATUSES = %w[auto_assigned spot_check needs_review human_required].freeze

  # Pattern match reasons
  MATCH_REASONS = %w[exact_match contains_match partial_match keyword_match no_match blank_input].freeze

  validates :decision_status, inclusion: { in: STATUSES }, allow_nil: true

  scope :needs_review, -> { where(decision_status: %w[needs_review human_required]) }
  scope :reviewed, -> { where(human_reviewed: true) }
  scope :pending_review, -> { where(human_reviewed: false).needs_review }
  scope :ai_invoked, -> { where(ai_invoked: true) }
  scope :recent, -> { order(created_at: :desc) }

  # Record a new identification from the service result
  def self.record_from_result(job_plan, result, pattern_result: nil, ai_result: nil)
    create!(
      job_plan: job_plan,
      identified_plan_type_id: result.plan_type&.id,
      identified_plan_category_id: result.plan_category&.id,

      # Pattern match
      pattern_match_plan_type_id: pattern_result&.plan_type&.id,
      pattern_match_confidence: pattern_result&.confidence,
      pattern_match_reason: pattern_result&.reason,

      # AI
      ai_plan_type_id: ai_result&.plan_type&.id,
      ai_confidence: ai_result&.confidence,
      ai_reasoning: ai_result&.reasoning,
      ai_invoked: result.ai_invoked,

      # Sheet info
      sheet_number: result.sheet_number,
      sheet_name: result.sheet_name,
      sheet_date: result.sheet_date,
      sheet_issue: result.sheet_issue,

      # Decision
      final_confidence: result.confidence,
      decision_status: result.status
    )
  end

  # Mark as reviewed by human
  def mark_reviewed!(user, override_plan_type: nil, reason: nil)
    update!(
      human_reviewed: true,
      reviewed_by: user,
      reviewed_at: Time.current,
      human_override_plan_type_id: override_plan_type&.id,
      human_override_reason: reason
    )
  end

  # Accuracy stats for a time period
  def self.accuracy_stats(since: 30.days.ago)
    total = where("created_at >= ?", since).count
    return {} if total.zero?

    reviewed = where("created_at >= ? AND human_reviewed = ?", since, true).count
    overridden = where("created_at >= ? AND human_override_plan_type_id IS NOT NULL", since).count

    {
      total_identifications: total,
      human_reviewed: reviewed,
      human_overridden: overridden,
      accuracy_rate: ((reviewed - overridden).to_f / reviewed * 100).round(1),
      auto_assign_rate: (where("created_at >= ? AND decision_status = ?", since, "auto_assigned").count.to_f / total * 100).round(1)
    }
  end
end
