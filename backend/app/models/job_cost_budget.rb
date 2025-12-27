# frozen_string_literal: true

# JobCostBudget - Budget vs actuals tracking for jobs
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Tracks budgets by category and caches actual spend for real-time
# profitability dashboards and margin alerts.
#
class JobCostBudget < ApplicationRecord
  # Alert statuses
  ALERT_STATUSES = %w[ok warning critical over_budget].freeze

  # Calculation statuses
  CALCULATION_STATUSES = %w[pending calculating completed error].freeze

  # Associations
  belongs_to :job
  belongs_to :cost_centre, optional: true
  belongs_to :alert_acknowledged_by, class_name: "User", optional: true

  # Validations
  validates :alert_status, inclusion: { in: ALERT_STATUSES }
  validates :calculation_status, inclusion: { in: CALCULATION_STATUSES }
  validates :warning_threshold_percent, :critical_threshold_percent,
            numericality: { greater_than: 0, less_than_or_equal_to: 200 }

  validate :warning_less_than_critical

  # Callbacks
  before_save :compute_total_budget

  # Scopes
  scope :ok, -> { where(alert_status: "ok") }
  scope :warning, -> { where(alert_status: "warning") }
  scope :critical, -> { where(alert_status: "critical") }
  scope :over_budget, -> { where(alert_status: "over_budget") }
  scope :needs_attention, -> { where(alert_status: %w[warning critical over_budget]) }
  scope :needs_calculation, -> { where(calculation_status: "pending") }
  scope :stale, -> { where("last_calculated_at < ? OR last_calculated_at IS NULL", 1.hour.ago) }

  # Recalculate all cached values from source data
  def recalculate!
    update!(calculation_status: "calculating")

    begin
      # Calculate labour actuals from LabourCostEntry
      self.labour_actual = LabourCostEntry.for_job(job_id).sum(:total_cost)

      # Calculate materials actuals (from purchase orders or similar)
      # self.materials_actual = ... # TODO: integrate with materials system

      # Calculate subcontractor actuals (from POs or invoices)
      # self.subcontractor_actual = ... # TODO: integrate with subcontractor system

      # Total actual
      self.total_actual = labour_actual + (materials_actual || 0) +
                          (subcontractor_actual || 0) + (equipment_actual || 0)

      # Calculate variances
      if labour_budget.present? && labour_budget.positive?
        self.labour_variance = labour_budget - labour_actual
        self.labour_variance_percent = (labour_actual / labour_budget * 100).round(2)
      end

      if total_budget.present? && total_budget.positive?
        self.total_variance = total_budget - total_actual
        self.total_variance_percent = (total_actual / total_budget * 100).round(2)
      end

      # Calculate margins
      if job.contract_price.present?
        self.actual_margin = job.contract_price - total_actual
        self.actual_margin_percent = (actual_margin / job.contract_price * 100).round(2)
      end

      # Update alert status
      update_alert_status!

      # Mark as completed
      self.last_calculated_at = Time.current
      self.calculation_status = "completed"
      save!
    rescue StandardError => e
      update!(calculation_status: "error", notes: "Calculation error: #{e.message}")
      raise
    end
  end

  # Update alert status based on variance
  def update_alert_status!
    percent_used = labour_variance_percent || 0

    new_status = if percent_used >= 100
                   "over_budget"
                 elsif percent_used >= critical_threshold_percent
                   "critical"
                 elsif percent_used >= warning_threshold_percent
                   "warning"
                 else
                   "ok"
                 end

    # Only update if status changed
    if alert_status != new_status
      self.alert_status = new_status
      self.last_alert_at = Time.current if new_status != "ok"
    end
  end

  # Acknowledge alert
  def acknowledge_alert!(user)
    update!(
      alert_acknowledged_by: user,
      last_alert_acknowledged_at: Time.current
    )
  end

  # Status helpers
  def ok?
    alert_status == "ok"
  end

  def needs_attention?
    alert_status.in?(%w[warning critical over_budget])
  end

  def over_budget?
    alert_status == "over_budget"
  end

  def stale?
    last_calculated_at.nil? || last_calculated_at < 1.hour.ago
  end

  # Budget utilization percentages
  def labour_utilization_percent
    return 0 unless labour_budget.present? && labour_budget.positive?

    ((labour_actual || 0) / labour_budget * 100).round(1)
  end

  def total_utilization_percent
    return 0 unless total_budget.present? && total_budget.positive?

    ((total_actual || 0) / total_budget * 100).round(1)
  end

  # Remaining budget
  def labour_remaining
    return nil unless labour_budget.present?

    labour_budget - (labour_actual || 0)
  end

  def total_remaining
    return nil unless total_budget.present?

    total_budget - (total_actual || 0)
  end

  # Projected final cost (based on progress)
  def projected_total_cost(completion_percent:)
    return nil if completion_percent.nil? || completion_percent <= 0

    (total_actual / (completion_percent / 100.0)).round(2)
  end

  # Dashboard summary
  def dashboard_summary
    {
      job_id: job_id,
      budget: {
        labour: labour_budget,
        materials: materials_budget,
        subcontractor: subcontractor_budget,
        total: total_budget
      },
      actual: {
        labour: labour_actual,
        materials: materials_actual,
        subcontractor: subcontractor_actual,
        total: total_actual
      },
      variance: {
        labour: labour_variance,
        labour_percent: labour_variance_percent,
        total: total_variance,
        total_percent: total_variance_percent
      },
      utilization: {
        labour_percent: labour_utilization_percent,
        total_percent: total_utilization_percent
      },
      margin: {
        actual: actual_margin,
        actual_percent: actual_margin_percent
      },
      alert_status: alert_status,
      last_calculated_at: last_calculated_at
    }
  end

  # Class methods

  # Recalculate all stale budgets
  def self.recalculate_stale!
    stale.find_each(&:recalculate!)
  end

  # Get all budgets needing attention
  def self.alerts_summary
    {
      ok: ok.count,
      warning: warning.count,
      critical: critical.count,
      over_budget: over_budget.count,
      total_needing_attention: needs_attention.count
    }
  end

  private

  def compute_total_budget
    self.total_budget = (labour_budget || 0) + (materials_budget || 0) +
                        (subcontractor_budget || 0) + (equipment_budget || 0)
  end

  def warning_less_than_critical
    return unless warning_threshold_percent.present? && critical_threshold_percent.present?
    return if warning_threshold_percent < critical_threshold_percent

    errors.add(:warning_threshold_percent, "must be less than critical threshold")
  end
end
