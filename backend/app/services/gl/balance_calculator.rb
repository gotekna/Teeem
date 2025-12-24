# frozen_string_literal: true

module Gl
  # Balance Calculator Service
  #
  # Calculates account balances from journal entries:
  # - Period balances (opening, movements, closing)
  # - Running balances for bank accounts
  # - YTD balances
  #
  # Usage:
  #   calculator = Gl::BalanceCalculator.new(corporate_company, provider: 'xero', tenant_id: 'abc')
  #
  #   # Calculate all balances for a period
  #   calculator.calculate_period(period)
  #
  #   # Recalculate a single account
  #   calculator.recalculate_account(account, period)
  #
  #   # Get running balance for bank account
  #   calculator.running_balance(account, from_date, to_date)
  #
  class BalanceCalculator
    attr_reader :corporate_company, :external_provider, :external_tenant_id

    # Account types with debit normal balance
    DEBIT_NORMAL_TYPES = %w[asset expense].freeze

    # Account types with credit normal balance
    CREDIT_NORMAL_TYPES = %w[liability equity revenue].freeze

    def initialize(corporate_company, provider: nil, tenant_id: nil)
      @corporate_company = corporate_company
      @external_provider = provider
      @external_tenant_id = tenant_id
    end

    # ═══════════════════════════════════════════════════════════════
    # PERIOD BALANCE CALCULATIONS
    # ═══════════════════════════════════════════════════════════════

    # Calculate balances for all accounts in a period
    def calculate_period(period)
      accounts = scoped_accounts

      accounts.find_each do |account|
        calculate_account_balance(account, period)
      end

      period.touch(:calculated_at) if period.respond_to?(:calculated_at)
    end

    # Recalculate a single account's balance for a period
    def recalculate_account(account, period)
      calculate_account_balance(account, period)
    end

    # Calculate balances for all periods in a financial year
    def calculate_financial_year(financial_year)
      periods = Gl::Period
        .where(corporate_company: corporate_company)
        .where(financial_year: financial_year)
        .order(:period_start)

      periods.each do |period|
        calculate_period(period)
      end
    end

    # Recalculate all balances from the beginning
    def recalculate_all
      periods = scoped_periods.order(:period_start)

      periods.each do |period|
        calculate_period(period)
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # RUNNING BALANCE (for bank accounts)
    # ═══════════════════════════════════════════════════════════════

    # Get running balance history for an account
    # Returns array of { date:, description:, debit:, credit:, balance: }
    def running_balance(account, from_date, to_date)
      # Get opening balance at start date
      opening = opening_balance_at(account, from_date)

      # Get all ledger lines in date range
      lines = Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: account)
        .where(gl_journal_entries: { status: 'posted' })
        .where(gl_journal_entries: { entry_date: from_date..to_date })
        .order('gl_journal_entries.entry_date', 'gl_journal_entries.id', :line_number)
        .includes(gl_journal_entry: [])

      # Build running balance
      balance = opening
      transactions = []

      # Add opening balance row
      transactions << {
        date: from_date,
        description: 'Opening Balance',
        reference: nil,
        debit: nil,
        credit: nil,
        balance: balance
      }

      lines.each do |line|
        entry = line.gl_journal_entry
        movement = calculate_movement(line, account)
        balance += movement

        transactions << {
          date: entry.entry_date,
          description: line.description || entry.description,
          reference: entry.source_number,
          source_type: entry.source_type,
          debit: line.debit.positive? ? line.debit : nil,
          credit: line.credit.positive? ? line.credit : nil,
          movement: movement,
          balance: balance
        }
      end

      transactions
    end

    # Get running balance as of a specific date
    def balance_at(account, as_of_date)
      opening = opening_balance_at(account, as_of_date)
      movements = movements_before(account, as_of_date)
      opening + movements
    end

    # ═══════════════════════════════════════════════════════════════
    # BALANCE QUERIES
    # ═══════════════════════════════════════════════════════════════

    # Get balance for an account in a specific period
    def period_balance(account, period)
      Gl::AccountBalance.find_by(
        gl_account: account,
        gl_period: period
      )
    end

    # Get YTD balance for an account as of a period
    def ytd_balance(account, period)
      balance = period_balance(account, period)
      balance&.ytd_balance || calculate_ytd(account, period)
    end

    # Get current balance (latest period)
    def current_balance(account)
      latest_period = scoped_periods.open.order(period_end: :desc).first
      return 0 unless latest_period

      balance_at(account, Date.current)
    end

    # ═══════════════════════════════════════════════════════════════
    # TRIAL BALANCE
    # ═══════════════════════════════════════════════════════════════

    # Generate trial balance as of a date
    def trial_balance(as_of_date)
      accounts = scoped_accounts.active.order(:code)

      balances = accounts.map do |account|
        balance = balance_at(account, as_of_date)
        next if balance.zero?

        {
          account: account,
          code: account.code,
          name: account.name,
          account_type: account.account_type,
          debit: debit_normal?(account) && balance.positive? ? balance : (credit_normal?(account) && balance.negative? ? balance.abs : nil),
          credit: credit_normal?(account) && balance.positive? ? balance : (debit_normal?(account) && balance.negative? ? balance.abs : nil),
          balance: balance
        }
      end.compact

      {
        as_of_date: as_of_date,
        accounts: balances,
        total_debits: balances.sum { |b| b[:debit] || 0 },
        total_credits: balances.sum { |b| b[:credit] || 0 }
      }
    end

    private

    # ═══════════════════════════════════════════════════════════════
    # CORE CALCULATION METHODS
    # ═══════════════════════════════════════════════════════════════

    def calculate_account_balance(account, period)
      # Find or create balance record
      balance = Gl::AccountBalance.find_or_initialize_by(
        gl_account: account,
        gl_period: period
      )

      # Get opening balance
      if period.first_period_of_year?
        # Use opening balance from opening_balances table
        opening = Gl::OpeningBalance
          .where(gl_account: account, financial_year: period.financial_year)
          .first
          &.balance || 0
      else
        # Use previous period's closing balance
        prev_period = previous_period(period)
        prev_balance = period_balance(account, prev_period)
        opening = prev_balance&.closing_balance || 0
      end

      # Calculate period movements from posted journal entries
      movements = period_movements(account, period)

      # Calculate closing balance based on account type
      closing = opening + net_movement(account, movements)

      # Calculate YTD
      ytd = calculate_ytd_from_balances(account, period, opening, movements)

      # Update balance record
      balance.assign_attributes(
        opening_balance: opening,
        period_debits: movements[:debits],
        period_credits: movements[:credits],
        net_movement: movements[:net],
        closing_balance: closing,
        ytd_debits: ytd[:debits],
        ytd_credits: ytd[:credits],
        ytd_balance: ytd[:balance],
        transaction_count: movements[:count],
        calculated_at: Time.current
      )

      balance.save!
      balance
    end

    def period_movements(account, period)
      result = Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: account)
        .where(gl_journal_entries: { status: 'posted' })
        .where(gl_journal_entries: { entry_date: period.period_start..period.period_end })
        .select(
          'SUM(gl_ledger_lines.debit) as total_debits',
          'SUM(gl_ledger_lines.credit) as total_credits',
          'COUNT(*) as line_count'
        )
        .first

      debits = result.total_debits || 0
      credits = result.total_credits || 0

      {
        debits: debits,
        credits: credits,
        net: debits - credits,
        count: result.line_count || 0
      }
    end

    def net_movement(account, movements)
      if debit_normal?(account)
        # Debits increase, credits decrease
        movements[:debits] - movements[:credits]
      else
        # Credits increase, debits decrease
        movements[:credits] - movements[:debits]
      end
    end

    def calculate_ytd_from_balances(account, period, opening, movements)
      # Get all prior periods in the same FY
      prior_periods = scoped_periods
        .where(financial_year: period.financial_year)
        .where('period_start < ?', period.period_start)
        .order(:period_start)

      ytd_debits = movements[:debits]
      ytd_credits = movements[:credits]

      prior_periods.each do |prior|
        prior_balance = period_balance(account, prior)
        if prior_balance
          ytd_debits += prior_balance.period_debits
          ytd_credits += prior_balance.period_credits
        end
      end

      # YTD balance from opening balance + all movements
      fy_opening = Gl::OpeningBalance
        .where(gl_account: account, financial_year: period.financial_year)
        .first
        &.balance || 0

      ytd_balance = fy_opening + (debit_normal?(account) ? ytd_debits - ytd_credits : ytd_credits - ytd_debits)

      {
        debits: ytd_debits,
        credits: ytd_credits,
        balance: ytd_balance
      }
    end

    def calculate_ytd(account, period)
      fy_start = Gl::Period
        .where(corporate_company: corporate_company, financial_year: period.financial_year)
        .order(:period_start)
        .first
        &.period_start

      return 0 unless fy_start

      opening = Gl::OpeningBalance
        .where(gl_account: account, financial_year: period.financial_year)
        .first
        &.balance || 0

      movements = Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: account)
        .where(gl_journal_entries: { status: 'posted' })
        .where(gl_journal_entries: { entry_date: fy_start..period.period_end })
        .sum(debit_normal?(account) ? 'debit - credit' : 'credit - debit')

      opening + movements
    end

    def opening_balance_at(account, as_of_date)
      # Find the FY for this date
      period = Gl::Period.for_date(corporate_company, as_of_date,
        provider: external_provider, tenant_id: external_tenant_id)

      return 0 unless period

      # Get opening balance for FY
      fy_opening = Gl::OpeningBalance
        .where(gl_account: account, financial_year: period.financial_year)
        .first
        &.balance || 0

      # Add all movements before the start date
      fy_start = Gl::Period
        .where(corporate_company: corporate_company, financial_year: period.financial_year)
        .order(:period_start)
        .first
        &.period_start

      return fy_opening unless fy_start && as_of_date > fy_start

      # Get movements from FY start to day before as_of_date
      movements = movements_between(account, fy_start, as_of_date - 1.day)

      fy_opening + movements
    end

    def movements_before(account, before_date)
      # Get all movements up to but not including the date
      Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: account)
        .where(gl_journal_entries: { status: 'posted' })
        .where('gl_journal_entries.entry_date < ?', before_date)
        .sum(debit_normal?(account) ? 'debit - credit' : 'credit - debit')
    end

    def movements_between(account, from_date, to_date)
      Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: account)
        .where(gl_journal_entries: { status: 'posted' })
        .where(gl_journal_entries: { entry_date: from_date..to_date })
        .sum(debit_normal?(account) ? 'debit - credit' : 'credit - debit')
    end

    def calculate_movement(line, account)
      if debit_normal?(account)
        line.debit - line.credit
      else
        line.credit - line.debit
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # HELPERS
    # ═══════════════════════════════════════════════════════════════

    def scoped_accounts
      scope = Gl::Account.where(corporate_company: corporate_company)
      if external_provider
        scope = scope.where(external_provider: external_provider, external_tenant_id: external_tenant_id)
      else
        scope = scope.where(external_provider: nil)
      end
      scope
    end

    def scoped_periods
      scope = Gl::Period.where(corporate_company: corporate_company)
      if external_provider
        scope = scope.where(external_provider: external_provider, external_tenant_id: external_tenant_id)
      else
        scope = scope.where(external_provider: nil)
      end
      scope
    end

    def previous_period(period)
      scoped_periods
        .where('period_end < ?', period.period_start)
        .order(period_end: :desc)
        .first
    end

    def debit_normal?(account)
      DEBIT_NORMAL_TYPES.include?(account.account_type)
    end

    def credit_normal?(account)
      CREDIT_NORMAL_TYPES.include?(account.account_type)
    end
  end
end
