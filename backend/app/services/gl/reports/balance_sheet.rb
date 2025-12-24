# frozen_string_literal: true

module Gl
  module Reports
    # Balance Sheet Report
    #
    # Generates a Balance Sheet (Statement of Financial Position) as of a date.
    # Shows Assets, Liabilities, and Equity with the accounting equation:
    # Assets = Liabilities + Equity
    #
    # Usage:
    #   report = Gl::Reports::BalanceSheet.new(corporate_company, provider: 'xero', tenant_id: 'abc')
    #   result = report.generate(as_of_date: Date.current)
    #
    class BalanceSheet
      attr_reader :corporate_company, :external_provider, :external_tenant_id

      # Account classes grouped by section
      CURRENT_ASSET_CLASSES = %w[current_asset bank inventory prepayment].freeze
      NON_CURRENT_ASSET_CLASSES = %w[fixed_asset non_current_asset].freeze

      CURRENT_LIABILITY_CLASSES = %w[current_liability].freeze
      NON_CURRENT_LIABILITY_CLASSES = %w[non_current_liability term_liability].freeze

      EQUITY_CLASSES = %w[equity].freeze

      def initialize(corporate_company, provider: nil, tenant_id: nil)
        @corporate_company = corporate_company
        @external_provider = provider
        @external_tenant_id = tenant_id
      end

      # Generate Balance Sheet as of a date
      def generate(as_of_date:, compare_prior_date: nil)
        calculator = Gl::BalanceCalculator.new(
          corporate_company,
          provider: external_provider,
          tenant_id: external_tenant_id
        )

        # Build asset sections
        current_assets = build_section('asset', CURRENT_ASSET_CLASSES, as_of_date, calculator)
        non_current_assets = build_section('asset', NON_CURRENT_ASSET_CLASSES, as_of_date, calculator)

        # Build liability sections
        current_liabilities = build_section('liability', CURRENT_LIABILITY_CLASSES, as_of_date, calculator)
        non_current_liabilities = build_section('liability', NON_CURRENT_LIABILITY_CLASSES, as_of_date, calculator)

        # Build equity section
        equity_section = build_section('equity', EQUITY_CLASSES, as_of_date, calculator)

        # Calculate current year earnings (P&L for current FY)
        current_year_earnings = calculate_current_year_earnings(as_of_date)

        # Totals
        total_assets = current_assets[:total] + non_current_assets[:total]
        total_liabilities = current_liabilities[:total] + non_current_liabilities[:total]
        total_equity = equity_section[:total] + current_year_earnings

        result = {
          report_type: 'balance_sheet',
          as_of_date: as_of_date,
          generated_at: Time.current,
          provider: external_provider,
          tenant_id: external_tenant_id,

          # Assets
          assets: {
            current: current_assets,
            non_current: non_current_assets,
            total: total_assets
          },

          # Liabilities
          liabilities: {
            current: current_liabilities,
            non_current: non_current_liabilities,
            total: total_liabilities
          },

          # Equity
          equity: {
            retained_earnings: equity_section,
            current_year_earnings: current_year_earnings,
            total: total_equity
          },

          # Summary & Validation
          summary: {
            total_assets: total_assets,
            total_liabilities: total_liabilities,
            total_equity: total_equity,
            liabilities_plus_equity: total_liabilities + total_equity,
            balanced: (total_assets - (total_liabilities + total_equity)).abs < 0.01
          },

          # Working capital & ratios
          ratios: calculate_ratios(current_assets[:total], current_liabilities[:total], total_assets, total_liabilities)
        }

        # Add prior date comparison if requested
        if compare_prior_date
          prior_result = generate(as_of_date: compare_prior_date)
          result[:prior_period] = prior_result
          result[:movement] = calculate_movement(result[:summary], prior_result[:summary])
        end

        result
      end

      # Generate at end of each period in a financial year
      def generate_periodic(financial_year)
        periods = Gl::Period
          .where(corporate_company: corporate_company)
          .where(financial_year: financial_year)
          .order(:period_end)

        snapshots = periods.map do |period|
          bs = generate(as_of_date: period.period_end)
          {
            period: period.period_name,
            as_of_date: period.period_end,
            total_assets: bs[:summary][:total_assets],
            total_liabilities: bs[:summary][:total_liabilities],
            total_equity: bs[:summary][:total_equity],
            working_capital: bs[:ratios][:working_capital],
            current_ratio: bs[:ratios][:current_ratio]
          }
        end

        {
          financial_year: financial_year,
          snapshots: snapshots,
          latest: generate(as_of_date: periods.last&.period_end || Date.current)
        }
      end

      private

      def build_section(account_type, account_classes, as_of_date, calculator)
        accounts = scoped_accounts
          .active
          .where(account_type: account_type)
          .where(account_class: account_classes)
          .order(:code)

        lines = accounts.map do |account|
          balance = calculator.balance_at(account, as_of_date)
          next if balance.zero?

          {
            account_id: account.id,
            code: account.code,
            name: account.name,
            account_class: account.account_class,
            is_bank_account: account.is_bank_account,
            balance: balance
          }
        end.compact

        {
          accounts: lines,
          total: lines.sum { |l| l[:balance] }
        }
      end

      def calculate_current_year_earnings(as_of_date)
        # Get P&L from start of FY to as_of_date
        fy = Gl::Period.financial_year_for(as_of_date)
        fy_start = fy_start_date(fy)

        pl_report = Gl::Reports::ProfitLoss.new(
          corporate_company,
          provider: external_provider,
          tenant_id: external_tenant_id
        )

        result = pl_report.generate(from_date: fy_start, to_date: as_of_date)
        result[:summary][:net_profit]
      end

      def calculate_ratios(current_assets, current_liabilities, total_assets, total_liabilities)
        {
          working_capital: current_assets - current_liabilities,
          current_ratio: current_liabilities.positive? ? (current_assets / current_liabilities).round(2) : nil,
          quick_ratio: current_liabilities.positive? ? ((current_assets * 0.8) / current_liabilities).round(2) : nil, # Simplified
          debt_ratio: total_assets.positive? ? (total_liabilities / total_assets * 100).round(2) : nil,
          equity_ratio: total_assets.positive? ? ((total_assets - total_liabilities) / total_assets * 100).round(2) : nil
        }
      end

      def calculate_movement(current, prior)
        {
          assets: {
            amount: current[:total_assets] - prior[:total_assets],
            percentage: prior[:total_assets].positive? ?
              ((current[:total_assets] - prior[:total_assets]) / prior[:total_assets] * 100).round(2) : nil
          },
          liabilities: {
            amount: current[:total_liabilities] - prior[:total_liabilities],
            percentage: prior[:total_liabilities].positive? ?
              ((current[:total_liabilities] - prior[:total_liabilities]) / prior[:total_liabilities] * 100).round(2) : nil
          },
          equity: {
            amount: current[:total_equity] - prior[:total_equity],
            percentage: prior[:total_equity].positive? ?
              ((current[:total_equity] - prior[:total_equity]) / prior[:total_equity] * 100).round(2) : nil
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
