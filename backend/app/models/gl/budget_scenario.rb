# frozen_string_literal: true

module Gl
  # Budget scenarios for what-if analysis
  class BudgetScenario < ApplicationRecord
    self.table_name = "gl_budget_scenarios"

    SCENARIO_TYPES = %w[base optimistic pessimistic stretch custom].freeze
    STATUSES = %w[draft active archived].freeze

    belongs_to :corporate_company
    belongs_to :created_by, class_name: "User", optional: true

    validates :name, presence: true
    validates :scenario_type, presence: true, inclusion: { in: SCENARIO_TYPES }
    validates :fiscal_year, presence: true
    validates :status, presence: true, inclusion: { in: STATUSES }

    scope :active, -> { where(status: "active") }
    scope :for_year, ->(year) { where(fiscal_year: year) }
    scope :default_scenario, -> { where(is_default: true) }

    # Get budgets for this scenario
    def budgets
      Gl::Budget.where(
        corporate_company_id: corporate_company_id,
        scenario: scenario_type
      ).for_financial_year(fiscal_year)
    end

    # Apply adjustments to base scenario to create this scenario
    def apply_from_base!
      base_budgets = Gl::Budget.where(
        corporate_company_id: corporate_company_id,
        scenario: "base"
      ).for_financial_year(fiscal_year)

      base_budgets.find_each do |base|
        adjustment = if base.gl_account.account_type == "revenue"
                       revenue_adjustment_pct
                     else
                       expense_adjustment_pct
                     end

        new_amount = base.amount * (1 + (adjustment || 0) / 100.0)

        Gl::Budget.create!(
          base.attributes.except("id", "created_at", "updated_at").merge(
            scenario: scenario_type,
            amount: new_amount.round(2),
            scenario_assumptions: assumptions
          )
        )
      end
    end

    # Compare scenarios
    def compare_with(other_scenario)
      result = {}

      budgets.includes(:gl_account).find_each do |budget|
        other = other_scenario.budgets.find_by(gl_account_id: budget.gl_account_id)
        next unless other

        result[budget.gl_account.code] = {
          account_name: budget.gl_account.name,
          this_amount: budget.amount,
          other_amount: other.amount,
          difference: budget.amount - other.amount,
          difference_pct: other.amount.positive? ? ((budget.amount - other.amount) / other.amount * 100).round(1) : 0
        }
      end

      result
    end

    # Summary metrics
    def summary
      buds = budgets.includes(:gl_account)

      {
        total_revenue: buds.joins(:gl_account).where(gl_accounts: { account_type: "revenue" }).sum(:amount),
        total_expenses: buds.joins(:gl_account).where(gl_accounts: { account_type: "expense" }).sum(:amount),
        net_income: calculate_net_income(buds),
        budget_count: buds.count
      }
    end

    # Set as default scenario for the year
    def set_as_default!
      transaction do
        self.class.where(
          corporate_company_id: corporate_company_id,
          fiscal_year: fiscal_year
        ).update_all(is_default: false)

        update!(is_default: true)
      end
    end

    def assumptions_hash
      return {} if assumptions.blank?

      JSON.parse(assumptions)
    rescue JSON::ParserError
      {}
    end

    def assumptions_hash=(hash)
      self.assumptions = hash.to_json
    end

    private

    def calculate_net_income(buds)
      revenue = buds.joins(:gl_account).where(gl_accounts: { account_type: "revenue" }).sum(:amount)
      expenses = buds.joins(:gl_account).where(gl_accounts: { account_type: "expense" }).sum(:amount)
      revenue - expenses
    end
  end
end
