# Create historical snapshot table for job metrics
# Unlike materialized views (current state), this table preserves history for trend analysis
# Sprint 7: Historical Snapshots (Gold Layer)
class CreateFactJobDailySnapshot < ActiveRecord::Migration[8.0]
  def change
    create_table :fact_job_daily_snapshots do |t|
      t.date :snapshot_date, null: false
      t.references :job, null: false, foreign_key: true

      # Financial metrics at this point in time
      t.decimal :total_income, precision: 15, scale: 2, default: 0
      t.decimal :total_expenses, precision: 15, scale: 2, default: 0
      t.decimal :profit, precision: 15, scale: 2, default: 0
      t.decimal :profit_margin, precision: 5, scale: 2

      # PO metrics
      t.integer :po_count, default: 0
      t.decimal :po_total_value, precision: 15, scale: 2, default: 0
      t.decimal :po_invoiced_amount, precision: 15, scale: 2, default: 0

      # Invoice metrics
      t.integer :invoice_count, default: 0
      t.decimal :invoiced_total, precision: 15, scale: 2, default: 0
      t.decimal :paid_total, precision: 15, scale: 2, default: 0

      # Document metrics
      t.integer :document_count, default: 0
      t.integer :verified_document_count, default: 0
      t.integer :email_count, default: 0

      # Task/Schedule metrics
      t.integer :task_count, default: 0
      t.integer :completed_task_count, default: 0
      t.integer :in_progress_task_count, default: 0
      t.decimal :hours_logged, precision: 10, scale: 2, default: 0
      t.decimal :approved_hours, precision: 10, scale: 2, default: 0
      t.decimal :completion_rate, precision: 5, scale: 2

      # Job status at snapshot time
      t.string :job_status
      t.string :job_type

      t.timestamps
    end

    # Unique constraint: one snapshot per job per day
    add_index :fact_job_daily_snapshots, [ :job_id, :snapshot_date ], unique: true, name: 'idx_fact_job_snapshot_unique'

    # Query indexes
    add_index :fact_job_daily_snapshots, :snapshot_date
    add_index :fact_job_daily_snapshots, [ :snapshot_date, :job_status ]
  end
end
