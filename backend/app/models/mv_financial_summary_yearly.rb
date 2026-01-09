# Yearly financial summary materialized view
# Pre-aggregated yearly rollups of financial transactions
class MvFinancialSummaryYearly < ApplicationRecord
  self.table_name = "mv_financial_summary_yearly"
  self.primary_key = nil  # No single primary key for this view

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :for_year, ->(year) { where(year: year) }
  scope :income, -> { where(transaction_type: "income") }
  scope :expense, -> { where(transaction_type: "expense") }

  # Get year-over-year comparison for all years
  def self.year_over_year_trend(company_id, years = 5)
    where(company_id: company_id)
      .where("year >= ?", Date.current.year - years)
      .group(:year)
      .select(
        "year",
        "SUM(CASE WHEN transaction_type = 'income' THEN total_amount ELSE 0 END) as total_income",
        "SUM(CASE WHEN transaction_type = 'expense' THEN total_amount ELSE 0 END) as total_expenses",
        "SUM(CASE WHEN transaction_type = 'income' THEN total_amount ELSE 0 END) - SUM(CASE WHEN transaction_type = 'expense' THEN total_amount ELSE 0 END) as net_profit"
      )
      .order(:year)
  end

  # Get profit margin trend
  def self.profit_margin_trend(company_id)
    trend = year_over_year_trend(company_id)

    trend.map do |row|
      margin = row.total_income > 0 ? (row.net_profit / row.total_income * 100).round(2) : 0
      {
        year: row.year,
        income: row.total_income,
        expenses: row.total_expenses,
        net_profit: row.net_profit,
        profit_margin_pct: margin
      }
    end
  end

  # Get category breakdown for a year
  def self.category_breakdown(company_id, year)
    where(company_id: company_id, year: year)
      .group(:category, :transaction_type)
      .select(
        "category",
        "transaction_type",
        "SUM(total_amount) as total",
        "SUM(transaction_count) as count"
      )
      .order("total DESC")
  end

  # Get compound annual growth rate (CAGR)
  def self.calculate_cagr(company_id, start_year, end_year, transaction_type = "income")
    start_value = where(company_id: company_id, year: start_year, transaction_type: transaction_type).sum(:total_amount)
    end_value = where(company_id: company_id, year: end_year, transaction_type: transaction_type).sum(:total_amount)

    return nil if start_value <= 0 || end_value <= 0

    years = end_year - start_year
    return nil if years <= 0

    cagr = ((end_value / start_value) ** (1.0 / years) - 1) * 100
    cagr.round(2)
  end
end
