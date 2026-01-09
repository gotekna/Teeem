# frozen_string_literal: true

# Performance Observatory - Q3: SLOs and Error Budgets
#
# Creates tables for Service Level Objectives (SLOs) and error budget tracking.
#
# Tables:
# - performance_slos: Define SLO targets (e.g., "API P95 < 500ms")
# - performance_slo_snapshots: Daily snapshots of SLO compliance
#
# SLI Types (Service Level Indicators):
# - latency: P95 response time target
# - availability: Uptime percentage target
# - error_rate: Maximum error rate target
# - throughput: Minimum requests per minute
# - vital: Web Vital metric target (LCP, CLS, etc.)
#
class CreatePerformanceSlos < ActiveRecord::Migration[8.0]
  def change
    # SLO definitions
    create_table :performance_slos do |t|
      t.string :name, null: false  # Human-readable name
      t.string :sli_type, null: false  # latency, availability, error_rate, throughput, vital
      t.string :endpoint  # Specific endpoint (nil = global)
      t.string :metric_name  # For vitals: LCP, CLS, etc.
      t.float :target_value, null: false  # Target value (e.g., 500 for 500ms)
      t.string :target_unit  # ms, %, req/min
      t.string :comparison, default: "lte"  # lte, gte, lt, gt
      t.float :error_budget_percent, default: 0.1  # 0.1% = 99.9% target
      t.boolean :active, default: true
      t.string :owner  # Team/person responsible
      t.text :description
      t.timestamps
    end

    add_index :performance_slos, :sli_type
    add_index :performance_slos, :endpoint
    add_index :performance_slos, :active

    # Daily SLO compliance snapshots
    create_table :performance_slo_snapshots do |t|
      t.references :performance_slo, null: false, foreign_key: true
      t.date :snapshot_date, null: false
      t.integer :total_events, default: 0  # Total requests/samples
      t.integer :good_events, default: 0  # Events meeting SLO
      t.integer :bad_events, default: 0  # Events violating SLO
      t.float :compliance_percent  # % of events meeting SLO
      t.float :error_budget_remaining  # % of error budget remaining
      t.float :error_budget_consumed  # % of error budget consumed
      t.float :observed_value  # Actual measured value (e.g., P95 latency)
      t.boolean :slo_met  # Did we meet the SLO today?
      t.jsonb :metadata, default: {}  # Additional context
      t.timestamps
    end

    add_index :performance_slo_snapshots, [:performance_slo_id, :snapshot_date],
      unique: true, name: "idx_slo_snapshots_slo_date"
    add_index :performance_slo_snapshots, :snapshot_date
    add_index :performance_slo_snapshots, :slo_met
  end
end
