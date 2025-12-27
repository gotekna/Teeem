# frozen_string_literal: true

# LabourCostEntry - simPRO-style labour cost tracking with full cost loading
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Implements the simPRO cost formula:
#   Total Cost = Base Labour + Employment Costs + Overhead
#   Base Labour = (Regular × Rate) + (OT1.5 × Rate × 1.5) + (OT2 × Rate × 2)
#   Employment = Base × Employment% (super, leave, workers comp)
#   Overhead = (Base + Employment) × Overhead%
#
class LabourCostEntry < ApplicationRecord
  # Entry sources
  ENTRY_SOURCES = %w[photo manual ai_suggested imported].freeze

  # Billing statuses
  BILLING_STATUSES = %w[unbilled pending_invoice invoiced written_off].freeze

  # Australian overtime rules (hours thresholds)
  REGULAR_HOURS_THRESHOLD = 7.6  # First 7.6 hours at regular rate
  OVERTIME_1_5X_THRESHOLD = 2.0  # Next 2 hours at 1.5x

  # Associations
  belongs_to :site_presence_session, optional: true
  belongs_to :worker_profile
  belongs_to :job
  belongs_to :sm_task, optional: true
  belongs_to :cost_centre, optional: true
  # Note: invoice_id is a soft reference without FK constraint
  belongs_to :invoice, optional: true, class_name: "Invoice"

  # Validations
  validates :entry_date, presence: true
  validates :entry_source, inclusion: { in: ENTRY_SOURCES }
  validates :billing_status, inclusion: { in: BILLING_STATUSES }
  validates :regular_hours, :overtime_1_5x_hours, :overtime_2x_hours,
            numericality: { greater_than_or_equal_to: 0 }
  validates :total_cost, numericality: { greater_than_or_equal_to: 0 }

  # Scopes
  scope :for_date, ->(date) { where(entry_date: date) }
  scope :for_date_range, ->(start_date, end_date) { where(entry_date: start_date..end_date) }
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :for_worker, ->(worker_profile_id) { where(worker_profile_id: worker_profile_id) }
  scope :for_cost_centre, ->(cost_centre_id) { where(cost_centre_id: cost_centre_id) }
  scope :billable, -> { where(billable: true) }
  scope :unbilled, -> { where(billing_status: "unbilled") }
  scope :ready_to_bill, -> { billable.unbilled }
  scope :from_photos, -> { where(entry_source: "photo") }
  scope :manual_entries, -> { where(entry_source: "manual") }
  scope :ai_suggested, -> { where(entry_source: "ai_suggested") }
  scope :recent, -> { order(entry_date: :desc) }

  # Callbacks
  before_validation :calculate_costs, if: :needs_cost_calculation?
  after_save :update_job_cost_cache

  # Create from a completed SitePresenceSession
  def self.create_from_session(session)
    return nil unless session.completed? && session.total_hours.present?

    worker = session.worker_profile
    hours_breakdown = calculate_hours_breakdown(session.total_hours)
    cost_data = worker.calculate_cost_for_hours(hours_breakdown, cost_centre_override: session.cost_centre)

    create!(
      site_presence_session: session,
      worker_profile: worker,
      job: session.job,
      sm_task: session.sm_task,
      cost_centre: session.cost_centre,
      entry_date: session.checkin_at.to_date,

      # Hours
      regular_hours: hours_breakdown[:regular],
      overtime_1_5x_hours: hours_breakdown[:overtime_1_5x],
      overtime_2x_hours: hours_breakdown[:overtime_2x],

      # Rates snapshot
      base_rate: cost_data[:rates_used][:hourly_rate],
      overtime_1_5x_rate: cost_data[:rates_used][:overtime_1_5x_rate],
      overtime_2x_rate: cost_data[:rates_used][:overtime_2x_rate],
      employment_cost_percent_used: cost_data[:rates_used][:employment_cost_percent],
      overhead_percent_used: cost_data[:rates_used][:overhead_percent],

      # Costs
      base_labour_cost: cost_data[:base_labour_cost],
      employment_cost: cost_data[:employment_cost],
      overhead_cost: cost_data[:overhead_cost],
      total_cost: cost_data[:total_cost],

      entry_source: "photo",
      billable: true
    )
  end

  # Calculate hours breakdown from total hours (Australian overtime rules)
  def self.calculate_hours_breakdown(total_hours)
    regular = [total_hours, REGULAR_HOURS_THRESHOLD].min
    remaining = [total_hours - REGULAR_HOURS_THRESHOLD, 0].max
    overtime_1_5x = [remaining, OVERTIME_1_5X_THRESHOLD].min
    overtime_2x = [remaining - OVERTIME_1_5X_THRESHOLD, 0].max

    {
      regular: regular.round(2),
      overtime_1_5x: overtime_1_5x.round(2),
      overtime_2x: overtime_2x.round(2)
    }
  end

  # Total hours across all types
  def total_hours
    (regular_hours || 0) + (overtime_1_5x_hours || 0) + (overtime_2x_hours || 0) +
      (travel_hours || 0) + (standby_hours || 0)
  end

  # Recalculate costs (useful when rates change)
  def recalculate_costs!
    calculate_costs
    save!
  end

  # Mark as billed
  def mark_billed!(invoice)
    update!(
      billing_status: "invoiced",
      invoice: invoice
    )
  end

  # Write off (non-billable)
  def write_off!(reason: nil)
    update!(
      billing_status: "written_off",
      billable: false,
      internal_notes: [internal_notes, "Written off: #{reason}"].compact.join("\n")
    )
  end

  # Cost breakdown for display
  def cost_breakdown
    {
      regular: { hours: regular_hours, rate: base_rate, cost: (regular_hours || 0) * (base_rate || 0) },
      overtime_1_5x: { hours: overtime_1_5x_hours, rate: overtime_1_5x_rate, cost: (overtime_1_5x_hours || 0) * (overtime_1_5x_rate || 0) },
      overtime_2x: { hours: overtime_2x_hours, rate: overtime_2x_rate, cost: (overtime_2x_hours || 0) * (overtime_2x_rate || 0) },
      base_labour_cost: base_labour_cost,
      employment_cost: employment_cost,
      overhead_cost: overhead_cost,
      total_cost: total_cost
    }
  end

  private

  def needs_cost_calculation?
    (regular_hours_changed? || overtime_1_5x_hours_changed? || overtime_2x_hours_changed?) &&
      (base_rate.present? || worker_profile&.effective_hourly_rate.present?)
  end

  def calculate_costs
    hours_breakdown = {
      regular: regular_hours || 0,
      overtime_1_5x: overtime_1_5x_hours || 0,
      overtime_2x: overtime_2x_hours || 0
    }

    cost_data = worker_profile.calculate_cost_for_hours(hours_breakdown, cost_centre_override: cost_centre)

    # Store rate snapshot
    self.base_rate ||= cost_data[:rates_used][:hourly_rate]
    self.overtime_1_5x_rate ||= cost_data[:rates_used][:overtime_1_5x_rate]
    self.overtime_2x_rate ||= cost_data[:rates_used][:overtime_2x_rate]
    self.employment_cost_percent_used ||= cost_data[:rates_used][:employment_cost_percent]
    self.overhead_percent_used ||= cost_data[:rates_used][:overhead_percent]

    # Calculate costs
    self.base_labour_cost = cost_data[:base_labour_cost]
    self.employment_cost = cost_data[:employment_cost]
    self.overhead_cost = cost_data[:overhead_cost]
    self.total_cost = cost_data[:total_cost]
  end

  def update_job_cost_cache
    return unless job

    # Update cached labour actual on job (async in production)
    total = LabourCostEntry.for_job(job_id).sum(:total_cost)
    job.update_column(:labour_actual_cached, total)

    # Update variance if budget exists
    if job.labour_budget.present? && job.labour_budget.positive?
      variance_percent = (total / job.labour_budget * 100).round(2)
      job.update_column(:labour_variance_percent, variance_percent)
    end
  end
end
