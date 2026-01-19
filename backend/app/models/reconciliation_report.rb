class ReconciliationReport < ApplicationRecord
  # Associations

  # Constants
  STATUSES = %w[pending running completed failed].freeze

  # Validations
  validates :status, inclusion: { in: STATUSES }
  validates :as_of_date, presence: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :completed, -> { where(status: "completed") }
  scope :for_group, ->(group_id) { where(tenant_id: group_id) }

  # Instance methods
  def mark_running!
    update!(status: "running", started_at: Time.current)
  end

  def mark_completed!(results)
    update!(
      status: "completed",
      completed_at: Time.current,
      total_pairs_checked: results[:total_pairs],
      matched_pairs: results[:matched],
      mismatched_pairs: results[:mismatched],
      total_discrepancy: results[:total_discrepancy],
      summary: results[:summary],
      discrepancies: results[:discrepancies]
    )
  end

  def mark_failed!(error_message)
    update!(
      status: "failed",
      completed_at: Time.current,
      error_message: error_message
    )
  end

  def duration_seconds
    return nil unless started_at && completed_at
    (completed_at - started_at).to_i
  end

  def has_discrepancies?
    mismatched_pairs.to_i > 0
  end

  def match_percentage
    return 0 if total_pairs_checked.to_i.zero?
    (matched_pairs.to_f / total_pairs_checked * 100).round(1)
  end
end
