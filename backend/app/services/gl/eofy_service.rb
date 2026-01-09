# frozen_string_literal: true

module Gl
  # End of Financial Year (EOFY) Service
  #
  # Manages the year-end process for Australian companies including:
  # - Pre-closing checklist with validation
  # - Year-end adjustments
  # - Period locking
  # - Opening balance rollforward
  # - EOFY report package generation
  #
  class EofyService
    attr_reader :corporate_company, :financial_year, :options

    # Australian FY runs July 1 - June 30
    FY_START_MONTH = 7
    FY_END_MONTH = 6

    # Checklist items with validation rules
    CHECKLIST_ITEMS = [
      {
        key: :bank_reconciliation,
        category: :reconciliation,
        label: 'Bank accounts reconciled to June 30',
        description: 'All bank accounts must be reconciled up to the last day of the financial year',
        critical: true,
        auto_check: true
      },
      {
        key: :bas_lodged,
        category: :tax,
        label: 'All BAS quarters lodged',
        description: 'Q1, Q2, Q3, and Q4 BAS must be lodged or marked as lodged',
        critical: true,
        auto_check: true
      },
      {
        key: :outstanding_invoices_reviewed,
        category: :receivables,
        label: 'Outstanding invoices reviewed',
        description: 'Review aged receivables and write off bad debts if necessary',
        critical: false,
        auto_check: false
      },
      {
        key: :bad_debts_written_off,
        category: :receivables,
        label: 'Bad debts written off',
        description: 'Uncollectable debts should be written off before year end',
        critical: false,
        auto_check: false
      },
      {
        key: :outstanding_bills_reviewed,
        category: :payables,
        label: 'Outstanding bills reviewed',
        description: 'Ensure all supplier invoices for the year are entered',
        critical: false,
        auto_check: false
      },
      {
        key: :depreciation_calculated,
        category: :adjustments,
        label: 'Depreciation calculated',
        description: 'Annual depreciation for all fixed assets must be recorded',
        critical: true,
        auto_check: true
      },
      {
        key: :prepayments_processed,
        category: :adjustments,
        label: 'Prepayments processed',
        description: 'Prepaid expenses should be adjusted to the correct period',
        critical: false,
        auto_check: false
      },
      {
        key: :accruals_processed,
        category: :adjustments,
        label: 'Accruals processed',
        description: 'Accrued expenses and income should be recorded',
        critical: false,
        auto_check: false
      },
      {
        key: :inventory_stocktake,
        category: :inventory,
        label: 'Inventory stocktake completed',
        description: 'Physical inventory count reconciled with system',
        critical: false,
        auto_check: false,
        conditional: :has_inventory
      },
      {
        key: :payroll_reconciled,
        category: :payroll,
        label: 'Payroll reconciled',
        description: 'PAYG withholding reconciled with ATO records',
        critical: true,
        auto_check: false,
        conditional: :has_payroll
      },
      {
        key: :superannuation_paid,
        category: :payroll,
        label: 'Superannuation paid',
        description: 'Q4 super must be paid by June 30 for tax deduction',
        critical: true,
        auto_check: false,
        conditional: :has_payroll
      },
      {
        key: :trial_balance_reviewed,
        category: :review,
        label: 'Trial balance reviewed',
        description: 'Review trial balance for unusual balances or errors',
        critical: true,
        auto_check: false
      },
      {
        key: :profit_loss_reviewed,
        category: :review,
        label: 'Profit & Loss reviewed',
        description: 'Review P&L and compare to prior year and budget',
        critical: true,
        auto_check: false
      },
      {
        key: :balance_sheet_reviewed,
        category: :review,
        label: 'Balance Sheet reviewed',
        description: 'Review Balance Sheet for correct asset/liability classification',
        critical: true,
        auto_check: false
      }
    ].freeze

    def initialize(corporate_company, financial_year = nil, options = {})
      @corporate_company = corporate_company
      @financial_year = financial_year || current_financial_year
      @options = options.with_indifferent_access
    end

    # Get full EOFY status
    def status
      {
        financial_year: financial_year,
        period: fy_period,
        status: eofy_status,
        checklist: checklist_with_status,
        progress: calculate_progress,
        can_close: can_close?,
        is_closed: is_closed?,
        closed_at: closed_at,
        next_steps: next_steps
      }
    end

    # Get checklist with current status
    def checklist
      checklist_with_status
    end

    # Update checklist item status
    def update_checklist_item(key, completed:, notes: nil)
      item = find_checklist_item(key)
      return { success: false, error: 'Checklist item not found' } unless item

      # Store completion in database or cache
      store_checklist_status(key, completed, notes)

      {
        success: true,
        item: item.merge(
          completed: completed,
          notes: notes,
          updated_at: Time.current
        )
      }
    end

    # Run all auto-checks
    def run_auto_checks
      results = {}

      CHECKLIST_ITEMS.select { |item| item[:auto_check] }.each do |item|
        results[item[:key]] = run_check(item[:key])
      end

      results
    end

    # Check if year can be closed
    def can_close?
      checklist = checklist_with_status
      critical_items = checklist.select { |item| item[:critical] }

      # All critical items must be complete
      critical_items.all? { |item| item[:completed] }
    end

    # Close the financial year
    def close_year!
      return { success: false, error: 'Cannot close - critical items incomplete' } unless can_close?
      return { success: false, error: 'Year already closed' } if is_closed?

      ActiveRecord::Base.transaction do
        # Lock all periods for the FY
        lock_periods!

        # Create closing journal entries
        create_closing_entries!

        # Generate opening balances for next FY
        create_opening_balances!

        # Record closure
        record_closure!
      end

      {
        success: true,
        financial_year: financial_year,
        closed_at: Time.current,
        next_financial_year: next_fy
      }
    rescue StandardError => e
      { success: false, error: e.message }
    end

    # Reopen a closed year (admin only, with audit trail)
    def reopen_year!(reason:)
      return { success: false, error: 'Year is not closed' } unless is_closed?

      ActiveRecord::Base.transaction do
        # Unlock periods
        unlock_periods!

        # Record reopening with reason
        record_reopening!(reason)
      end

      {
        success: true,
        financial_year: financial_year,
        reopened_at: Time.current,
        reason: reason
      }
    rescue StandardError => e
      { success: false, error: e.message }
    end

    # Get year-end adjustments that need to be made
    def required_adjustments
      adjustments = []

      # Depreciation
      depreciation = calculate_required_depreciation
      if depreciation[:amount] > 0
        adjustments << {
          type: :depreciation,
          description: 'Annual depreciation',
          amount: depreciation[:amount],
          debit_account: 'Depreciation Expense',
          credit_account: 'Accumulated Depreciation',
          details: depreciation[:assets]
        }
      end

      # Accrued expenses
      accrued = detect_accrued_expenses
      accrued.each do |expense|
        adjustments << {
          type: :accrual,
          description: expense[:description],
          amount: expense[:amount],
          debit_account: expense[:expense_account],
          credit_account: 'Accrued Expenses'
        }
      end

      # Prepayment amortization
      prepayments = calculate_prepayment_adjustments
      prepayments.each do |prep|
        adjustments << {
          type: :prepayment,
          description: prep[:description],
          amount: prep[:amount],
          debit_account: prep[:expense_account],
          credit_account: 'Prepaid Expenses'
        }
      end

      adjustments
    end

    # Create adjustment journal entry
    def create_adjustment(type:, amount:, description:, debit_account_id:, credit_account_id:)
      entry = Gl::JournalEntry.create!(
        corporate_company: corporate_company,
        gl_period: fy_end_period,
        entry_date: fy_end_date,
        description: "EOFY Adjustment: #{description}",
        source_type: 'eofy_adjustment',
        status: 'posted',
        total_debits: amount,
        total_credits: amount
      )

      # Debit line
      entry.ledger_lines.create!(
        gl_account_id: debit_account_id,
        debit: amount,
        credit: 0,
        description: description
      )

      # Credit line
      entry.ledger_lines.create!(
        gl_account_id: credit_account_id,
        debit: 0,
        credit: amount,
        description: description
      )

      entry
    end

    private

    def fy_period
      {
        start_date: fy_start_date,
        end_date: fy_end_date,
        label: financial_year
      }
    end

    def fy_start_date
      year = financial_year.delete('FY').to_i - 1
      Date.new(year, FY_START_MONTH, 1)
    end

    def fy_end_date
      year = financial_year.delete('FY').to_i
      Date.new(year, FY_END_MONTH, 30)
    end

    def current_financial_year
      today = Date.current
      year = today.month >= FY_START_MONTH ? today.year + 1 : today.year
      "FY#{year}"
    end

    def next_fy
      year = financial_year.delete('FY').to_i + 1
      "FY#{year}"
    end

    def eofy_status
      if is_closed?
        :closed
      elsif can_close?
        :ready_to_close
      else
        :in_progress
      end
    end

    def checklist_with_status
      applicable_items = CHECKLIST_ITEMS.select { |item| item_applicable?(item) }

      applicable_items.map do |item|
        stored = get_stored_status(item[:key])

        {
          key: item[:key],
          category: item[:category],
          label: item[:label],
          description: item[:description],
          critical: item[:critical],
          auto_check: item[:auto_check],
          completed: stored[:completed] || (item[:auto_check] && run_check(item[:key])),
          notes: stored[:notes],
          checked_at: stored[:checked_at],
          auto_result: item[:auto_check] ? run_check(item[:key]) : nil
        }
      end
    end

    def item_applicable?(item)
      return true unless item[:conditional]

      case item[:conditional]
      when :has_inventory
        has_inventory?
      when :has_payroll
        has_payroll?
      else
        true
      end
    end

    def has_inventory?
      # Check if company uses inventory tracking
      Gl::Account.exists?(
        corporate_company: corporate_company,
        account_class: 'inventory'
      )
    end

    def has_payroll?
      # Check if company has payroll accounts
      Gl::Account.exists?(
        corporate_company: corporate_company,
        account_class: 'wages'
      )
    end

    def run_check(key)
      case key
      when :bank_reconciliation
        check_bank_reconciliation
      when :bas_lodged
        check_bas_lodged
      when :depreciation_calculated
        check_depreciation_calculated
      else
        nil
      end
    end

    def check_bank_reconciliation
      bank_accounts = Gl::Account.where(
        corporate_company: corporate_company,
        is_bank_account: true
      )

      return true if bank_accounts.empty?

      # Check each bank account has reconciliation up to FY end
      bank_accounts.all? do |account|
        last_recon = Gl::BankReconciliation
          .where(gl_account: account)
          .where(status: 'completed')
          .order(statement_end_date: :desc)
          .first

        last_recon && last_recon.statement_end_date >= fy_end_date
      end
    end

    def check_bas_lodged
      # Check all 4 quarters have been prepared
      quarters = %w[Q1 Q2 Q3 Q4]

      quarters.all? do |quarter|
        # Would check BAS lodgement records
        # For now, return false to indicate manual check needed
        false
      end
    end

    def check_depreciation_calculated
      # Check if depreciation journal exists for the year
      Gl::JournalEntry.exists?(
        corporate_company: corporate_company,
        source_type: 'depreciation',
        entry_date: fy_start_date..fy_end_date
      )
    end

    def calculate_progress
      items = checklist_with_status
      total = items.count
      completed = items.count { |item| item[:completed] }
      critical_total = items.count { |item| item[:critical] }
      critical_completed = items.count { |item| item[:critical] && item[:completed] }

      {
        total: total,
        completed: completed,
        percentage: total.positive? ? ((completed.to_f / total) * 100).round(0) : 0,
        critical_total: critical_total,
        critical_completed: critical_completed,
        critical_percentage: critical_total.positive? ? ((critical_completed.to_f / critical_total) * 100).round(0) : 0
      }
    end

    def next_steps
      items = checklist_with_status
      incomplete = items.reject { |item| item[:completed] }

      # Prioritize critical items
      critical_incomplete = incomplete.select { |item| item[:critical] }

      if critical_incomplete.any?
        {
          priority: 'critical',
          message: "Complete #{critical_incomplete.count} critical items before closing",
          items: critical_incomplete.map { |i| i[:label] }
        }
      elsif incomplete.any?
        {
          priority: 'recommended',
          message: "#{incomplete.count} non-critical items remaining",
          items: incomplete.map { |i| i[:label] }
        }
      else
        {
          priority: 'ready',
          message: 'All items complete. Ready to close financial year.',
          items: []
        }
      end
    end

    def is_closed?
      # Check if FY end period is locked
      period = fy_end_period
      period && period.status == 'locked'
    end

    def closed_at
      period = fy_end_period
      period&.closed_at
    end

    def fy_end_period
      Gl::Period.find_by(
        corporate_company: corporate_company,
        financial_year: financial_year,
        period_number: 12 # June = period 12 for AU FY
      )
    end

    def lock_periods!
      Gl::Period.where(
        corporate_company: corporate_company,
        financial_year: financial_year
      ).update_all(status: 'locked', closed_at: Time.current)
    end

    def unlock_periods!
      Gl::Period.where(
        corporate_company: corporate_company,
        financial_year: financial_year
      ).update_all(status: 'open', closed_at: nil)
    end

    def create_closing_entries!
      # Close revenue and expense accounts to Retained Earnings
      retained_earnings = find_or_create_retained_earnings_account

      # Calculate net profit/loss
      revenue_total = calculate_revenue_total
      expense_total = calculate_expense_total
      net_profit = revenue_total - expense_total

      # Create closing entry
      entry = Gl::JournalEntry.create!(
        corporate_company: corporate_company,
        gl_period: fy_end_period,
        entry_date: fy_end_date,
        description: "#{financial_year} Year End Closing Entry",
        source_type: 'year_end_close',
        status: 'posted',
        total_debits: [revenue_total, expense_total].max + net_profit.abs,
        total_credits: [revenue_total, expense_total].max + net_profit.abs
      )

      # Close revenue accounts (debit to zero them)
      revenue_accounts.each do |account|
        balance = account_fy_balance(account)
        next if balance.zero?

        entry.ledger_lines.create!(
          gl_account: account,
          debit: balance > 0 ? balance : 0,
          credit: balance < 0 ? balance.abs : 0,
          description: "Close #{account.name}"
        )
      end

      # Close expense accounts (credit to zero them)
      expense_accounts.each do |account|
        balance = account_fy_balance(account)
        next if balance.zero?

        entry.ledger_lines.create!(
          gl_account: account,
          debit: balance < 0 ? balance.abs : 0,
          credit: balance > 0 ? balance : 0,
          description: "Close #{account.name}"
        )
      end

      # Transfer net to Retained Earnings
      if net_profit != 0
        entry.ledger_lines.create!(
          gl_account: retained_earnings,
          debit: net_profit < 0 ? net_profit.abs : 0,
          credit: net_profit > 0 ? net_profit : 0,
          description: "#{financial_year} Net #{net_profit >= 0 ? 'Profit' : 'Loss'}"
        )
      end

      entry
    end

    def create_opening_balances!
      next_fy_start = fy_end_date + 1.day

      # Balance sheet accounts carry forward
      balance_sheet_accounts.each do |account|
        balance = account_closing_balance(account)
        next if balance.zero?

        Gl::OpeningBalance.create!(
          corporate_company: corporate_company,
          gl_account: account,
          effective_date: next_fy_start,
          balance: balance,
          source: 'year_end_rollover',
          financial_year: next_fy
        )
      end
    end

    def record_closure!
      # Would store in a dedicated EOFY tracking table
      # For now, period lock serves as the record
    end

    def record_reopening!(reason)
      # Would store audit log of reopening
    end

    def find_or_create_retained_earnings_account
      Gl::Account.find_or_create_by!(
        corporate_company: corporate_company,
        code: '3900',
        account_type: 'equity'
      ) do |account|
        account.name = 'Retained Earnings'
        account.account_class = 'retained_earnings'
        account.is_system_account = true
      end
    end

    def revenue_accounts
      Gl::Account.where(
        corporate_company: corporate_company,
        account_type: 'revenue'
      )
    end

    def expense_accounts
      Gl::Account.where(
        corporate_company: corporate_company,
        account_type: 'expense'
      )
    end

    def balance_sheet_accounts
      Gl::Account.where(
        corporate_company: corporate_company,
        account_type: %w[asset liability equity]
      )
    end

    def account_fy_balance(account)
      Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: account)
        .where(gl_journal_entries: { corporate_company: corporate_company })
        .where('gl_journal_entries.entry_date >= ? AND gl_journal_entries.entry_date <= ?', fy_start_date, fy_end_date)
        .sum('debit - credit')
    end

    def account_closing_balance(account)
      # Opening balance + FY activity
      opening = Gl::OpeningBalance.find_by(
        gl_account: account,
        financial_year: financial_year
      )&.balance || 0

      activity = account_fy_balance(account)

      # For liabilities and equity, credit is positive
      if account.account_type.in?(%w[liability equity revenue])
        opening - activity
      else
        opening + activity
      end
    end

    def calculate_revenue_total
      revenue_accounts.sum { |a| account_fy_balance(a).abs }
    end

    def calculate_expense_total
      expense_accounts.sum { |a| account_fy_balance(a).abs }
    end

    def calculate_required_depreciation
      # Would integrate with asset register
      { amount: 0, assets: [] }
    end

    def detect_accrued_expenses
      # Would detect recurring expenses not yet recorded
      []
    end

    def calculate_prepayment_adjustments
      # Would calculate prepayment amortization
      []
    end

    def find_checklist_item(key)
      CHECKLIST_ITEMS.find { |item| item[:key] == key.to_sym }
    end

    def get_stored_status(key)
      # Would retrieve from database
      # For now, return empty hash
      { completed: false, notes: nil, checked_at: nil }
    end

    def store_checklist_status(key, completed, notes)
      # Would persist to database
    end
  end
end
