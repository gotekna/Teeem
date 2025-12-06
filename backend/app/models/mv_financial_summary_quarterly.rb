# Quarterly financial summary materialized view
# Pre-aggregated quarterly rollups of financial transactions
class MvFinancialSummaryQuarterly < ApplicationRecord
  self.table_name = "mv_financial_summary_quarterly"
  self.primary_key = nil  # No single primary key for this view

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :for_year, ->(year) { where(year: year) }
  scope :income, -> { where(transaction_type: "income") }
  scope :expense, -> { where(transaction_type: "expense") }
  scope :recent, ->(quarters = 4) { where("quarter_start >= ?", (quarters * 3).months.ago.beginning_of_quarter) }

  # Get totals for a company within a date range
  def self.totals_for_range(company_id, start_date, end_date)
    where(company_id: company_id)
      .where(quarter_start: start_date..end_date)
      .group(:transaction_type)
      .select(
        "transaction_type",
        "SUM(total_amount) as total",
        "SUM(transaction_count) as count",
        "AVG(avg_amount) as average"
      )
  end

  # Get quarter-over-quarter growth
  def self.quarter_over_quarter(company_id, quarter_start)
    current = where(company_id: company_id, quarter_start: quarter_start).sum(:total_amount)
    previous = where(company_id: company_id, quarter_start: quarter_start - 3.months).sum(:total_amount)

    growth_pct = previous > 0 ? ((current - previous) / previous * 100).round(2) : nil

    {
      current_quarter: quarter_start,
      current_total: current,
      previous_quarter: quarter_start - 3.months,
      previous_total: previous,
      change: current - previous,
      growth_percentage: growth_pct
    }
  end

  # Get fiscal year summary (assuming July-June fiscal year for AU)
  def self.fiscal_year_summary(company_id, fiscal_year_end)
    fiscal_start = fiscal_year_end - 1.year + 1.day
    where(company_id: company_id)
      .where(quarter_start: fiscal_start..fiscal_year_end)
      .group(:transaction_type)
      .sum(:total_amount)
  end
end
