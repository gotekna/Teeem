# Weekly financial summary materialized view
# Pre-aggregated weekly rollups of financial transactions
class MvFinancialSummaryWeekly < ApplicationRecord
  self.table_name = "mv_financial_summary_weekly"
  self.primary_key = nil  # No single primary key for this view

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :for_year, ->(year) { where(year: year) }
  scope :income, -> { where(transaction_type: "income") }
  scope :expense, -> { where(transaction_type: "expense") }
  scope :recent, ->(weeks = 12) { where("week_start >= ?", weeks.weeks.ago.beginning_of_week) }

  # Get totals for a company within a date range
  def self.totals_for_range(company_id, start_date, end_date)
    where(company_id: company_id)
      .where(week_start: start_date..end_date)
      .group(:transaction_type)
      .select(
        "transaction_type",
        "SUM(total_amount) as total",
        "SUM(transaction_count) as count",
        "AVG(avg_amount) as average"
      )
  end

  # Compare current week to same week last year
  def self.year_over_year_comparison(company_id, week_start)
    current = where(company_id: company_id, week_start: week_start)
    previous = where(company_id: company_id, week_start: week_start - 1.year)

    {
      current: current.sum(:total_amount),
      previous: previous.sum(:total_amount),
      change: current.sum(:total_amount) - previous.sum(:total_amount)
    }
  end
end
