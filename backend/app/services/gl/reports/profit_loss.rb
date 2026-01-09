# frozen_string_literal: true

module Gl
  module Reports
    # Profit & Loss Report
    #
    # Generates a Profit & Loss statement for a date range.
    # Shows Revenue, Cost of Sales, Gross Profit, Operating Expenses, and Net Profit.
    #
    # Usage:
    #   report = Gl::Reports::ProfitLoss.new(corporate_company, provider: 'xero', tenant_id: 'abc')
    #   result = report.generate(from_date: Date.new(2024, 7, 1), to_date: Date.new(2024, 12, 31))
    #
    class ProfitLoss
      attr_reader :corporate_company, :external_provider, :external_tenant_id

      # Account classes for each section
      REVENUE_CLASSES = %w[revenue other_income].freeze
      COST_OF_SALES_CLASSES = %w[direct_costs].freeze
      EXPENSE_CLASSES = %w[expense overhead depreciation].freeze

      def initialize(corporate_company, provider: nil, tenant_id: nil)
        @corporate_company = corporate_company
        @external_provider = provider
        @external_tenant_id = tenant_id
      end

      # Generate P&L report for a date range
      def generate(from_date:, to_date:, compare_prior_period: false)
        calculator = Gl::BalanceCalculator.new(
          corporate_company,
          provider: external_provider,
          tenant_id: external_tenant_id
        )

        # Get all active revenue and expense accounts
        accounts = scoped_accounts.active.where(account_type: %w[revenue expense])

        # Build report sections
        revenue_section = build_section(accounts, REVENUE_CLASSES, from_date, to_date, calculator)
        cos_section = build_section(accounts, COST_OF_SALES_CLASSES, from_date, to_date, calculator)
        expense_section = build_section(accounts, EXPENSE_CLASSES, from_date, to_date, calculator)

        # Calculate totals
        total_revenue = revenue_section[:total]
        total_cos = cos_section[:total]
        gross_profit = total_revenue - total_cos
        total_expenses = expense_section[:total]
        net_profit = gross_profit - total_expenses

        result = {
          report_type: 'profit_loss',
          from_date: from_date,
          to_date: to_date,
          generated_at: Time.current,
          provider: external_provider,
          tenant_id: external_tenant_id,

          # Sections
          revenue: revenue_section,
          cost_of_sales: cos_section,
          gross_profit: gross_profit,
          gross_margin: total_revenue.positive? ? (gross_profit / total_revenue * 100).round(2) : 0,
          operating_expenses: expense_section,
          net_profit: net_profit,
          net_margin: total_revenue.positive? ? (net_profit / total_revenue * 100).round(2) : 0,

          # Summary
          summary: {
            total_revenue: total_revenue,
            total_cost_of_sales: total_cos,
            gross_profit: gross_profit,
            total_operating_expenses: total_expenses,
            net_profit: net_profit
          }
        }

        # Add prior period comparison if requested
        if compare_prior_period
          prior_from, prior_to = calculate_prior_period(from_date, to_date)
          prior_result = generate(from_date: prior_from, to_date: prior_to)
          result[:prior_period] = prior_result
          result[:variance] = calculate_variance(result[:summary], prior_result[:summary])
        end

        result
      end

      # Generate YTD P&L
      def generate_ytd(as_of_date: Date.current)
        fy = Gl::Period.financial_year_for(as_of_date)
        fy_start = fy_start_date(fy)

        generate(from_date: fy_start, to_date: as_of_date)
      end

      # Generate monthly breakdown for a financial year
      def generate_monthly(financial_year)
        periods = Gl::Period
          .where(corporate_company: corporate_company)
          .where(financial_year: financial_year)
          .order(:period_start)

        months = periods.map do |period|
          monthly = generate(from_date: period.period_start, to_date: period.period_end)
          {
            period: period.period_name,
            period_number: period.period_number,
            from_date: period.period_start,
            to_date: period.period_end,
            revenue: monthly[:summary][:total_revenue],
            cost_of_sales: monthly[:summary][:total_cost_of_sales],
            gross_profit: monthly[:summary][:gross_profit],
            operating_expenses: monthly[:summary][:total_operating_expenses],
            net_profit: monthly[:summary][:net_profit]
          }
        end

        {
          financial_year: financial_year,
          months: months,
          ytd: generate(from_date: periods.first&.period_start, to_date: periods.last&.period_end)
        }
      end

      private

      def build_section(accounts, account_classes, from_date, to_date, calculator)
        section_accounts = accounts.where(account_class: account_classes).order(:code)

        lines = section_accounts.map do |account|
          # For P&L accounts, we want the movements during the period, not the balance
          amount = calculate_movements(account, from_date, to_date)
          next if amount.zero?

          {
            account_id: account.id,
            code: account.code,
            name: account.name,
            account_class: account.account_class,
            amount: amount
          }
        end.compact

        {
          accounts: lines,
          total: lines.sum { |l| l[:amount] }
        }
      end

      def calculate_movements(account, from_date, to_date)
        # Use pick to avoid ORDER BY conflict with aggregate functions
        net = Gl::LedgerLine
          .joins(:gl_journal_entry)
          .where(gl_account: account)
          .where(gl_journal_entries: { status: 'posted' })
          .where(gl_journal_entries: { entry_date: from_date..to_date })
          .pick(Arel.sql('COALESCE(SUM(credit) - SUM(debit), 0)'))

        # Revenue/Income accounts have credit normal, so credits increase the balance
        # Expense accounts have debit normal, so debits increase (we negate)
        if account.account_type == 'revenue'
          net.to_d
        else
          -net.to_d
        end
      end

      def calculate_prior_period(from_date, to_date)
        # Same duration, but prior period
        duration = (to_date - from_date).to_i
        prior_to = from_date - 1.day
        prior_from = prior_to - duration.days

        [prior_from, prior_to]
      end

      def calculate_variance(current, prior)
        {
          revenue: {
            amount: current[:total_revenue] - prior[:total_revenue],
            percentage: prior[:total_revenue].positive? ?
              ((current[:total_revenue] - prior[:total_revenue]) / prior[:total_revenue] * 100).round(2) : nil
          },
          gross_profit: {
            amount: current[:gross_profit] - prior[:gross_profit],
            percentage: prior[:gross_profit].positive? ?
              ((current[:gross_profit] - prior[:gross_profit]) / prior[:gross_profit] * 100).round(2) : nil
          },
          net_profit: {
            amount: current[:net_profit] - prior[:net_profit],
            percentage: prior[:net_profit].positive? ?
              ((current[:net_profit] - prior[:net_profit]) / prior[:net_profit] * 100).round(2) : nil
          }
        }
      end

      def fy_start_date(financial_year)
        year = financial_year.gsub('FY', '').to_i - 1
        Date.new(year, 7, 1)
      end

      def scoped_accounts
        scope = Gl::Account.where(corporate_company: corporate_company)
        if external_provider
          scope = scope.where(external_provider: external_provider, external_tenant_id: external_tenant_id)
        else
          scope = scope.where(external_provider: nil)
        end
        scope
      end
    end
  end
end
