# frozen_string_literal: true

module Gl
  # Service for forecasting future cash flows
  #
  # Projects cash position based on:
  # - Current bank balances
  # - Outstanding receivables (when invoices are due)
  # - Outstanding payables (when bills are due)
  # - Recurring transactions (detected patterns)
  # - Scheduled payments
  #
  class CashFlowForecastService
    attr_reader :corporate, :forecast_days, :start_date

    # Default thresholds for warnings
    DEFAULT_WARNING_THRESHOLD = 10_000  # Warn if balance drops below this
    DEFAULT_CRITICAL_THRESHOLD = 0      # Critical if balance goes negative

    # Collection probability assumptions
    COLLECTION_PROBABILITY = {
      current: 0.95,      # Due within 7 days
      overdue_30: 0.80,   # 1-30 days overdue
      overdue_60: 0.60,   # 31-60 days overdue
      overdue_90: 0.40,   # 61-90 days overdue
      overdue_120: 0.20   # 90+ days overdue
    }.freeze

    def initialize(corporate, options = {})
      @corporate = corporate
      @forecast_days = options[:days] || 90
      @start_date = options[:start_date] || Date.current
      @warning_threshold = options[:warning_threshold] || DEFAULT_WARNING_THRESHOLD
      @critical_threshold = options[:critical_threshold] || DEFAULT_CRITICAL_THRESHOLD
    end

    # Generate complete cash flow forecast
    def forecast
      opening_balance = calculate_opening_balance

      # Build daily forecast
      daily_forecast = build_daily_forecast(opening_balance)

      # Aggregate to weekly
      weekly_forecast = aggregate_to_weekly(daily_forecast)

      # Find issues
      warnings = find_warnings(daily_forecast)
      recommendations = generate_recommendations(daily_forecast, warnings)

      {
        generated_at: Time.current,
        period: {
          start_date: start_date,
          end_date: start_date + forecast_days.days,
          days: forecast_days
        },
        opening_balance: opening_balance,
        summary: build_summary(daily_forecast),
        weekly: weekly_forecast,
        daily: daily_forecast,
        warnings: warnings,
        recommendations: recommendations,
        assumptions: forecast_assumptions
      }
    end

    # Quick summary forecast
    def summary_forecast
      opening_balance = calculate_opening_balance
      daily_forecast = build_daily_forecast(opening_balance)

      {
        generated_at: Time.current,
        opening_balance: opening_balance,
        closing_balance: daily_forecast.last[:closing_balance],
        total_inflows: daily_forecast.sum { |d| d[:inflows][:total] },
        total_outflows: daily_forecast.sum { |d| d[:outflows][:total] },
        net_change: daily_forecast.sum { |d| d[:net_flow] },
        lowest_balance: daily_forecast.min_by { |d| d[:closing_balance] },
        has_warnings: find_warnings(daily_forecast).any?
      }
    end

    # Get expected inflows (receivables)
    def expected_inflows
      invoices = outstanding_receivables

      invoices.map do |invoice|
        probability = collection_probability(invoice)
        expected_date = expected_collection_date(invoice)

        {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          contact: invoice.contact&.name,
          amount: invoice.amount_due,
          due_date: invoice.due_date,
          expected_date: expected_date,
          days_overdue: invoice.days_overdue,
          probability: probability,
          expected_amount: (invoice.amount_due * probability).round(2),
          job: invoice.job&.name
        }
      end.sort_by { |i| i[:expected_date] }
    end

    # Get expected outflows (payables)
    def expected_outflows
      bills = outstanding_payables

      bills.map do |bill|
        {
          id: bill.id,
          bill_number: bill.invoice_number,
          contact: bill.contact&.name,
          amount: bill.amount_due,
          due_date: bill.due_date,
          days_until_due: (bill.due_date - Date.current).to_i,
          priority: payment_priority(bill),
          job: bill.job&.name
        }
      end.sort_by { |b| b[:due_date] }
    end

    # Detect recurring transactions
    def recurring_patterns
      # Analyze last 6 months of transactions to detect patterns
      patterns = []

      # Look for weekly patterns
      weekly = detect_weekly_patterns
      patterns.concat(weekly)

      # Look for monthly patterns
      monthly = detect_monthly_patterns
      patterns.concat(monthly)

      patterns
    end

    # What-if scenario analysis
    def scenario_analysis(scenarios = [])
      base_forecast = forecast

      scenarios.map do |scenario|
        modified_forecast = apply_scenario(base_forecast, scenario)

        {
          name: scenario[:name],
          description: scenario[:description],
          impact: {
            closing_balance_change: modified_forecast[:summary][:closing_balance] - base_forecast[:summary][:closing_balance],
            lowest_balance_change: modified_forecast[:summary][:lowest_balance] - base_forecast[:summary][:lowest_balance],
            warnings_count: modified_forecast[:warnings].length
          },
          forecast: modified_forecast
        }
      end
    end

    private

    def calculate_opening_balance
      # Sum of all bank account balances
      bank_accounts = Gl::Account
        .where(corporate: corporate)
        .where(is_bank_account: true)
        .where(active: true)

      total = 0
      bank_accounts.each do |account|
        balance = Gl::LedgerLine
          .joins(:gl_journal_entry)
          .where(gl_account: account)
          .where('gl_journal_entries.entry_date <= ?', start_date)
          .sum('debit - credit')
        total += balance
      end

      total.to_d
    end

    def build_daily_forecast(opening_balance)
      forecast = []
      running_balance = opening_balance

      # Pre-calculate expected cash flows
      inflows_by_date = group_inflows_by_date
      outflows_by_date = group_outflows_by_date
      recurring_by_date = group_recurring_by_date

      (0...forecast_days).each do |day_offset|
        date = start_date + day_offset.days

        # Get flows for this date
        ar_inflows = inflows_by_date[date] || []
        ap_outflows = outflows_by_date[date] || []
        recurring = recurring_by_date[date] || { inflows: [], outflows: [] }

        # Calculate totals
        total_inflows = ar_inflows.sum { |i| i[:expected_amount] } +
                       recurring[:inflows].sum { |i| i[:amount] }
        total_outflows = ap_outflows.sum { |o| o[:amount] } +
                        recurring[:outflows].sum { |o| o[:amount] }

        net_flow = total_inflows - total_outflows
        closing_balance = running_balance + net_flow

        forecast << {
          date: date,
          day_of_week: date.strftime('%A'),
          is_weekend: date.saturday? || date.sunday?,
          opening_balance: running_balance.round(2),
          inflows: {
            receivables: ar_inflows,
            recurring: recurring[:inflows],
            total: total_inflows.round(2)
          },
          outflows: {
            payables: ap_outflows,
            recurring: recurring[:outflows],
            total: total_outflows.round(2)
          },
          net_flow: net_flow.round(2),
          closing_balance: closing_balance.round(2),
          status: balance_status(closing_balance)
        }

        running_balance = closing_balance
      end

      forecast
    end

    def group_inflows_by_date
      inflows = {}

      outstanding_receivables.each do |invoice|
        expected_date = expected_collection_date(invoice)
        next if expected_date < start_date || expected_date > start_date + forecast_days.days

        inflows[expected_date] ||= []
        inflows[expected_date] << {
          type: 'receivable',
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          contact: invoice.contact&.name,
          amount: invoice.amount_due,
          expected_amount: (invoice.amount_due * collection_probability(invoice)).round(2),
          probability: collection_probability(invoice)
        }
      end

      inflows
    end

    def group_outflows_by_date
      outflows = {}

      outstanding_payables.each do |bill|
        due_date = bill.due_date
        next if due_date < start_date || due_date > start_date + forecast_days.days

        outflows[due_date] ||= []
        outflows[due_date] << {
          type: 'payable',
          bill_id: bill.id,
          bill_number: bill.invoice_number,
          contact: bill.contact&.name,
          amount: bill.amount_due,
          priority: payment_priority(bill)
        }
      end

      outflows
    end

    def group_recurring_by_date
      patterns = recurring_patterns
      recurring = {}

      (0...forecast_days).each do |day_offset|
        date = start_date + day_offset.days
        recurring[date] = { inflows: [], outflows: [] }

        patterns.each do |pattern|
          if pattern_matches_date?(pattern, date)
            item = {
              type: 'recurring',
              description: pattern[:description],
              amount: pattern[:amount],
              pattern_type: pattern[:frequency]
            }

            if pattern[:is_inflow]
              recurring[date][:inflows] << item
            else
              recurring[date][:outflows] << item
            end
          end
        end
      end

      recurring
    end

    def aggregate_to_weekly(daily_forecast)
      weekly = []
      current_week = nil

      daily_forecast.each do |day|
        week_start = day[:date].beginning_of_week

        if current_week.nil? || current_week[:week_start] != week_start
          weekly << current_week if current_week
          current_week = {
            week_start: week_start,
            week_end: week_start + 6.days,
            week_number: day[:date].strftime('%W').to_i,
            opening_balance: day[:opening_balance],
            closing_balance: day[:closing_balance],
            inflows: 0,
            outflows: 0,
            net_flow: 0,
            lowest_balance: day[:closing_balance],
            status: 'healthy'
          }
        end

        current_week[:inflows] += day[:inflows][:total]
        current_week[:outflows] += day[:outflows][:total]
        current_week[:net_flow] += day[:net_flow]
        current_week[:closing_balance] = day[:closing_balance]
        current_week[:lowest_balance] = [current_week[:lowest_balance], day[:closing_balance]].min

        # Update status to worst status of the week
        if day[:status][:level] == 'critical'
          current_week[:status] = 'critical'
        elsif day[:status][:level] == 'warning' && current_week[:status] != 'critical'
          current_week[:status] = 'warning'
        end
      end

      weekly << current_week if current_week
      weekly
    end

    def build_summary(daily_forecast)
      {
        opening_balance: daily_forecast.first[:opening_balance],
        closing_balance: daily_forecast.last[:closing_balance],
        total_inflows: daily_forecast.sum { |d| d[:inflows][:total] }.round(2),
        total_outflows: daily_forecast.sum { |d| d[:outflows][:total] }.round(2),
        net_change: daily_forecast.sum { |d| d[:net_flow] }.round(2),
        lowest_balance: daily_forecast.min_by { |d| d[:closing_balance] }[:closing_balance],
        lowest_balance_date: daily_forecast.min_by { |d| d[:closing_balance] }[:date],
        highest_balance: daily_forecast.max_by { |d| d[:closing_balance] }[:closing_balance],
        average_balance: (daily_forecast.sum { |d| d[:closing_balance] } / daily_forecast.length).round(2),
        days_below_warning: daily_forecast.count { |d| d[:closing_balance] < @warning_threshold },
        days_below_critical: daily_forecast.count { |d| d[:closing_balance] < @critical_threshold }
      }
    end

    def find_warnings(daily_forecast)
      warnings = []

      # Find first day below warning threshold
      first_warning = daily_forecast.find { |d| d[:closing_balance] < @warning_threshold }
      if first_warning
        warnings << {
          type: 'low_balance',
          severity: first_warning[:closing_balance] < @critical_threshold ? 'critical' : 'warning',
          date: first_warning[:date],
          balance: first_warning[:closing_balance],
          message: "Balance projected to drop to #{format_currency(first_warning[:closing_balance])} on #{first_warning[:date].strftime('%d %b')}"
        }
      end

      # Find large outflows
      daily_forecast.each do |day|
        if day[:outflows][:total] > 50_000
          warnings << {
            type: 'large_outflow',
            severity: 'info',
            date: day[:date],
            amount: day[:outflows][:total],
            message: "Large payment of #{format_currency(day[:outflows][:total])} due on #{day[:date].strftime('%d %b')}"
          }
        end
      end

      # Check for overdue receivables
      overdue_total = outstanding_receivables.select(&:overdue?).sum(&:amount_due)
      if overdue_total > 10_000
        warnings << {
          type: 'overdue_receivables',
          severity: 'warning',
          amount: overdue_total,
          message: "#{format_currency(overdue_total)} in overdue receivables may delay expected cash"
        }
      end

      warnings
    end

    def generate_recommendations(daily_forecast, warnings)
      recommendations = []

      # If balance goes below threshold
      low_balance_warning = warnings.find { |w| w[:type] == 'low_balance' }
      if low_balance_warning
        # Suggest delaying payments
        deferrable_bills = outstanding_payables
          .select { |b| b.due_date <= low_balance_warning[:date] }
          .select { |b| payment_priority(b) == 'low' }
          .sort_by(&:amount_due)
          .reverse
          .first(3)

        if deferrable_bills.any?
          recommendations << {
            type: 'defer_payment',
            priority: 'high',
            title: 'Consider deferring payments',
            description: "Delay payment of #{deferrable_bills.length} low-priority bills to improve cash position",
            potential_impact: deferrable_bills.sum(&:amount_due),
            items: deferrable_bills.map { |b| { id: b.id, number: b.invoice_number, amount: b.amount_due } }
          }
        end

        # Suggest chasing overdue invoices
        overdue_invoices = outstanding_receivables
          .select(&:overdue?)
          .sort_by(&:amount_due)
          .reverse
          .first(5)

        if overdue_invoices.any?
          recommendations << {
            type: 'chase_receivables',
            priority: 'high',
            title: 'Follow up on overdue invoices',
            description: "Chase #{overdue_invoices.length} overdue invoices to accelerate cash collection",
            potential_impact: overdue_invoices.sum(&:amount_due),
            items: overdue_invoices.map { |i| { id: i.id, number: i.invoice_number, amount: i.amount_due, days_overdue: i.days_overdue } }
          }
        end
      end

      # If high cash balance, suggest investments
      avg_balance = daily_forecast.sum { |d| d[:closing_balance] } / daily_forecast.length
      if avg_balance > 100_000
        recommendations << {
          type: 'optimize_cash',
          priority: 'low',
          title: 'Consider optimizing excess cash',
          description: "Average balance of #{format_currency(avg_balance)} may be earning better returns in a high-interest account",
          potential_impact: (avg_balance * 0.04 / 12).round(2) # Assume 4% annual return
        }
      end

      recommendations
    end

    def outstanding_receivables
      @receivables ||= Gl::Invoice
        .where(corporate: corporate)
        .where(invoice_type: 'sales_invoice')
        .where(status: %w[approved submitted])
        .where('amount_due > 0')
        .includes(:contact, :job)
        .order(:due_date)
    end

    def outstanding_payables
      @payables ||= Gl::Invoice
        .where(corporate: corporate)
        .where(invoice_type: 'bill')
        .where(status: %w[approved submitted])
        .where('amount_due > 0')
        .includes(:contact, :job)
        .order(:due_date)
    end

    def collection_probability(invoice)
      days_overdue = invoice.days_overdue

      if days_overdue <= 0
        COLLECTION_PROBABILITY[:current]
      elsif days_overdue <= 30
        COLLECTION_PROBABILITY[:overdue_30]
      elsif days_overdue <= 60
        COLLECTION_PROBABILITY[:overdue_60]
      elsif days_overdue <= 90
        COLLECTION_PROBABILITY[:overdue_90]
      else
        COLLECTION_PROBABILITY[:overdue_120]
      end
    end

    def expected_collection_date(invoice)
      # If overdue, expect collection within next 7-14 days based on follow-up
      if invoice.overdue?
        [invoice.due_date, start_date + rand(7..14).days].max
      else
        # Expect payment on due date, but not on weekends
        date = invoice.due_date
        date += 1.day while date.saturday? || date.sunday?
        date
      end
    end

    def payment_priority(bill)
      # Determine payment priority based on various factors
      days_until_due = (bill.due_date - Date.current).to_i

      if days_until_due < 0
        'critical'  # Overdue
      elsif days_until_due <= 7
        'high'      # Due soon
      elsif bill.contact&.name&.include?('ATO') || bill.contact&.name&.include?('Tax')
        'high'      # Tax obligations
      else
        'low'
      end
    end

    def detect_weekly_patterns
      # Simplified pattern detection - would be more sophisticated in production
      []
    end

    def detect_monthly_patterns
      # Look for transactions that occur on similar dates each month
      patterns = []

      # Analyze expense accounts for recurring patterns
      # This is a simplified version - production would use ML
      recurring_expenses = Gl::LedgerLine
        .joins(:gl_journal_entry, :gl_account)
        .where(gl_accounts: { corporate: corporate, account_type: 'expense' })
        .where('gl_journal_entries.entry_date >= ?', 6.months.ago)
        .group('gl_accounts.name', 'EXTRACT(DAY FROM gl_journal_entries.entry_date)')
        .having('COUNT(*) >= 3')  # At least 3 occurrences
        .select(
          'gl_accounts.name as account_name',
          'EXTRACT(DAY FROM gl_journal_entries.entry_date) as day_of_month',
          'AVG(gl_ledger_lines.debit - gl_ledger_lines.credit) as avg_amount',
          'COUNT(*) as occurrences'
        )

      recurring_expenses.each do |expense|
        patterns << {
          type: 'monthly',
          frequency: 'monthly',
          day_of_month: expense.day_of_month.to_i,
          description: expense.account_name,
          amount: expense.avg_amount.to_d.round(2),
          is_inflow: false,
          confidence: [expense.occurrences.to_f / 6, 1.0].min
        }
      end

      patterns
    end

    def pattern_matches_date?(pattern, date)
      case pattern[:frequency]
      when 'weekly'
        date.wday == pattern[:day_of_week]
      when 'monthly'
        date.day == pattern[:day_of_month]
      when 'fortnightly'
        # Simplified - would need anchor date
        false
      else
        false
      end
    end

    def balance_status(balance)
      if balance < @critical_threshold
        { level: 'critical', color: 'red', message: 'Below critical threshold' }
      elsif balance < @warning_threshold
        { level: 'warning', color: 'yellow', message: 'Below warning threshold' }
      else
        { level: 'healthy', color: 'green', message: 'Healthy' }
      end
    end

    def format_currency(amount)
      "$#{amount.to_i.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse}"
    end

    def forecast_assumptions
      {
        collection_probabilities: COLLECTION_PROBABILITY,
        warning_threshold: @warning_threshold,
        critical_threshold: @critical_threshold,
        excludes_weekends: false,
        includes_recurring: true,
        data_freshness: Time.current
      }
    end

    def apply_scenario(base_forecast, scenario)
      # Clone and modify the forecast based on scenario
      modified = Marshal.load(Marshal.dump(base_forecast))

      case scenario[:type]
      when 'delay_collection'
        # Shift all receivables by X days
        # Implementation would modify the daily forecast
      when 'accelerate_payment'
        # Move all payables earlier
      when 'add_expense'
        # Add a one-time expense
      end

      modified
    end
  end
end
