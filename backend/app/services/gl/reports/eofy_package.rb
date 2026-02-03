# frozen_string_literal: true

module Gl
  module Reports
    # EOFY Report Package
    #
    # Generates a complete package of year-end financial reports including:
    # - Profit & Loss Statement (annual)
    # - Balance Sheet (as at June 30)
    # - Trial Balance
    # - GST Summary for the year
    # - Depreciation Schedule
    # - PAYG Summary
    # - Comparative analysis (vs prior year)
    #
    class EofyPackage
      attr_reader :corporate, :financial_year, :options

      def initialize(corporate, financial_year = nil, options = {})
        @corporate = corporate
        @financial_year = financial_year || current_fy
        @options = options.with_indifferent_access
      end

      # Generate complete EOFY package
      def generate
        {
          financial_year: financial_year,
          period: fy_period,
          generated_at: Time.current,
          reports: {
            profit_loss: profit_loss_report,
            balance_sheet: balance_sheet_report,
            trial_balance: trial_balance_report,
            gst_summary: gst_summary_report,
            depreciation_schedule: depreciation_schedule,
            payg_summary: payg_summary_report
          },
          comparatives: comparative_analysis,
          key_metrics: key_metrics,
          accountant_notes: accountant_notes
        }
      end

      # Generate individual reports
      def profit_loss
        profit_loss_report
      end

      def balance_sheet
        balance_sheet_report
      end

      def trial_balance
        trial_balance_report
      end

      def gst_summary
        gst_summary_report
      end

      def depreciation
        depreciation_schedule
      end

      def payg
        payg_summary_report
      end

      # Export package as PDF-ready data
      def export_data
        package = generate

        {
          cover_page: cover_page_data,
          contents: [
            { title: 'Profit & Loss Statement', data: package[:reports][:profit_loss] },
            { title: 'Balance Sheet', data: package[:reports][:balance_sheet] },
            { title: 'Trial Balance', data: package[:reports][:trial_balance] },
            { title: 'GST Summary', data: package[:reports][:gst_summary] },
            { title: 'Depreciation Schedule', data: package[:reports][:depreciation_schedule] },
            { title: 'PAYG Summary', data: package[:reports][:payg_summary] }
          ],
          appendix: {
            comparatives: package[:comparatives],
            metrics: package[:key_metrics]
          }
        }
      end

      private

      # =========================================================================
      # PROFIT & LOSS STATEMENT
      # =========================================================================

      def profit_loss_report
        revenue = revenue_section
        cost_of_sales = cost_of_sales_section
        gross_profit = revenue[:total] - cost_of_sales[:total]
        operating_expenses = operating_expenses_section
        other_income = other_income_section
        other_expenses = other_expenses_section

        net_profit = gross_profit - operating_expenses[:total] + other_income[:total] - other_expenses[:total]

        {
          title: "Profit & Loss Statement for #{financial_year}",
          period: "#{fy_start_date.strftime('%d %B %Y')} to #{fy_end_date.strftime('%d %B %Y')}",
          sections: {
            revenue: revenue,
            cost_of_sales: cost_of_sales,
            gross_profit: {
              label: 'Gross Profit',
              amount: gross_profit.to_d.round(2),
              margin: revenue[:total].positive? ? ((gross_profit / revenue[:total]) * 100).round(1) : 0
            },
            operating_expenses: operating_expenses,
            operating_profit: {
              label: 'Operating Profit',
              amount: (gross_profit - operating_expenses[:total]).to_d.round(2)
            },
            other_income: other_income,
            other_expenses: other_expenses,
            net_profit: {
              label: 'Net Profit Before Tax',
              amount: net_profit.to_d.round(2),
              margin: revenue[:total].positive? ? ((net_profit / revenue[:total]) * 100).round(1) : 0
            }
          },
          summary: {
            total_revenue: revenue[:total].to_d.round(2),
            total_expenses: (cost_of_sales[:total] + operating_expenses[:total] + other_expenses[:total]).to_d.round(2),
            net_profit: net_profit.to_d.round(2)
          }
        }
      end

      def revenue_section
        accounts = Gl::Account.where(
          corporate: corporate,
          account_type: 'revenue',
          account_class: %w[sales_revenue service_revenue other_revenue]
        )

        build_section('Revenue', accounts)
      end

      def cost_of_sales_section
        accounts = Gl::Account.where(
          corporate: corporate,
          account_type: 'expense',
          account_class: %w[cost_of_sales direct_costs]
        )

        build_section('Cost of Sales', accounts)
      end

      def operating_expenses_section
        accounts = Gl::Account.where(
          corporate: corporate,
          account_type: 'expense'
        ).where.not(account_class: %w[cost_of_sales direct_costs other_expense])

        build_section('Operating Expenses', accounts)
      end

      def other_income_section
        accounts = Gl::Account.where(
          corporate: corporate,
          account_type: 'revenue',
          account_class: 'other_income'
        )

        build_section('Other Income', accounts)
      end

      def other_expenses_section
        accounts = Gl::Account.where(
          corporate: corporate,
          account_type: 'expense',
          account_class: 'other_expense'
        )

        build_section('Other Expenses', accounts)
      end

      # =========================================================================
      # BALANCE SHEET
      # =========================================================================

      def balance_sheet_report
        assets = assets_section
        liabilities = liabilities_section
        equity = equity_section

        net_assets = assets[:total] - liabilities[:total]

        {
          title: "Balance Sheet as at #{fy_end_date.strftime('%d %B %Y')}",
          as_at: fy_end_date,
          sections: {
            assets: assets,
            liabilities: liabilities,
            net_assets: {
              label: 'Net Assets',
              amount: net_assets.to_d.round(2)
            },
            equity: equity
          },
          validation: {
            assets_equal_liabilities_plus_equity: (assets[:total] - liabilities[:total] - equity[:total]).abs < 0.01,
            difference: (assets[:total] - liabilities[:total] - equity[:total]).to_d.round(2)
          }
        }
      end

      def assets_section
        current_assets = Gl::Account.where(
          corporate: corporate,
          account_type: 'asset',
          account_class: %w[bank cash accounts_receivable inventory prepaid current_asset]
        )

        non_current_assets = Gl::Account.where(
          corporate: corporate,
          account_type: 'asset',
          account_class: %w[fixed_asset equipment property intangible investment]
        )

        current = build_balance_section('Current Assets', current_assets)
        non_current = build_balance_section('Non-Current Assets', non_current_assets)

        {
          label: 'Assets',
          current_assets: current,
          non_current_assets: non_current,
          total: (current[:total] + non_current[:total]).to_d.round(2)
        }
      end

      def liabilities_section
        current_liabilities = Gl::Account.where(
          corporate: corporate,
          account_type: 'liability',
          account_class: %w[accounts_payable tax_payable accrued current_liability gst_collected gst_paid]
        )

        non_current_liabilities = Gl::Account.where(
          corporate: corporate,
          account_type: 'liability',
          account_class: %w[long_term_debt loan non_current_liability]
        )

        current = build_balance_section('Current Liabilities', current_liabilities)
        non_current = build_balance_section('Non-Current Liabilities', non_current_liabilities)

        {
          label: 'Liabilities',
          current_liabilities: current,
          non_current_liabilities: non_current,
          total: (current[:total] + non_current[:total]).to_d.round(2)
        }
      end

      def equity_section
        accounts = Gl::Account.where(
          corporate: corporate,
          account_type: 'equity'
        )

        section = build_balance_section('Equity', accounts)

        # Add current year earnings
        current_earnings = calculate_current_year_earnings

        section[:accounts] << {
          code: 'CYE',
          name: 'Current Year Earnings',
          balance: current_earnings.to_d.round(2)
        }

        section[:total] = (section[:total] + current_earnings).to_d.round(2)
        section
      end

      # =========================================================================
      # TRIAL BALANCE
      # =========================================================================

      def trial_balance_report
        accounts = Gl::Account.where(corporate: corporate)
          .where(active: true)
          .order(:code)

        rows = accounts.map do |account|
          balance = account_closing_balance(account)
          next if balance.zero? && !options[:include_zero_balances]

          {
            code: account.code,
            name: account.name,
            type: account.account_type,
            debit: balance > 0 ? balance.to_d.round(2) : nil,
            credit: balance < 0 ? balance.abs.to_d.round(2) : nil
          }
        end.compact

        total_debits = rows.sum { |r| r[:debit] || 0 }
        total_credits = rows.sum { |r| r[:credit] || 0 }

        {
          title: "Trial Balance as at #{fy_end_date.strftime('%d %B %Y')}",
          as_at: fy_end_date,
          accounts: rows,
          totals: {
            debit: total_debits.to_d.round(2),
            credit: total_credits.to_d.round(2),
            balanced: (total_debits - total_credits).abs < 0.01,
            difference: (total_debits - total_credits).to_d.round(2)
          }
        }
      end

      # =========================================================================
      # GST SUMMARY
      # =========================================================================

      def gst_summary_report
        quarters = %w[Q1 Q2 Q3 Q4].map do |quarter|
          quarter_dates = quarter_date_range(quarter)
          bas = Gl::BasPreparationService.new(
            corporate,
            period_start: quarter_dates[:start],
            period_end: quarter_dates[:end]
          )
          preview = bas.preview

          {
            quarter: quarter,
            period: "#{quarter_dates[:start].strftime('%b %Y')} - #{quarter_dates[:end].strftime('%b %Y')}",
            gst_collected: preview[:amounts][:gst_on_sales],
            gst_paid: preview[:amounts][:gst_on_purchases],
            net_gst: preview[:amounts][:net_gst],
            invoices: preview[:invoice_count],
            bills: preview[:bill_count]
          }
        end

        {
          title: "GST Summary for #{financial_year}",
          quarters: quarters,
          annual_totals: {
            gst_collected: quarters.sum { |q| q[:gst_collected] }.to_d.round(2),
            gst_paid: quarters.sum { |q| q[:gst_paid] }.to_d.round(2),
            net_gst: quarters.sum { |q| q[:net_gst] }.to_d.round(2),
            total_invoices: quarters.sum { |q| q[:invoices] },
            total_bills: quarters.sum { |q| q[:bills] }
          },
          reconciliation: gst_reconciliation
        }
      end

      def gst_reconciliation
        gst_collected_account = Gl::Account.find_by(
          corporate: corporate,
          system_account: 'gst_collected'
        )
        gst_paid_account = Gl::Account.find_by(
          corporate: corporate,
          system_account: 'gst_paid'
        )

        collected_balance = gst_collected_account ? account_closing_balance(gst_collected_account) : 0
        paid_balance = gst_paid_account ? account_closing_balance(gst_paid_account) : 0

        {
          gst_collected_balance: collected_balance.abs.to_d.round(2),
          gst_paid_balance: paid_balance.abs.to_d.round(2),
          net_gst_liability: (collected_balance.abs - paid_balance.abs).to_d.round(2),
          note: 'Balance should be zero if all BAS have been lodged and paid'
        }
      end

      # =========================================================================
      # DEPRECIATION SCHEDULE
      # =========================================================================

      def depreciation_schedule
        # Get fixed asset accounts
        asset_accounts = Gl::Account.where(
          corporate: corporate,
          account_type: 'asset',
          account_class: %w[fixed_asset equipment property]
        )

        accumulated_accounts = Gl::Account.where(
          corporate: corporate,
          account_type: 'asset',
          account_class: 'accumulated_depreciation'
        )

        expense_accounts = Gl::Account.where(
          corporate: corporate,
          account_type: 'expense',
          account_class: 'depreciation'
        )

        assets = asset_accounts.map do |account|
          # Find matching accumulated depreciation
          accum = accumulated_accounts.find { |a| a.name.include?(account.name) }

          cost = account_closing_balance(account)
          accumulated = accum ? account_closing_balance(accum).abs : 0
          fy_depreciation = calculate_fy_depreciation(account)

          {
            asset_account: account.name,
            code: account.code,
            cost: cost.to_d.round(2),
            opening_accumulated: (accumulated - fy_depreciation).to_d.round(2),
            fy_depreciation: fy_depreciation.to_d.round(2),
            closing_accumulated: accumulated.to_d.round(2),
            written_down_value: (cost - accumulated).to_d.round(2)
          }
        end

        total_depreciation = expense_accounts.sum { |a| account_fy_balance(a).abs }

        {
          title: "Depreciation Schedule for #{financial_year}",
          assets: assets,
          totals: {
            total_cost: assets.sum { |a| a[:cost] }.to_d.round(2),
            total_fy_depreciation: total_depreciation.to_d.round(2),
            total_accumulated: assets.sum { |a| a[:closing_accumulated] }.to_d.round(2),
            total_wdv: assets.sum { |a| a[:written_down_value] }.to_d.round(2)
          },
          note: 'Depreciation calculated using straight-line method unless otherwise specified'
        }
      end

      # =========================================================================
      # PAYG SUMMARY
      # =========================================================================

      def payg_summary_report
        wages_accounts = Gl::Account.where(
          corporate: corporate,
          account_class: 'wages'
        )

        super_accounts = Gl::Account.where(
          corporate: corporate,
          account_class: 'superannuation'
        )

        total_wages = wages_accounts.sum { |a| account_fy_balance(a).abs }
        total_super = super_accounts.sum { |a| account_fy_balance(a).abs }

        # Estimate PAYG withheld (would come from payroll)
        estimated_payg = total_wages * 0.30 # Rough estimate

        {
          title: "PAYG Summary for #{financial_year}",
          wages: {
            total_wages: total_wages.to_d.round(2),
            total_superannuation: total_super.to_d.round(2),
            total_payg_withheld: estimated_payg.to_d.round(2)
          },
          quarters: %w[Q1 Q2 Q3 Q4].map do |quarter|
            quarter_dates = quarter_date_range(quarter)
            quarter_wages = wages_accounts.sum { |a| account_period_balance(a, quarter_dates[:start], quarter_dates[:end]).abs }

            {
              quarter: quarter,
              wages: quarter_wages.to_d.round(2),
              estimated_payg: (quarter_wages * 0.30).to_d.round(2)
            }
          end,
          note: 'PAYG withholding estimated at 30%. Actual figures should be obtained from payroll system.'
        }
      end

      # =========================================================================
      # COMPARATIVE ANALYSIS
      # =========================================================================

      def comparative_analysis
        prior_fy = "FY#{financial_year.delete('FY').to_i - 1}"

        current_pl = profit_loss_report
        prior_package = self.class.new(corporate, prior_fy, options)
        prior_pl = prior_package.profit_loss

        {
          current_year: financial_year,
          prior_year: prior_fy,
          profit_loss_comparison: {
            revenue: {
              current: current_pl[:sections][:revenue][:total],
              prior: prior_pl[:sections][:revenue][:total],
              change: current_pl[:sections][:revenue][:total] - prior_pl[:sections][:revenue][:total],
              change_pct: calculate_change_pct(prior_pl[:sections][:revenue][:total], current_pl[:sections][:revenue][:total])
            },
            gross_profit: {
              current: current_pl[:sections][:gross_profit][:amount],
              prior: prior_pl[:sections][:gross_profit][:amount],
              change: current_pl[:sections][:gross_profit][:amount] - prior_pl[:sections][:gross_profit][:amount],
              change_pct: calculate_change_pct(prior_pl[:sections][:gross_profit][:amount], current_pl[:sections][:gross_profit][:amount])
            },
            net_profit: {
              current: current_pl[:sections][:net_profit][:amount],
              prior: prior_pl[:sections][:net_profit][:amount],
              change: current_pl[:sections][:net_profit][:amount] - prior_pl[:sections][:net_profit][:amount],
              change_pct: calculate_change_pct(prior_pl[:sections][:net_profit][:amount], current_pl[:sections][:net_profit][:amount])
            }
          }
        }
      rescue StandardError
        { note: 'Prior year data not available for comparison' }
      end

      # =========================================================================
      # KEY METRICS
      # =========================================================================

      def key_metrics
        pl = profit_loss_report
        bs = balance_sheet_report

        revenue = pl[:sections][:revenue][:total]
        net_profit = pl[:sections][:net_profit][:amount]
        total_assets = bs[:sections][:assets][:total]
        total_liabilities = bs[:sections][:liabilities][:total]
        equity = bs[:sections][:equity][:total]
        current_assets = bs[:sections][:assets][:current_assets][:total]
        current_liabilities = bs[:sections][:liabilities][:current_liabilities][:total]

        {
          profitability: {
            gross_margin: pl[:sections][:gross_profit][:margin],
            net_margin: pl[:sections][:net_profit][:margin],
            return_on_assets: total_assets.positive? ? ((net_profit / total_assets) * 100).round(1) : 0,
            return_on_equity: equity.positive? ? ((net_profit / equity) * 100).round(1) : 0
          },
          liquidity: {
            current_ratio: current_liabilities.positive? ? (current_assets / current_liabilities).round(2) : 0,
            quick_ratio: calculate_quick_ratio(current_assets, current_liabilities)
          },
          solvency: {
            debt_ratio: total_assets.positive? ? ((total_liabilities / total_assets) * 100).round(1) : 0,
            debt_to_equity: equity.positive? ? (total_liabilities / equity).round(2) : 0
          }
        }
      end

      # =========================================================================
      # HELPERS
      # =========================================================================

      def fy_period
        {
          financial_year: financial_year,
          start_date: fy_start_date,
          end_date: fy_end_date
        }
      end

      def fy_start_date
        year = financial_year.delete('FY').to_i - 1
        Date.new(year, 7, 1)
      end

      def fy_end_date
        year = financial_year.delete('FY').to_i
        Date.new(year, 6, 30)
      end

      def current_fy
        today = Date.current
        year = today.month >= 7 ? today.year + 1 : today.year
        "FY#{year}"
      end

      def quarter_date_range(quarter)
        year = financial_year.delete('FY').to_i
        base_year = year - 1

        case quarter
        when 'Q1'
          { start: Date.new(base_year, 7, 1), end: Date.new(base_year, 9, 30) }
        when 'Q2'
          { start: Date.new(base_year, 10, 1), end: Date.new(base_year, 12, 31) }
        when 'Q3'
          { start: Date.new(year, 1, 1), end: Date.new(year, 3, 31) }
        when 'Q4'
          { start: Date.new(year, 4, 1), end: Date.new(year, 6, 30) }
        end
      end

      def build_section(label, accounts)
        items = accounts.map do |account|
          balance = account_fy_balance(account).abs
          next if balance.zero? && !options[:include_zero_balances]

          {
            code: account.code,
            name: account.name,
            amount: balance.to_d.round(2)
          }
        end.compact

        {
          label: label,
          accounts: items.sort_by { |i| i[:code] },
          total: items.sum { |i| i[:amount] }.to_d.round(2)
        }
      end

      def build_balance_section(label, accounts)
        items = accounts.map do |account|
          balance = account_closing_balance(account)
          next if balance.zero? && !options[:include_zero_balances]

          {
            code: account.code,
            name: account.name,
            balance: balance.to_d.round(2)
          }
        end.compact

        {
          label: label,
          accounts: items.sort_by { |i| i[:code] },
          total: items.sum { |i| i[:balance] }.to_d.round(2)
        }
      end

      def account_fy_balance(account)
        Gl::LedgerLine
          .joins(:gl_journal_entry)
          .where(gl_account: account)
          .where(gl_journal_entries: { corporate: corporate })
          .where('gl_journal_entries.entry_date >= ? AND gl_journal_entries.entry_date <= ?', fy_start_date, fy_end_date)
          .sum('debit - credit')
      end

      def account_period_balance(account, start_date, end_date)
        Gl::LedgerLine
          .joins(:gl_journal_entry)
          .where(gl_account: account)
          .where(gl_journal_entries: { corporate: corporate })
          .where('gl_journal_entries.entry_date >= ? AND gl_journal_entries.entry_date <= ?', start_date, end_date)
          .sum('debit - credit')
      end

      def account_closing_balance(account)
        opening = Gl::OpeningBalance.find_by(
          gl_account: account,
          financial_year: financial_year
        )&.balance || 0

        activity = account_fy_balance(account)

        if account.account_type.in?(%w[liability equity revenue])
          opening - activity
        else
          opening + activity
        end
      end

      def calculate_current_year_earnings
        revenue_total = Gl::Account.where(corporate: corporate, account_type: 'revenue')
          .sum { |a| account_fy_balance(a).abs }

        expense_total = Gl::Account.where(corporate: corporate, account_type: 'expense')
          .sum { |a| account_fy_balance(a).abs }

        revenue_total - expense_total
      end

      def calculate_fy_depreciation(asset_account)
        # Find depreciation entries for this asset in the FY
        Gl::LedgerLine
          .joins(:gl_journal_entry)
          .where(gl_journal_entries: { corporate: corporate, source_type: 'depreciation' })
          .where('gl_journal_entries.entry_date >= ? AND gl_journal_entries.entry_date <= ?', fy_start_date, fy_end_date)
          .where('description LIKE ?', "%#{asset_account.name}%")
          .sum(:credit)
      end

      def calculate_change_pct(prior, current)
        return 0 if prior.zero?

        ((current - prior) / prior.abs * 100).round(1)
      end

      def calculate_quick_ratio(current_assets, current_liabilities)
        return 0 if current_liabilities.zero?

        # Quick ratio excludes inventory
        inventory = Gl::Account.where(
          corporate: corporate,
          account_class: 'inventory'
        ).sum { |a| account_closing_balance(a) }

        ((current_assets - inventory) / current_liabilities).round(2)
      end

      def cover_page_data
        {
          company_name: corporate.name,
          financial_year: financial_year,
          period: "1 July #{fy_start_date.year} to 30 June #{fy_end_date.year}",
          generated_at: Time.current.strftime('%d %B %Y at %H:%M'),
          prepared_by: 'TEEEM Accounting System'
        }
      end

      def accountant_notes
        [
          'These reports are prepared on an accrual basis unless otherwise noted.',
          'All amounts are in Australian Dollars (AUD).',
          'Depreciation has been calculated using the straight-line method.',
          'GST figures should be reconciled with lodged BAS returns.',
          'PAYG withholding figures are estimates - verify with payroll records.'
        ]
      end
    end
  end
end
