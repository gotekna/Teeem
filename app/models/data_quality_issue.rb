# Tracks data quality issues detected by automated checks
class DataQualityIssue < ApplicationRecord
  # Validations
  validates :view_name, presence: true
  validates :check_name, presence: true
  validates :description, presence: true
  validates :detected_at, presence: true
  validates :severity, presence: true, inclusion: { in: %w[info warning error critical] }
  validates :status, presence: true, inclusion: { in: %w[open acknowledged resolved ignored] }

  # Scopes
  scope :for_view, ->(name) { where(view_name: name) }
  scope :open_issues, -> { where(status: "open") }
  scope :unresolved, -> { where(status: %w[open acknowledged]) }
  scope :resolved, -> { where(status: %w[resolved ignored]) }
  scope :critical, -> { where(severity: "critical") }
  scope :errors, -> { where(severity: %w[error critical]) }
  scope :warnings, -> { where(severity: %w[warning error critical]) }
  scope :recent, ->(days = 7) { where("detected_at >= ?", days.days.ago) }

  # Create a new issue
  def self.report(view_name:, check_name:, severity:, description:, details: {}, affected_row_count: nil)
    # Check if similar issue already exists and is open
    existing = find_by(
      view_name: view_name,
      check_name: check_name,
      status: %w[open acknowledged]
    )

    if existing
      # Update existing issue with new details
      existing.update!(
        description: description,
        details: details,
        affected_row_count: affected_row_count,
        detected_at: Time.current
      )
      existing
    else
      create!(
        view_name: view_name,
        check_name: check_name,
        severity: severity,
        description: description,
        details: details,
        affected_row_count: affected_row_count,
        detected_at: Time.current
      )
    end
  end

  # Acknowledge an issue (someone is looking at it)
  def acknowledge!
    update!(status: "acknowledged")
  end

  # Resolve an issue
  def resolve!(resolved_by:, notes: nil)
    update!(
      status: "resolved",
      resolved_at: Time.current,
      resolved_by: resolved_by,
      resolution_notes: notes
    )
  end

  # Ignore an issue (acceptable condition)
  def ignore!(resolved_by:, notes: nil)
    update!(
      status: "ignored",
      resolved_at: Time.current,
      resolved_by: resolved_by,
      resolution_notes: notes
    )
  end

  # Auto-resolve issues for a check if data is now healthy
  def self.auto_resolve_if_healthy(view_name:, check_name:)
    unresolved
      .where(view_name: view_name, check_name: check_name)
      .update_all(
        status: "resolved",
        resolved_at: Time.current,
        resolved_by: "system",
        resolution_notes: "Auto-resolved: check now passing"
      )
  end

  # Get summary of current issues
  def self.summary
    {
      total_open: open_issues.count,
      by_severity: {
        critical: open_issues.critical.count,
        error: open_issues.where(severity: "error").count,
        warning: open_issues.where(severity: "warning").count,
        info: open_issues.where(severity: "info").count
      },
      by_view: open_issues.group(:view_name).count,
      oldest_open: open_issues.order(:detected_at).first&.detected_at,
      recent_24h: where("detected_at >= ?", 24.hours.ago).count
    }
  end
end
