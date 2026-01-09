# frozen_string_literal: true

class AddScenarioToGlBudgets < ActiveRecord::Migration[7.1]
  def change
    # Add scenario support to existing budgets table
    add_column :gl_budgets, :scenario, :string, limit: 30, default: "base"
    add_column :gl_budgets, :scenario_assumptions, :text

    add_index :gl_budgets, [:corporate_company_id, :gl_period_id, :scenario],
              name: "idx_budgets_period_scenario"

    # Budget scenarios (groups of budgets)
    create_table :gl_budget_scenarios do |t|
      t.references :corporate_company, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }

      t.string :name, null: false
      t.string :scenario_type, null: false, default: "base", limit: 30  # base, optimistic, pessimistic, stretch, custom
      t.integer :fiscal_year, null: false

      t.text :description
      t.text :assumptions  # JSON with key assumptions

      # Adjustments (for quick what-if analysis)
      t.decimal :revenue_adjustment_pct, precision: 5, scale: 2, default: 0
      t.decimal :expense_adjustment_pct, precision: 5, scale: 2, default: 0

      t.string :status, default: "draft", limit: 20  # draft, active, archived
      t.boolean :is_default, default: false

      t.timestamps
    end

    add_index :gl_budget_scenarios, [:corporate_company_id, :fiscal_year, :scenario_type],
              name: "idx_budget_scenarios_year"
  end
end
