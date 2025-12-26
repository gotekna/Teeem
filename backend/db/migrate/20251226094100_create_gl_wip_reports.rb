# frozen_string_literal: true

class CreateGlWipReports < ActiveRecord::Migration[7.1]
  def change
    # WIP Report headers
    create_table :gl_wip_reports do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }

      t.string :reference, null: false
      t.date :report_date, null: false
      t.date :period_start
      t.date :period_end

      # Status
      t.string :status, default: "draft", limit: 20  # draft, final, archived

      # Summary totals
      t.decimal :total_contract_value, precision: 15, scale: 2, default: 0
      t.decimal :total_costs_to_date, precision: 15, scale: 2, default: 0
      t.decimal :total_estimated_costs, precision: 15, scale: 2, default: 0
      t.decimal :total_revenue_recognized, precision: 15, scale: 2, default: 0
      t.decimal :total_billings_to_date, precision: 15, scale: 2, default: 0
      t.decimal :total_wip_asset, precision: 15, scale: 2, default: 0  # Costs > Billings
      t.decimal :total_wip_liability, precision: 15, scale: 2, default: 0  # Billings > Revenue

      t.text :notes

      t.timestamps
    end

    add_index :gl_wip_reports, [:corporate_company_id, :report_date],
              name: "idx_wip_reports_date"
    add_index :gl_wip_reports, [:corporate_company_id, :reference],
              unique: true, name: "idx_wip_reports_ref"

    # WIP Report job details
    create_table :gl_wip_report_jobs do |t|
      t.references :wip_report, null: false, foreign_key: { to_table: :gl_wip_reports }
      t.references :job, null: false, foreign_key: true

      # Contract info
      t.decimal :contract_value, precision: 15, scale: 2, null: false
      t.decimal :approved_variations, precision: 15, scale: 2, default: 0
      t.decimal :revised_contract_value, precision: 15, scale: 2

      # Costs
      t.decimal :costs_to_date, precision: 15, scale: 2, default: 0
      t.decimal :estimated_costs_to_complete, precision: 15, scale: 2, default: 0
      t.decimal :total_estimated_costs, precision: 15, scale: 2

      # Progress
      t.decimal :completion_percentage, precision: 5, scale: 2
      t.string :completion_method, default: "cost_to_cost", limit: 30  # cost_to_cost, units_delivered, milestones

      # Revenue recognition (percentage of completion)
      t.decimal :revenue_recognized, precision: 15, scale: 2
      t.decimal :revenue_recognized_prior, precision: 15, scale: 2, default: 0
      t.decimal :revenue_this_period, precision: 15, scale: 2

      # Billings
      t.decimal :billings_to_date, precision: 15, scale: 2, default: 0
      t.decimal :unbilled_revenue, precision: 15, scale: 2  # Revenue - Billings (if positive)

      # WIP position
      t.decimal :costs_in_excess_of_billings, precision: 15, scale: 2, default: 0  # Asset
      t.decimal :billings_in_excess_of_costs, precision: 15, scale: 2, default: 0  # Liability

      # Profitability
      t.decimal :gross_profit, precision: 15, scale: 2
      t.decimal :gross_profit_pct, precision: 5, scale: 2
      t.decimal :estimated_profit_at_completion, precision: 15, scale: 2

      t.text :notes
      t.string :status  # active, completed, on_hold, loss_expected

      t.timestamps
    end

    add_index :gl_wip_report_jobs, [:wip_report_id, :job_id],
              unique: true, name: "idx_wip_jobs_unique"
  end
end
