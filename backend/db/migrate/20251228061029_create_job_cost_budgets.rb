# frozen_string_literal: true

# JobCostBudget - Budget vs actuals tracking for jobs
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Tracks budgets by category and caches actual spend for real-time
# profitability dashboards and margin alerts.
#
class CreateJobCostBudgets < ActiveRecord::Migration[8.0]
  def change
    create_table :job_cost_budgets do |t|
      t.references :job, null: false, foreign_key: true
      t.references :cost_centre, foreign_key: true

      # Budget categories
      t.decimal :labour_budget, precision: 14, scale: 2, default: 0
      t.decimal :materials_budget, precision: 14, scale: 2, default: 0
      t.decimal :subcontractor_budget, precision: 14, scale: 2, default: 0
      t.decimal :equipment_budget, precision: 14, scale: 2, default: 0
      t.decimal :overhead_budget, precision: 14, scale: 2, default: 0
      t.decimal :contingency_budget, precision: 14, scale: 2, default: 0
      t.decimal :total_budget, precision: 14, scale: 2, default: 0

      # Alert thresholds (% of budget)
      t.decimal :warning_threshold_percent, precision: 5, scale: 2, default: 80
      t.decimal :critical_threshold_percent, precision: 5, scale: 2, default: 100

      # Cached actuals (updated by background job)
      t.decimal :labour_actual, precision: 14, scale: 2, default: 0
      t.decimal :materials_actual, precision: 14, scale: 2, default: 0
      t.decimal :subcontractor_actual, precision: 14, scale: 2, default: 0
      t.decimal :equipment_actual, precision: 14, scale: 2, default: 0
      t.decimal :overhead_actual, precision: 14, scale: 2, default: 0
      t.decimal :total_actual, precision: 14, scale: 2, default: 0

      # Variance calculations (cached)
      t.decimal :labour_variance, precision: 14, scale: 2              # Budget - Actual
      t.decimal :labour_variance_percent, precision: 5, scale: 2       # (Actual/Budget) * 100
      t.decimal :total_variance, precision: 14, scale: 2
      t.decimal :total_variance_percent, precision: 5, scale: 2

      # Profitability
      t.decimal :estimated_margin, precision: 14, scale: 2
      t.decimal :estimated_margin_percent, precision: 5, scale: 2
      t.decimal :actual_margin, precision: 14, scale: 2
      t.decimal :actual_margin_percent, precision: 5, scale: 2

      # Alert status
      t.string :alert_status, limit: 20, default: "ok"
      # "ok", "warning", "critical", "over_budget"
      t.datetime :last_alert_at
      t.datetime :last_alert_acknowledged_at
      t.references :alert_acknowledged_by, foreign_key: { to_table: :users, on_delete: :nullify }

      # Cache tracking
      t.datetime :last_calculated_at
      t.string :calculation_status, limit: 20, default: "pending"
      # "pending", "calculating", "completed", "error"

      # Notes
      t.text :notes

      t.timestamps
    end

    # Indexes
    add_index :job_cost_budgets, :alert_status
    add_index :job_cost_budgets, :last_calculated_at

    # Ensure one budget per job (or per job+cost_centre combination)
    add_index :job_cost_budgets, [:job_id, :cost_centre_id], unique: true
  end
end
