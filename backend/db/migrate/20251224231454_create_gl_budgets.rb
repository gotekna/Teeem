# frozen_string_literal: true

class CreateGlBudgets < ActiveRecord::Migration[8.0]
  def change
    create_table :gl_budgets do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :gl_account, null: false, foreign_key: true
      t.references :gl_period, null: false, foreign_key: true

      # External provider linking
      t.string :external_provider         # 'xero', 'quickbooks', 'myob', nil
      t.string :external_tenant_id        # Provider's org/company ID

      # Budget Amount
      t.decimal :amount, precision: 15, scale: 2, null: false

      # Budget Type
      t.string :budget_type, default: 'monthly'  # monthly, quarterly, annual

      # Tracking (optional - for departmental budgets)
      t.string :tracking_category
      t.string :tracking_option

      # Job linking (optional - for job budgets)
      t.references :job, foreign_key: true

      # Notes
      t.text :notes

      t.timestamps
    end

    # Unique constraint: one budget per account per period (per tracking if used)
    add_index :gl_budgets, [:gl_account_id, :gl_period_id, :tracking_category, :tracking_option, :job_id],
              unique: true, name: 'idx_gl_budgets_unique'

    # Performance indexes
    add_index :gl_budgets, :budget_type
  end
end
