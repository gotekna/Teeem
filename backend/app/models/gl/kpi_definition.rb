# frozen_string_literal: true

module Gl
  # Key Performance Indicator definition
  class KpiDefinition < ApplicationRecord
    self.table_name = "gl_kpi_definitions"

    CATEGORIES = %w[profitability liquidity efficiency growth].freeze
    FORMULA_TYPES = %w[ratio percentage sum average custom].freeze
    FORMATS = %w[currency percent number days].freeze
    DIRECTIONS = %w[higher_is_better lower_is_better target_range].freeze

    belongs_to :corporate_company, class_name: "Corporate", foreign_key: "company_id"

    validates :name, presence: true
    validates :code, presence: true, uniqueness: { scope: :corporate_company_id }
    validates :formula_type, presence: true, inclusion: { in: FORMULA_TYPES }
    validates :category, inclusion: { in: CATEGORIES }, allow_blank: true
    validates :format, inclusion: { in: FORMATS }, allow_blank: true
    validates :target_direction, inclusion: { in: DIRECTIONS }, allow_blank: true

    scope :active, -> { where(active: true) }
    scope :on_dashboard, -> { where(show_on_dashboard: true) }
    scope :ordered, -> { order(:position, :name) }

    # Calculate KPI value for a period
    def calculate(start_date: nil, end_date: nil)
      start_date ||= Date.current.beginning_of_month
      end_date ||= Date.current.end_of_month

      case formula_type
      when "ratio"
        calculate_ratio(start_date, end_date)
      when "percentage"
        calculate_percentage(start_date, end_date)
      when "sum"
        calculate_sum(start_date, end_date)
      when "average"
        calculate_average(start_date, end_date)
      when "custom"
        calculate_custom(start_date, end_date)
      else
        0
      end
    rescue StandardError
      nil
    end

    # Check status against thresholds
    def status(value)
      return "unknown" if value.nil?
      return "on_target" if target_value.nil?

      case target_direction
      when "higher_is_better"
        if critical_threshold && value < critical_threshold
          "critical"
        elsif warning_threshold && value < warning_threshold
          "warning"
        elsif value >= target_value
          "on_target"
        else
          "below_target"
        end
      when "lower_is_better"
        if critical_threshold && value > critical_threshold
          "critical"
        elsif warning_threshold && value > warning_threshold
          "warning"
        elsif value <= target_value
          "on_target"
        else
          "above_target"
        end
      else
        "unknown"
      end
    end

    # Format value for display
    def format_value(value)
      return "N/A" if value.nil?

      case format
      when "currency"
        "$#{value.round(2).to_s(:delimited)}"
      when "percent"
        "#{value.round(2)}%"
      when "days"
        "#{value.round(1)} days"
      else
        value.round(2).to_s
      end
    end

    # Seed common KPIs
    def self.seed_common!(company)
      kpis = [
        {
          name: "Gross Profit Margin",
          code: "gross_margin",
          category: "profitability",
          formula_type: "percentage",
          formula: { numerator: "gross_profit", denominator: "revenue" },
          format: "percent",
          target_value: 30,
          target_direction: "higher_is_better",
          show_on_dashboard: true
        },
        {
          name: "Net Profit Margin",
          code: "net_margin",
          category: "profitability",
          formula_type: "percentage",
          formula: { numerator: "net_profit", denominator: "revenue" },
          format: "percent",
          target_value: 10,
          target_direction: "higher_is_better",
          show_on_dashboard: true
        },
        {
          name: "Current Ratio",
          code: "current_ratio",
          category: "liquidity",
          formula_type: "ratio",
          formula: { numerator: "current_assets", denominator: "current_liabilities" },
          format: "number",
          target_value: 2.0,
          target_direction: "higher_is_better",
          warning_threshold: 1.5,
          critical_threshold: 1.0
        },
        {
          name: "Days Sales Outstanding",
          code: "dso",
          category: "efficiency",
          formula_type: "custom",
          formula: { calculation: "dso" },
          format: "days",
          target_value: 30,
          target_direction: "lower_is_better",
          warning_threshold: 45,
          critical_threshold: 60,
          show_on_dashboard: true
        },
        {
          name: "Revenue Growth",
          code: "revenue_growth",
          category: "growth",
          formula_type: "percentage",
          formula: { calculation: "yoy_revenue_growth" },
          format: "percent",
          target_value: 10,
          target_direction: "higher_is_better",
          show_on_dashboard: true
        },
        {
          name: "Operating Expense Ratio",
          code: "opex_ratio",
          category: "efficiency",
          formula_type: "percentage",
          formula: { numerator: "operating_expenses", denominator: "revenue" },
          format: "percent",
          target_value: 20,
          target_direction: "lower_is_better"
        }
      ]

      kpis.each_with_index do |kpi, index|
        find_or_create_by!(corporate_company: company, code: kpi[:code]) do |k|
          k.assign_attributes(kpi.merge(position: index))
        end
      end
    end

    private

    def calculate_ratio(start_date, end_date)
      num = get_metric(formula["numerator"], start_date, end_date)
      denom = get_metric(formula["denominator"], start_date, end_date)
      return nil if denom.nil? || denom.zero?
      num / denom
    end

    def calculate_percentage(start_date, end_date)
      ratio = calculate_ratio(start_date, end_date)
      ratio ? ratio * 100 : nil
    end

    def calculate_sum(start_date, end_date)
      get_metric(formula["metric"], start_date, end_date)
    end

    def calculate_average(start_date, end_date)
      get_metric(formula["metric"], start_date, end_date)
    end

    def calculate_custom(start_date, end_date)
      case formula["calculation"]
      when "dso"
        calculate_dso(start_date, end_date)
      when "yoy_revenue_growth"
        calculate_yoy_growth(start_date, end_date)
      end
    end

    def get_metric(metric_name, start_date, end_date)
      case metric_name
      when "revenue"
        corporate_company.gl_invoices.sales.where(date: start_date..end_date).sum(:total)
      when "gross_profit"
        revenue = get_metric("revenue", start_date, end_date)
        cogs = get_metric("cogs", start_date, end_date)
        revenue - cogs
      when "cogs"
        corporate_company.gl_accounts.where(account_type: "expense", code: /^5/).sum(:balance).abs
      when "net_profit"
        revenue = get_metric("revenue", start_date, end_date)
        expenses = corporate_company.gl_invoices.bills.where(date: start_date..end_date).sum(:total)
        revenue - expenses
      when "current_assets"
        corporate_company.gl_accounts.where(account_type: "asset").where("code < '2'").sum(:balance)
      when "current_liabilities"
        corporate_company.gl_accounts.where(account_type: "liability").where("code < '3'").sum(:balance).abs
      when "operating_expenses"
        corporate_company.gl_invoices.bills.where(date: start_date..end_date).sum(:total)
      else
        0
      end
    end

    def calculate_dso(start_date, end_date)
      revenue = get_metric("revenue", start_date, end_date)
      return nil if revenue.zero?

      ar_balance = corporate_company.gl_accounts.where(account_type: "asset", name: /receivable/i).sum(:balance)
      days = (end_date - start_date).to_i

      (ar_balance / revenue) * days
    end

    def calculate_yoy_growth(_start_date, end_date)
      current_year_revenue = corporate_company.gl_invoices.sales
                                              .where(date: end_date.beginning_of_year..end_date)
                                              .sum(:total)

      prior_year_end = end_date - 1.year
      prior_year_revenue = corporate_company.gl_invoices.sales
                                            .where(date: prior_year_end.beginning_of_year..prior_year_end)
                                            .sum(:total)

      return nil if prior_year_revenue.zero?

      ((current_year_revenue - prior_year_revenue) / prior_year_revenue) * 100
    end
  end
end
