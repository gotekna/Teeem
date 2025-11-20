require 'csv'

class FinancialExportService
  class ExportError < StandardError; end

  def initialize(company: nil)
    @company = company
  end

  # Export transactions to CSV
  def export_transactions_csv(filters: {})
    transactions = build_transaction_scope(filters)

    CSV.generate(headers: true) do |csv|
      # Headers
      csv << [
        'Date',
        'Type',
        'Category',
        'Description',
        'Job',
        'Amount',
        'Status',
        'Synced To',
        'Created By',
        'Created At'
      ]

      # Data rows
      transactions.includes(:user, :construction).find_each do |transaction|
        csv << [
          transaction.transaction_date.strftime('%Y-%m-%d'),
          transaction.transaction_type.capitalize,
          transaction.category,
          transaction.description,
          transaction.construction&.name || 'N/A',
          format_currency(transaction.amount),
          transaction.status.capitalize,
          transaction.external_system_type || 'Not Synced',
          transaction.user.email,
          transaction.created_at.strftime('%Y-%m-%d %H:%M')
        ]
      end
    end
  end

  # Export balance sheet to CSV
  def export_balance_sheet_csv(as_of_date: Date.current)
    reporting_service = FinancialReportingService.new(company: @company)
    report = reporting_service.generate_balance_sheet(as_of_date: as_of_date)

    CSV.generate(headers: true) do |csv|
      csv << ['BALANCE SHEET']
      csv << ["As of: #{report[:as_of_date].strftime('%B %d, %Y')}"]
      csv << []

      # Assets
      csv << ['ASSETS']
      csv << ['Current Assets']
      report[:assets][:current_assets][:details].each do |name, amount|
        csv << ['', name, format_currency(amount)]
      end
      csv << ['', 'Total Current Assets', format_currency(report[:assets][:current_assets][:total])]
      csv << []

      csv << ['Fixed Assets']
      report[:assets][:fixed_assets][:details].each do |name, amount|
        csv << ['', name, format_currency(amount)]
      end
      csv << ['', 'Total Fixed Assets', format_currency(report[:assets][:fixed_assets][:total])]
      csv << []

      csv << ['TOTAL ASSETS', '', format_currency(report[:assets][:total])]
      csv << []

      # Liabilities
      csv << ['LIABILITIES']
      csv << ['Current Liabilities']
      report[:liabilities][:current_liabilities][:details].each do |name, amount|
        csv << ['', name, format_currency(amount)]
      end
      csv << ['', 'Total Current Liabilities', format_currency(report[:liabilities][:current_liabilities][:total])]
      csv << []

      csv << ['TOTAL LIABILITIES', '', format_currency(report[:liabilities][:total])]
      csv << []

      # Equity
      csv << ['EQUITY']
      report[:equity][:equity_accounts][:details].each do |name, amount|
        csv << ['', name, format_currency(amount)]
      end
      csv << ['TOTAL EQUITY', '', format_currency(report[:equity][:total])]
      csv << []

      csv << ['TOTAL LIABILITIES & EQUITY', '', format_currency(report[:liabilities][:total] + report[:equity][:total])]
    end
  end

  # Export profit & loss to CSV
  def export_profit_loss_csv(from_date:, to_date: Date.current)
    reporting_service = FinancialReportingService.new(company: @company)
    report = reporting_service.generate_profit_loss(from_date: from_date, to_date: to_date)

    CSV.generate(headers: true) do |csv|
      csv << ['PROFIT & LOSS STATEMENT']
      csv << ["Period: #{report[:from_date].strftime('%B %d, %Y')} to #{report[:to_date].strftime('%B %d, %Y')}"]
      csv << []

      # Revenue
      csv << ['REVENUE']
      report[:revenue][:details].each do |name, amount|
        csv << ['', name, format_currency(amount)]
      end
      csv << ['TOTAL REVENUE', '', format_currency(report[:revenue][:total])]
      csv << []

      # Expenses
      csv << ['EXPENSES']
      report[:expenses][:details].each do |name, amount|
        csv << ['', name, format_currency(amount)]
      end
      csv << ['TOTAL EXPENSES', '', format_currency(report[:expenses][:total])]
      csv << []

      # Net Profit
      csv << ['NET PROFIT', '', format_currency(report[:net_profit])]
      csv << ['PROFIT MARGIN', '', "#{report[:profit_margin]}%"]
    end
  end

  # Export job profitability to CSV
  def export_job_profitability_csv(construction_ids: nil, from_date: nil, to_date: Date.current)
    reporting_service = FinancialReportingService.new(company: @company)
    report = reporting_service.generate_job_profitability(
      construction_ids: construction_ids,
      from_date: from_date,
      to_date: to_date
    )

    CSV.generate(headers: true) do |csv|
      csv << ['JOB PROFITABILITY REPORT']
      period_text = from_date ? "Period: #{from_date.strftime('%B %d, %Y')} to #{report[:to_date].strftime('%B %d, %Y')}" : "Up to: #{report[:to_date].strftime('%B %d, %Y')}"
      csv << [period_text]
      csv << []

      # Headers
      csv << ['Job Name', 'Revenue', 'Expenses', 'Net Profit', 'Margin %']

      # Data rows
      report[:jobs].each do |job|
        csv << [
          job[:construction_name],
          format_currency(job[:income]),
          format_currency(job[:expenses]),
          format_currency(job[:net_profit]),
          "#{job[:profit_margin]}%"
        ]
      end

      csv << []

      # Totals
      csv << [
        'TOTALS',
        format_currency(report[:totals][:income]),
        format_currency(report[:totals][:expenses]),
        format_currency(report[:totals][:net_profit]),
        "#{report[:totals][:profit_margin]}%"
      ]
    end
  end

  # Export chart of accounts to CSV
  def export_chart_of_accounts_csv
    accounts = Keepr::Account.order(:number)

    CSV.generate(headers: true) do |csv|
      csv << ['Account Number', 'Account Name', 'Type', 'Current Balance']

      accounts.each do |account|
        balance = account.balance.to_f
        csv << [
          account.number,
          account.name,
          account.kind.capitalize,
          format_currency(balance)
        ]
      end
    end
  end

  # Export account balances for accountant review
  def export_accountant_package_csv(from_date:, to_date: Date.current)
    reporting_service = FinancialReportingService.new(company: @company)

    # Create a comprehensive export for accountants
    CSV.generate(headers: true) do |csv|
      csv << ['TRAPID FINANCIAL PACKAGE FOR ACCOUNTANT']
      csv << ["Period: #{from_date.strftime('%B %d, %Y')} to #{to_date.strftime('%B %d, %Y')}"]
      csv << ["Generated: #{Time.current.strftime('%B %d, %Y at %I:%M %p')}"]
      csv << []
      csv << []

      # Section 1: All Transactions
      csv << ['SECTION 1: ALL TRANSACTIONS']
      csv << ['Date', 'Type', 'Category', 'Description', 'Job', 'Amount', 'Status']

      transactions = build_transaction_scope(from_date: from_date, to_date: to_date)
      transactions.includes(:user, :construction).find_each do |t|
        csv << [
          t.transaction_date.strftime('%Y-%m-%d'),
          t.transaction_type.capitalize,
          t.category,
          t.description,
          t.construction&.name || '',
          format_currency(t.amount),
          t.status.capitalize
        ]
      end

      csv << []
      csv << []

      # Section 2: Profit & Loss
      csv << ['SECTION 2: PROFIT & LOSS SUMMARY']
      pl_report = reporting_service.generate_profit_loss(from_date: from_date, to_date: to_date)

      csv << ['REVENUE']
      pl_report[:revenue][:details].each do |name, amount|
        csv << ['', name, format_currency(amount)]
      end
      csv << ['', 'Total Revenue', format_currency(pl_report[:revenue][:total])]
      csv << []

      csv << ['EXPENSES']
      pl_report[:expenses][:details].each do |name, amount|
        csv << ['', name, format_currency(amount)]
      end
      csv << ['', 'Total Expenses', format_currency(pl_report[:expenses][:total])]
      csv << []

      csv << ['NET PROFIT', '', format_currency(pl_report[:net_profit])]

      csv << []
      csv << []

      # Section 3: Balance Sheet
      csv << ['SECTION 3: BALANCE SHEET']
      bs_report = reporting_service.generate_balance_sheet(as_of_date: to_date)

      csv << ['ASSETS', '', format_currency(bs_report[:assets][:total])]
      csv << ['LIABILITIES', '', format_currency(bs_report[:liabilities][:total])]
      csv << ['EQUITY', '', format_currency(bs_report[:equity][:total])]
    end
  end

  private

  def build_transaction_scope(filters = {})
    scope = FinancialTransaction.all
    scope = scope.for_company(@company.id) if @company
    scope = scope.where(transaction_type: filters[:transaction_type]) if filters[:transaction_type]
    scope = scope.where(category: filters[:category]) if filters[:category]
    scope = scope.where(status: filters[:status]) if filters[:status]
    scope = scope.for_job(filters[:construction_id]) if filters[:construction_id]

    if filters[:from_date] && filters[:to_date]
      scope = scope.in_date_range(filters[:from_date], filters[:to_date])
    elsif filters[:from_date]
      scope = scope.where('transaction_date >= ?', filters[:from_date])
    elsif filters[:to_date]
      scope = scope.where('transaction_date <= ?', filters[:to_date])
    end

    scope.recent
  end

  def format_currency(amount)
    "$#{sprintf('%.2f', amount.to_f)}"
  end
end
