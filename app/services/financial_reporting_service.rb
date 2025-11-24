class FinancialReportingService
  class ReportError < StandardError; end

  def initialize(company: nil)
    @company = company
  end

  # Generate Balance Sheet as of a specific date
  def generate_balance_sheet(as_of_date: Date.current)
    as_of_date = parse_date(as_of_date)

    {
      report_type: 'balance_sheet',
      as_of_date: as_of_date,
      company_id: @company&.id,
      assets: calculate_assets(as_of_date),
      liabilities: calculate_liabilities(as_of_date),
      equity: calculate_equity(as_of_date),
      generated_at: Time.current
    }
  end

  # Generate Profit & Loss Statement for a date range
  def generate_profit_loss(from_date:, to_date: Date.current, group_by: nil)
    from_date = parse_date(from_date)
    to_date = parse_date(to_date)

    validate_date_range!(from_date, to_date)

    revenue = calculate_revenue(from_date, to_date)
    expenses = calculate_expenses(from_date, to_date)
    net_profit = revenue[:total] - expenses[:total]

    result = {
      report_type: 'profit_loss',
      from_date: from_date,
      to_date: to_date,
      company_id: @company&.id,
      revenue: revenue,
      expenses: expenses,
      net_profit: net_profit,
      profit_margin: revenue[:total] > 0 ? (net_profit / revenue[:total] * 100).round(2) : 0,
      generated_at: Time.current
    }

    # Add grouping if requested
    if group_by.present?
      result[:grouped_data] = group_profit_loss(from_date, to_date, group_by)
    end

    result
  end

  # Generate Job Profitability Report
  def generate_job_profitability(construction_ids: nil, from_date: nil, to_date: Date.current)
    from_date = parse_date(from_date) if from_date
    to_date = parse_date(to_date)

    # Build base query
    scope = FinancialTransaction.posted
    scope = scope.for_company(@company.id) if @company
    scope = scope.in_date_range(from_date, to_date) if from_date
    scope = scope.where(construction_id: construction_ids) if construction_ids.present?
    scope = scope.where.not(construction_id: nil) # Only transactions linked to jobs

    # Group by job
    job_data = scope.group(:construction_id).select(
      'construction_id',
      "SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as total_income",
      "SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as total_expenses"
    )

    jobs = job_data.map do |data|
      construction = Construction.find(data.construction_id)
      income = data.total_income.to_f
      expenses = data.total_expenses.to_f
      profit = income - expenses
      margin = income > 0 ? (profit / income * 100).round(2) : 0

      {
        construction_id: construction.id,
        construction_name: construction.name || "Job ##{construction.id}",
        income: income,
        expenses: expenses,
        net_profit: profit,
        profit_margin: margin
      }
    end

    # Calculate totals
    total_income = jobs.sum { |j| j[:income] }
    total_expenses = jobs.sum { |j| j[:expenses] }
    total_profit = total_income - total_expenses
    overall_margin = total_income > 0 ? (total_profit / total_income * 100).round(2) : 0

    {
      report_type: 'job_profitability',
      from_date: from_date,
      to_date: to_date,
      company_id: @company&.id,
      jobs: jobs.sort_by { |j| -j[:net_profit] }, # Sort by profit descending
      totals: {
        income: total_income,
        expenses: total_expenses,
        net_profit: total_profit,
        profit_margin: overall_margin
      },
      generated_at: Time.current
    }
  end

  # Get account balances using Keepr
  def get_account_balances(as_of_date: Date.current)
    as_of_date = parse_date(as_of_date)
    date_range = (Date.new(1970, 1, 1)..as_of_date)

    Keepr::Account.all.map do |account|
      balance = account.balance(date_range)
      {
        account_id: account.id,
        account_number: account.number,
        account_name: account.name,
        account_kind: account.kind,
        balance: balance.to_f
      }
    end
  end

  # Get trial balance (should equal zero)
  def trial_balance(as_of_date: Date.current)
    as_of_date = parse_date(as_of_date)
    date_range = (Date.new(1970, 1, 1)..as_of_date)

    balance = Keepr::Account.trial_balance(date_range)

    {
      trial_balance: balance.to_f,
      balanced: balance.to_f.abs < 0.01, # Allow for tiny rounding errors
      as_of_date: as_of_date
    }
  end

  private

  def parse_date(date)
    return date if date.is_a?(Date)
    Date.parse(date.to_s)
  rescue ArgumentError
    raise ReportError, "Invalid date format: #{date}"
  end

  def validate_date_range!(from_date, to_date)
    if from_date > to_date
      raise ReportError, "From date cannot be after to date"
    end
  end

  def calculate_assets(as_of_date)
    date_range = (Date.new(1970, 1, 1)..as_of_date)

    current_assets = calculate_account_group([1000, 1100, 1200], date_range)
    fixed_assets = calculate_account_group([1400, 1500], date_range)

    {
      current_assets: current_assets,
      fixed_assets: fixed_assets,
      total: current_assets[:total] + fixed_assets[:total]
    }
  end

  def calculate_liabilities(as_of_date)
    date_range = (Date.new(1970, 1, 1)..as_of_date)

    current_liabilities = calculate_account_group([2000, 2100, 2200], date_range)

    {
      current_liabilities: current_liabilities,
      total: current_liabilities[:total]
    }
  end

  def calculate_equity(as_of_date)
    date_range = (Date.new(1970, 1, 1)..as_of_date)

    equity_accounts = calculate_account_group([3000, 3100, 3200], date_range)

    {
      equity_accounts: equity_accounts,
      total: equity_accounts[:total]
    }
  end

  def calculate_revenue(from_date, to_date)
    date_range = (from_date..to_date)

    revenue_accounts = {
      'Job Revenue' => Keepr::Account.find_by(number: 4000),
      'Material Sales' => Keepr::Account.find_by(number: 4100),
      'Other Income' => Keepr::Account.find_by(number: 4200)
    }

    details = {}
    total = 0

    revenue_accounts.each do |name, account|
      next unless account

      balance = account.balance(date_range).abs.to_f
      details[name] = balance
      total += balance
    end

    {
      details: details,
      total: total
    }
  end

  def calculate_expenses(from_date, to_date)
    date_range = (from_date..to_date)

    expense_accounts = {
      'Materials' => Keepr::Account.find_by(number: 5000),
      'Labour' => Keepr::Account.find_by(number: 5100),
      'Subcontractors' => Keepr::Account.find_by(number: 5200),
      'Tools & Equipment' => Keepr::Account.find_by(number: 5300),
      'Fuel & Transport' => Keepr::Account.find_by(number: 5400),
      'Insurance' => Keepr::Account.find_by(number: 5500),
      'Professional Fees' => Keepr::Account.find_by(number: 5600),
      'Other Expenses' => Keepr::Account.find_by(number: 5700)
    }

    details = {}
    total = 0

    expense_accounts.each do |name, account|
      next unless account

      balance = account.balance(date_range).abs.to_f
      details[name] = balance
      total += balance
    end

    {
      details: details,
      total: total
    }
  end

  def calculate_account_group(account_numbers, date_range)
    details = {}
    total = 0

    account_numbers.each do |number|
      account = Keepr::Account.find_by(number: number)
      next unless account

      balance = account.balance(date_range).to_f
      details[account.name] = balance
      total += balance
    end

    {
      details: details,
      total: total
    }
  end

  def group_profit_loss(from_date, to_date, group_by)
    case group_by.to_s
    when 'month'
      group_by_month(from_date, to_date)
    when 'quarter'
      group_by_quarter(from_date, to_date)
    when 'year'
      group_by_year(from_date, to_date)
    else
      []
    end
  end

  def group_by_month(from_date, to_date)
    results = []
    current_date = from_date.beginning_of_month

    while current_date <= to_date
      month_end = [current_date.end_of_month, to_date].min
      revenue = calculate_revenue(current_date, month_end)
      expenses = calculate_expenses(current_date, month_end)

      results << {
        period: current_date.strftime('%B %Y'),
        from_date: current_date,
        to_date: month_end,
        revenue: revenue[:total],
        expenses: expenses[:total],
        net_profit: revenue[:total] - expenses[:total]
      }

      current_date = current_date.next_month.beginning_of_month
    end

    results
  end

  def group_by_quarter(from_date, to_date)
    results = []
    current_date = from_date.beginning_of_quarter

    while current_date <= to_date
      quarter_end = [current_date.end_of_quarter, to_date].min
      revenue = calculate_revenue(current_date, quarter_end)
      expenses = calculate_expenses(current_date, quarter_end)

      results << {
        period: "Q#{(current_date.month - 1) / 3 + 1} #{current_date.year}",
        from_date: current_date,
        to_date: quarter_end,
        revenue: revenue[:total],
        expenses: expenses[:total],
        net_profit: revenue[:total] - expenses[:total]
      }

      current_date = (current_date + 3.months).beginning_of_quarter
    end

    results
  end

  def group_by_year(from_date, to_date)
    results = []
    current_date = from_date.beginning_of_year

    while current_date <= to_date
      year_end = [current_date.end_of_year, to_date].min
      revenue = calculate_revenue(current_date, year_end)
      expenses = calculate_expenses(current_date, year_end)

      results << {
        period: current_date.year.to_s,
        from_date: current_date,
        to_date: year_end,
        revenue: revenue[:total],
        expenses: expenses[:total],
        net_profit: revenue[:total] - expenses[:total]
      }

      current_date = current_date.next_year.beginning_of_year
    end

    results
  end
end
