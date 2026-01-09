# frozen_string_literal: true

# AiTimesheetSuggestion - ML-generated timesheet entries from photo evidence
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# AI aggregates evidence from photos, GPS check-ins, and calendar to suggest
# time entries. Workers can accept, modify, or reject suggestions.
#
class AiTimesheetSuggestion < ApplicationRecord
  # Statuses
  STATUSES = %w[pending accepted modified rejected expired].freeze

  # Associations
  belongs_to :worker_profile
  belongs_to :job
  belongs_to :actioned_by, class_name: "User", optional: true
  belongs_to :labour_cost_entry, optional: true

  # Validations
  validates :suggestion_date, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :suggested_hours, numericality: { greater_than: 0 }, allow_nil: true
  validates :confidence_score, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  # Scopes
  scope :pending, -> { where(status: "pending") }
  scope :accepted, -> { where(status: %w[accepted modified]) }
  scope :rejected, -> { where(status: "rejected") }
  scope :expired, -> { where(status: "expired") }
  scope :actionable, -> { pending.where("expires_at IS NULL OR expires_at > ?", Time.current) }
  scope :high_confidence, -> { where("confidence_score >= ?", 80) }
  scope :for_date, ->(date) { where(suggestion_date: date) }
  scope :for_worker, ->(worker_profile_id) { where(worker_profile_id: worker_profile_id) }
  scope :recent, -> { order(suggestion_date: :desc) }

  # Callbacks
  before_create :set_expiry

  # Accept the suggestion and create a LabourCostEntry
  def accept!(user)
    return false unless pending?

    entry = create_labour_cost_entry!

    update!(
      status: "accepted",
      actioned_by: user,
      actioned_at: Time.current,
      labour_cost_entry: entry
    )

    entry
  end

  # Accept with modifications
  def accept_modified!(user, modifications = {})
    return false unless pending?

    # Apply modifications to suggested values
    start_time = modifications[:start_time] || suggested_start_time
    end_time = modifications[:end_time] || suggested_end_time
    hours = modifications[:hours] || suggested_hours

    entry = create_labour_cost_entry!(
      start_time: start_time,
      end_time: end_time,
      hours: hours
    )

    update!(
      status: "modified",
      actioned_by: user,
      actioned_at: Time.current,
      labour_cost_entry: entry,
      user_notes: modifications[:notes]
    )

    entry
  end

  # Reject the suggestion
  def reject!(user, reason: nil)
    return false unless pending?

    update!(
      status: "rejected",
      actioned_by: user,
      actioned_at: Time.current,
      user_notes: reason
    )

    true
  end

  # Expire old pending suggestions
  def self.expire_old_suggestions!
    pending.where("expires_at < ?", Time.current).update_all(status: "expired")
  end

  # Status helpers
  def pending?
    status == "pending"
  end

  def accepted?
    status.in?(%w[accepted modified])
  end

  def actionable?
    pending? && (expires_at.nil? || expires_at > Time.current)
  end

  # Evidence summary for display
  def evidence_summary
    summary = []

    if photo_evidence.present?
      summary << "#{photo_evidence.size} photos"
    end

    if gps_evidence.present?
      summary << "#{gps_evidence.size} GPS check-ins"
    end

    if calendar_evidence.present?
      summary << "#{calendar_evidence.size} calendar events"
    end

    summary.join(", ")
  end

  # Confidence level (human-readable)
  def confidence_level
    return "unknown" unless confidence_score

    case confidence_score
    when 90..100 then "very_high"
    when 75..89 then "high"
    when 50..74 then "medium"
    when 25..49 then "low"
    else "very_low"
    end
  end

  # Should this be auto-approved?
  def auto_approvable?
    confidence_score.present? &&
      confidence_score >= 95 &&
      photo_evidence.present? &&
      gps_evidence.present?
  end

  private

  def set_expiry
    # Suggestions expire after 7 days if not actioned
    self.expires_at ||= 7.days.from_now
  end

  def create_labour_cost_entry!(start_time: nil, end_time: nil, hours: nil)
    effective_hours = hours || suggested_hours
    hours_breakdown = LabourCostEntry.calculate_hours_breakdown(effective_hours)

    LabourCostEntry.create!(
      worker_profile: worker_profile,
      job: job,
      entry_date: suggestion_date,
      regular_hours: hours_breakdown[:regular],
      overtime_1_5x_hours: hours_breakdown[:overtime_1_5x],
      overtime_2x_hours: hours_breakdown[:overtime_2x],
      entry_source: "ai_suggested",
      billable: true,
      description: "AI-generated from #{evidence_summary}"
    )
  end
end
