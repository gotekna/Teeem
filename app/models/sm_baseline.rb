# frozen_string_literal: true

# SmBaseline - Schedule baseline snapshots for variance tracking
#
# Captures a point-in-time snapshot of the schedule to compare
# actual progress against planned progress.
#
class SmBaseline < ApplicationRecord
  belongs_to :construction
  belongs_to :created_by, class_name: 'User', optional: true

  has_many :baseline_tasks, class_name: 'SmBaselineTask', dependent: :destroy

  validates :name, presence: true
  validates :baseline_date, presence: true

  # Scopes
  scope :recent, -> { order(created_at: :desc) }
  scope :active, -> { where(is_active: true) }

  # Callbacks
  before_create :deactivate_previous_baseline

  # Instance methods
  def capture_snapshot!
    construction.sm_tasks.each do |task|
      baseline_tasks.create!(
        sm_task_id: task.id,
        planned_start: task.start_date,
        planned_end: task.end_date,
        planned_duration: task.duration_days,
        planned_status: task.status,
        planned_cost: task.estimated_cost
      )
    end

    update!(task_count: baseline_tasks.count)
  end

  def compare_to_current
    variances = []

    baseline_tasks.includes(:task).each do |bt|
      task = bt.task
      next unless task

      start_variance = task.start_date && bt.planned_start ?
        (task.start_date - bt.planned_start).to_i : nil
      end_variance = task.end_date && bt.planned_end ?
        (task.end_date - bt.planned_end).to_i : nil
      duration_variance = task.duration_days && bt.planned_duration ?
        task.duration_days - bt.planned_duration : nil

      variances << {
        task_id: task.id,
        task_name: task.name,
        baseline: {
          start: bt.planned_start,
          end: bt.planned_end,
          duration: bt.planned_duration,
          status: bt.planned_status
        },
        current: {
          start: task.start_date,
          end: task.end_date,
          duration: task.duration_days,
          status: task.status
        },
        variance: {
          start_days: start_variance,
          end_days: end_variance,
          duration_days: duration_variance,
          status_changed: task.status != bt.planned_status
        },
        is_delayed: (end_variance || 0) > 0,
        is_ahead: (end_variance || 0) < 0
      }
    end

    {
      baseline: { id: id, name: name, date: baseline_date },
      comparison_date: Date.current,
      tasks: variances,
      summary: build_comparison_summary(variances)
    }
  end

  private

  def deactivate_previous_baseline
    construction.sm_baselines.active.update_all(is_active: false)
    self.is_active = true
  end

  def build_comparison_summary(variances)
    delayed = variances.count { |v| v[:is_delayed] }
    ahead = variances.count { |v| v[:is_ahead] }
    on_track = variances.count { |v| !v[:is_delayed] && !v[:is_ahead] }

    total_start_variance = variances.sum { |v| v[:variance][:start_days] || 0 }
    total_end_variance = variances.sum { |v| v[:variance][:end_days] || 0 }

    {
      total_tasks: variances.size,
      delayed_tasks: delayed,
      ahead_tasks: ahead,
      on_track_tasks: on_track,
      average_start_variance: variances.size > 0 ? (total_start_variance.to_f / variances.size).round(1) : 0,
      average_end_variance: variances.size > 0 ? (total_end_variance.to_f / variances.size).round(1) : 0,
      schedule_health: calculate_health(delayed, variances.size)
    }
  end

  def calculate_health(delayed, total)
    return 'unknown' if total == 0

    ratio = delayed.to_f / total
    if ratio <= 0.1
      'excellent'
    elsif ratio <= 0.25
      'good'
    elsif ratio <= 0.5
      'at_risk'
    else
      'critical'
    end
  end

  class << self
    def create_snapshot(construction, name:, created_by: nil)
      baseline = create!(
        construction: construction,
        name: name,
        baseline_date: Date.current,
        created_by: created_by
      )
      baseline.capture_snapshot!
      baseline
    end
  end
end
