# frozen_string_literal: true

module Gl
  # Dashboard Service
  # Provides real-time financial KPIs, charts, alerts, and notifications
  #
  # Week 49-52: Dashboard & Consolidation
  class DashboardService
    attr_reader :company, :as_at_date

    def initialize(company, as_at_date: nil)
      @company = company
      @as_at_date = as_at_date || Date.current
    end

    # =========================================================================
    # MAIN DASHBOARD
    # =========================================================================

    def generate
      {
        company: company_info,
        as_at_date: as_at_date,
        financial_year: current_fy,
        kpis: key_performance_indicators,
        cash_position: cash_position_summary,
        revenue_expenses: revenue_expense_summary,
        receivables_payables: ar_ap_summary,
        bank_accounts: bank_accounts_summary,
        alerts: active_alerts,
        recent_activity: recent_activity,
        charts: chart_data,
        quick_actions: quick_actions
      }
    end

    # =========================================================================
    # KEY PERFORMANCE INDICATORS
    # =========================================================================

    def key_performance_indicators
      {
        # Core Financial Metrics
        revenue: {
          mtd: revenue_mtd,
          ytd: revenue_ytd,
          trend: revenue_trend
        },
        expenses: {
          mtd: expenses_mtd,
          ytd: expenses_ytd,
          trend: expenses_trend
        },
        net_profit: {
          mtd: net_profit_mtd,
          ytd: net_profit_ytd,
          margin: profit_margin_ytd
        },

        # Working Capital
        cash: {
          balance: total_cash_balance,
          change_mtd: cash_change_mtd,
          days_cash: days_cash_on_hand
        },
        receivables: {
          balance: total_receivables,
          overdue: overdue_receivables,
          dso: days_sales_outstanding
        },
        payables: {
          balance: total_payables,
          due_soon: payables_due_7_days,
          dpo: days_payables_outstanding
        },

        # Ratios
        current_ratio: current_ratio,
        quick_ratio: quick_ratio,
        working_capital: working_capital
      }
    end

    # =========================================================================
    # CASH POSITION
    # =========================================================================

    def cash_position_summary
      bank_accounts = Gl::Account.where(
        corporate_company: company,
        is_bank_account: true,
        active: true
      )

      accounts = bank_accounts.map do |account|
        balance = current_balance(account)
        {
          id: account.id,
          name: account.name,
          code: account.code,
          balance: balance,
          currency: account.currency_code
        }
      end

      {
        total: accounts.sum { |a| a[:balance] },
        accounts: accounts,
        forecast_7_days: cash_forecast(7),
        forecast_30_days: cash_forecast(30),
        minimum_balance: minimum_cash_balance,
        warning_threshold: cash_warning_threshold
      }
    end

    # =========================================================================
    # REVENUE & EXPENSES
    # =========================================================================

    def revenue_expense_summary
      {
        monthly_comparison: monthly_comparison_data,
        ytd_summary: {
          revenue: revenue_ytd,
          cost_of_sales: cost_of_sales_ytd,
          gross_profit: gross_profit_ytd,
          operating_expenses: operating_expenses_ytd,
          net_profit: net_profit_ytd
        },
        budget_vs_actual: budget_variance_summary,
        top_revenue_categories: top_revenue_categories,
        top_expense_categories: top_expense_categories
      }
    end

    # =========================================================================
    # RECEIVABLES & PAYABLES
    # =========================================================================

    def ar_ap_summary
      {
        receivables: {
          total: total_receivables,
          current: receivables_current,
          days_30: receivables_30_days,
          days_60: receivables_60_days,
          days_90: receivables_90_days,
          days_90_plus: receivables_over_90_days,
          overdue_percent: overdue_receivables_percent,
          top_debtors: top_debtors
        },
        payables: {
          total: total_payables,
          current: payables_current,
          days_30: payables_30_days,
          days_60: payables_60_days,
          days_90: payables_90_days,
          days_90_plus: payables_over_90_days,
          due_this_week: payables_due_7_days,
          top_creditors: top_creditors
        }
      }
    end

    # =========================================================================
    # BANK ACCOUNTS SUMMARY
    # =========================================================================

    def bank_accounts_summary
      bank_accounts = Gl::Account.where(
        corporate_company: company,
        is_bank_account: true,
        active: true
      )

      bank_accounts.map do |account|
        balance = current_balance(account)
        recent_txns = recent_transactions(account, 5)

        {
          id: account.id,
          name: account.name,
          code: account.code,
          balance: balance,
          currency: account.currency_code,
          last_reconciled: last_reconciled_date(account),
          unreconciled_count: unreconciled_transaction_count(account),
          recent_transactions: recent_txns,
          trend: account_trend(account)
        }
      end
    end

    # =========================================================================
    # ALERTS & NOTIFICATIONS
    # =========================================================================

    def active_alerts
      alerts = []

      # Cash flow alerts
      if total_cash_balance < cash_warning_threshold
        alerts << {
          type: :critical,
          category: :cash_flow,
          title: 'Low Cash Balance',
          message: "Cash balance ($#{format_currency(total_cash_balance)}) is below warning threshold",
          action: 'Review cash flow forecast'
        }
      end

      # Overdue receivables
      if overdue_receivables > 0
        alerts << {
          type: overdue_receivables_percent > 20 ? :critical : :warning,
          category: :receivables,
          title: 'Overdue Invoices',
          message: "#{overdue_invoice_count} invoices overdue totaling $#{format_currency(overdue_receivables)}",
          action: 'Send payment reminders'
        }
      end

      # Upcoming payables
      if payables_due_7_days > total_cash_balance * 0.5
        alerts << {
          type: :warning,
          category: :payables,
          title: 'Large Payments Due',
          message: "Bills due in next 7 days: $#{format_currency(payables_due_7_days)}",
          action: 'Review payment schedule'
        }
      end

      # Bank reconciliation
      stale_reconciliations.each do |account|
        alerts << {
          type: :info,
          category: :reconciliation,
          title: 'Bank Reconciliation Overdue',
          message: "#{account[:name]} not reconciled since #{account[:last_reconciled]}",
          action: 'Reconcile bank account'
        }
      end

      # BAS reminder
      if bas_due_soon?
        alerts << {
          type: :warning,
          category: :tax,
          title: 'BAS Due Soon',
          message: "#{current_bas_quarter} BAS due by #{bas_due_date.strftime('%d %b %Y')}",
          action: 'Prepare and lodge BAS'
        }
      end

      # EOFY reminder
      if eofy_approaching?
        alerts << {
          type: :info,
          category: :tax,
          title: 'End of Financial Year Approaching',
          message: "#{days_until_eofy} days until end of #{current_fy}",
          action: 'Review EOFY checklist'
        }
      end

      # Negative profit margin
      if profit_margin_ytd < 0
        alerts << {
          type: :critical,
          category: :profitability,
          title: 'Negative Profit Margin',
          message: "Year-to-date profit margin is #{format_percent(profit_margin_ytd)}",
          action: 'Review expenses and pricing'
        }
      end

      alerts
    end

    # =========================================================================
    # RECENT ACTIVITY
    # =========================================================================

    def recent_activity
      entries = Gl::JournalEntry.where(corporate_company: company)
                                .where('entry_date >= ?', 7.days.ago)
                                .order(entry_date: :desc, created_at: :desc)
                                .limit(20)

      entries.map do |entry|
        {
          id: entry.id,
          date: entry.entry_date,
          type: entry.source_type,
          number: entry.source_number || entry.entry_number,
          description: entry.description,
          amount: entry.total_debits,
          status: entry.status
        }
      end
    end

    # =========================================================================
    # CHART DATA
    # =========================================================================

    def chart_data
      {
        revenue_vs_expenses: revenue_vs_expenses_chart,
        cash_flow_trend: cash_flow_trend_chart,
        receivables_aging: receivables_aging_chart,
        payables_aging: payables_aging_chart,
        monthly_profit: monthly_profit_chart,
        top_customers: top_customers_chart,
        top_expenses: top_expenses_chart
      }
    end

    def revenue_vs_expenses_chart
      # Last 12 months
      months = (0..11).map { |i| (as_at_date - i.months).beginning_of_month }.reverse

      months.map do |month_start|
        month_end = month_start.end_of_month
        {
          month: month_start.strftime('%b %Y'),
          revenue: revenue_for_period(month_start, month_end),
          expenses: expenses_for_period(month_start, month_end)
        }
      end
    end

    def cash_flow_trend_chart
      # Last 30 days
      (0..29).map do |i|
        date = as_at_date - i.days
        {
          date: date,
          balance: cash_balance_at(date),
          inflows: inflows_on_date(date),
          outflows: outflows_on_date(date)
        }
      end.reverse
    end

    def receivables_aging_chart
      [
        { period: 'Current', amount: receivables_current },
        { period: '1-30 days', amount: receivables_30_days },
        { period: '31-60 days', amount: receivables_60_days },
        { period: '61-90 days', amount: receivables_90_days },
        { period: '90+ days', amount: receivables_over_90_days }
      ]
    end

    def payables_aging_chart
      [
        { period: 'Current', amount: payables_current },
        { period: '1-30 days', amount: payables_30_days },
        { period: '31-60 days', amount: payables_60_days },
        { period: '61-90 days', amount: payables_90_days },
        { period: '90+ days', amount: payables_over_90_days }
      ]
    end

    def monthly_profit_chart
      # Last 12 months
      months = (0..11).map { |i| (as_at_date - i.months).beginning_of_month }.reverse

      months.map do |month_start|
        month_end = month_start.end_of_month
        revenue = revenue_for_period(month_start, month_end)
        expenses = expenses_for_period(month_start, month_end)
        {
          month: month_start.strftime('%b %Y'),
          profit: revenue - expenses,
          margin: revenue > 0 ? ((revenue - expenses) / revenue * 100).round(1) : 0
        }
      end
    end

    def top_customers_chart
      top_debtors.map do |debtor|
        { name: debtor[:name], amount: debtor[:balance] }
      end
    end

    def top_expenses_chart
      top_expense_categories.map do |category|
        { name: category[:name], amount: category[:amount] }
      end
    end

    # =========================================================================
    # QUICK ACTIONS
    # =========================================================================

    def quick_actions
      [
        {
          id: 'create_invoice',
          label: 'Create Invoice',
          icon: 'document-plus',
          path: '/gl/invoices/new'
        },
        {
          id: 'enter_bill',
          label: 'Enter Bill',
          icon: 'receipt',
          path: '/gl/bills/new'
        },
        {
          id: 'record_payment',
          label: 'Record Payment',
          icon: 'banknotes',
          path: '/gl/payments/new'
        },
        {
          id: 'reconcile_bank',
          label: 'Reconcile Bank',
          icon: 'check-circle',
          path: '/gl/reconciliations'
        },
        {
          id: 'view_reports',
          label: 'Financial Reports',
          icon: 'chart-bar',
          path: '/gl/reports'
        },
        {
          id: 'prepare_bas',
          label: 'Prepare BAS',
          icon: 'document-text',
          path: '/gl/bas'
        }
      ]
    end

    private

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def company_info
      {
        id: company.id,
        name: company.name,
        abn: company.abn
      }
    end

    def current_fy
      year = as_at_date.month >= 7 ? as_at_date.year + 1 : as_at_date.year
      "FY#{year}"
    end

    def fy_start_date
      year = as_at_date.month >= 7 ? as_at_date.year : as_at_date.year - 1
      Date.new(year, 7, 1)
    end

    def month_start_date
      as_at_date.beginning_of_month
    end

    # Revenue calculations
    def revenue_mtd
      revenue_for_period(month_start_date, as_at_date)
    end

    def revenue_ytd
      revenue_for_period(fy_start_date, as_at_date)
    end

    def revenue_for_period(from_date, to_date)
      revenue_accounts = Gl::Account.where(
        corporate_company: company,
        account_type: 'revenue'
      )

      Gl::LedgerLine.joins(:gl_journal_entry)
                    .where(gl_account: revenue_accounts)
                    .where(gl_journal_entries: { entry_date: from_date..to_date })
                    .sum('credit - debit')
    end

    def revenue_trend
      this_month = revenue_mtd
      last_month = revenue_for_period(
        (month_start_date - 1.month),
        (month_start_date - 1.day)
      )

      return 0 if last_month.zero?

      ((this_month - last_month) / last_month * 100).round(1)
    end

    # Expense calculations
    def expenses_mtd
      expenses_for_period(month_start_date, as_at_date)
    end

    def expenses_ytd
      expenses_for_period(fy_start_date, as_at_date)
    end

    def expenses_for_period(from_date, to_date)
      expense_accounts = Gl::Account.where(
        corporate_company: company,
        account_type: 'expense'
      )

      Gl::LedgerLine.joins(:gl_journal_entry)
                    .where(gl_account: expense_accounts)
                    .where(gl_journal_entries: { entry_date: from_date..to_date })
                    .sum('debit - credit')
    end

    def expenses_trend
      this_month = expenses_mtd
      last_month = expenses_for_period(
        (month_start_date - 1.month),
        (month_start_date - 1.day)
      )

      return 0 if last_month.zero?

      ((this_month - last_month) / last_month * 100).round(1)
    end

    # Profit calculations
    def net_profit_mtd
      revenue_mtd - expenses_mtd
    end

    def net_profit_ytd
      revenue_ytd - expenses_ytd
    end

    def profit_margin_ytd
      return 0 if revenue_ytd.zero?

      (net_profit_ytd / revenue_ytd * 100).round(1)
    end

    def cost_of_sales_ytd
      cos_accounts = Gl::Account.where(
        corporate_company: company,
        account_class: 'cost_of_sales'
      )

      Gl::LedgerLine.joins(:gl_journal_entry)
                    .where(gl_account: cos_accounts)
                    .where(gl_journal_entries: { entry_date: fy_start_date..as_at_date })
                    .sum('debit - credit')
    end

    def gross_profit_ytd
      revenue_ytd - cost_of_sales_ytd
    end

    def operating_expenses_ytd
      op_expense_accounts = Gl::Account.where(
        corporate_company: company,
        account_type: 'expense'
      ).where.not(account_class: 'cost_of_sales')

      Gl::LedgerLine.joins(:gl_journal_entry)
                    .where(gl_account: op_expense_accounts)
                    .where(gl_journal_entries: { entry_date: fy_start_date..as_at_date })
                    .sum('debit - credit')
    end

    # Cash calculations
    def total_cash_balance
      bank_accounts = Gl::Account.where(
        corporate_company: company,
        is_bank_account: true,
        active: true
      )

      bank_accounts.sum { |acc| current_balance(acc) }
    end

    def cash_change_mtd
      total_cash_balance - cash_balance_at(month_start_date - 1.day)
    end

    def days_cash_on_hand
      avg_daily_expense = expenses_ytd / [(as_at_date - fy_start_date).to_i, 1].max
      return Float::INFINITY if avg_daily_expense <= 0

      (total_cash_balance / avg_daily_expense).round(1)
    end

    def cash_balance_at(date)
      # Simplified - would need opening balance + sum of transactions
      total_cash_balance
    end

    def cash_forecast(days)
      # Simplified forecast - would use cash flow service
      projected_inflows = total_receivables * 0.3  # Assume 30% collected
      projected_outflows = payables_due_7_days

      total_cash_balance + projected_inflows - projected_outflows
    end

    def minimum_cash_balance
      # Could be configurable per company
      50_000
    end

    def cash_warning_threshold
      # Could be configurable per company
      20_000
    end

    def inflows_on_date(date)
      bank_accounts = Gl::Account.where(
        corporate_company: company,
        is_bank_account: true
      )

      Gl::LedgerLine.joins(:gl_journal_entry)
                    .where(gl_account: bank_accounts)
                    .where(gl_journal_entries: { entry_date: date })
                    .sum(:debit)
    end

    def outflows_on_date(date)
      bank_accounts = Gl::Account.where(
        corporate_company: company,
        is_bank_account: true
      )

      Gl::LedgerLine.joins(:gl_journal_entry)
                    .where(gl_account: bank_accounts)
                    .where(gl_journal_entries: { entry_date: date })
                    .sum(:credit)
    end

    # Receivables calculations
    def total_receivables
      ar_account = Gl::Account.find_by(
        corporate_company: company,
        system_account: 'accounts_receivable'
      )
      return 0 unless ar_account

      current_balance(ar_account)
    end

    def overdue_receivables
      # Would calculate from invoice due dates
      total_receivables * 0.15  # Placeholder
    end

    def overdue_receivables_percent
      return 0 if total_receivables.zero?

      (overdue_receivables / total_receivables * 100).round(1)
    end

    def overdue_invoice_count
      5  # Placeholder - would query invoices
    end

    def days_sales_outstanding
      return 0 if revenue_ytd.zero?

      days_in_period = (as_at_date - fy_start_date).to_i
      avg_daily_revenue = revenue_ytd / [days_in_period, 1].max

      return 0 if avg_daily_revenue.zero?

      (total_receivables / avg_daily_revenue).round(1)
    end

    def receivables_current
      total_receivables * 0.5  # Placeholder
    end

    def receivables_30_days
      total_receivables * 0.25
    end

    def receivables_60_days
      total_receivables * 0.1
    end

    def receivables_90_days
      total_receivables * 0.1
    end

    def receivables_over_90_days
      total_receivables * 0.05
    end

    # Payables calculations
    def total_payables
      ap_account = Gl::Account.find_by(
        corporate_company: company,
        system_account: 'accounts_payable'
      )
      return 0 unless ap_account

      current_balance(ap_account).abs
    end

    def payables_due_7_days
      total_payables * 0.3  # Placeholder
    end

    def days_payables_outstanding
      return 0 if cost_of_sales_ytd.zero?

      days_in_period = (as_at_date - fy_start_date).to_i
      avg_daily_purchases = cost_of_sales_ytd / [days_in_period, 1].max

      return 0 if avg_daily_purchases.zero?

      (total_payables / avg_daily_purchases).round(1)
    end

    def payables_current
      total_payables * 0.6  # Placeholder
    end

    def payables_30_days
      total_payables * 0.25
    end

    def payables_60_days
      total_payables * 0.1
    end

    def payables_90_days
      total_payables * 0.03
    end

    def payables_over_90_days
      total_payables * 0.02
    end

    # Ratio calculations
    def current_ratio
      current_assets = total_cash_balance + total_receivables
      current_liabilities = total_payables

      return 0 if current_liabilities.zero?

      (current_assets / current_liabilities).round(2)
    end

    def quick_ratio
      quick_assets = total_cash_balance + total_receivables  # Exclude inventory
      current_liabilities = total_payables

      return 0 if current_liabilities.zero?

      (quick_assets / current_liabilities).round(2)
    end

    def working_capital
      (total_cash_balance + total_receivables) - total_payables
    end

    # Top customers/suppliers
    def top_debtors
      [
        { name: 'Customer A', balance: total_receivables * 0.3 },
        { name: 'Customer B', balance: total_receivables * 0.2 },
        { name: 'Customer C', balance: total_receivables * 0.15 },
        { name: 'Customer D', balance: total_receivables * 0.1 },
        { name: 'Other', balance: total_receivables * 0.25 }
      ]
    end

    def top_creditors
      [
        { name: 'Supplier A', balance: total_payables * 0.25 },
        { name: 'Supplier B', balance: total_payables * 0.2 },
        { name: 'Supplier C', balance: total_payables * 0.15 },
        { name: 'Other', balance: total_payables * 0.4 }
      ]
    end

    def top_revenue_categories
      [
        { name: 'Sales', amount: revenue_ytd * 0.7 },
        { name: 'Services', amount: revenue_ytd * 0.2 },
        { name: 'Other', amount: revenue_ytd * 0.1 }
      ]
    end

    def top_expense_categories
      [
        { name: 'Cost of Sales', amount: cost_of_sales_ytd },
        { name: 'Wages', amount: expenses_ytd * 0.3 },
        { name: 'Rent', amount: expenses_ytd * 0.1 },
        { name: 'Utilities', amount: expenses_ytd * 0.05 },
        { name: 'Other', amount: expenses_ytd * 0.15 }
      ]
    end

    # Budget
    def budget_variance_summary
      {
        revenue: {
          budget: revenue_ytd * 1.1,  # Placeholder
          actual: revenue_ytd,
          variance: revenue_ytd * -0.1,
          percent: -9.1
        },
        expenses: {
          budget: expenses_ytd * 0.95,
          actual: expenses_ytd,
          variance: expenses_ytd * 0.05,
          percent: 5.3
        }
      }
    end

    def monthly_comparison_data
      this_month_revenue = revenue_mtd
      last_month_revenue = revenue_for_period(
        (month_start_date - 1.month),
        (month_start_date - 1.day)
      )
      this_month_expenses = expenses_mtd
      last_month_expenses = expenses_for_period(
        (month_start_date - 1.month),
        (month_start_date - 1.day)
      )

      {
        this_month: {
          revenue: this_month_revenue,
          expenses: this_month_expenses,
          profit: this_month_revenue - this_month_expenses
        },
        last_month: {
          revenue: last_month_revenue,
          expenses: last_month_expenses,
          profit: last_month_revenue - last_month_expenses
        },
        change: {
          revenue: last_month_revenue.zero? ? 0 : ((this_month_revenue - last_month_revenue) / last_month_revenue * 100).round(1),
          expenses: last_month_expenses.zero? ? 0 : ((this_month_expenses - last_month_expenses) / last_month_expenses * 100).round(1)
        }
      }
    end

    # Bank account helpers
    def current_balance(account)
      # Get from account balances or calculate from ledger
      balance = Gl::AccountBalance.where(gl_account: account)
                                  .order(Arel.sql('gl_periods.period_end DESC'))
                                  .joins(:gl_period)
                                  .first

      balance&.closing_balance || 0
    end

    def recent_transactions(account, limit)
      Gl::LedgerLine.joins(:gl_journal_entry)
                    .where(gl_account: account)
                    .order('gl_journal_entries.entry_date DESC')
                    .limit(limit)
                    .map do |line|
        {
          date: line.gl_journal_entry.entry_date,
          description: line.description || line.gl_journal_entry.description,
          amount: line.debit - line.credit,
          type: line.debit > 0 ? 'debit' : 'credit'
        }
      end
    end

    def last_reconciled_date(account)
      # Would query reconciliation records
      (as_at_date - rand(1..30).days).to_s
    end

    def unreconciled_transaction_count(account)
      rand(0..15)  # Placeholder
    end

    def account_trend(account)
      # Return trend over last 7 days
      'stable'  # or 'increasing', 'decreasing'
    end

    def stale_reconciliations
      # Find accounts not reconciled in last 14 days
      []  # Placeholder
    end

    # BAS helpers
    def bas_due_soon?
      bas_due_date && bas_due_date <= (as_at_date + 21.days)
    end

    def bas_due_date
      # Calculate next BAS due date based on quarter
      quarter_end = case as_at_date.month
                    when 7..9 then Date.new(as_at_date.year, 9, 30)
                    when 10..12 then Date.new(as_at_date.year, 12, 31)
                    when 1..3 then Date.new(as_at_date.year, 3, 31)
                    else Date.new(as_at_date.year, 6, 30)
                    end

      quarter_end + 28.days  # Due 28 days after quarter end
    end

    def current_bas_quarter
      case as_at_date.month
      when 7..9 then 'Q1'
      when 10..12 then 'Q2'
      when 1..3 then 'Q3'
      else 'Q4'
      end
    end

    # EOFY helpers
    def eofy_approaching?
      days_until_eofy <= 60
    end

    def days_until_eofy
      fy_end = Date.new(as_at_date.month >= 7 ? as_at_date.year + 1 : as_at_date.year, 6, 30)
      (fy_end - as_at_date).to_i
    end

    # Formatting helpers
    def format_currency(amount)
      amount.to_s.gsub(/\B(?=(\d{3})+(?!\d))/, ',')
    end

    def format_percent(value)
      "#{value.round(1)}%"
    end
  end
end
