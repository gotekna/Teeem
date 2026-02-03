# frozen_string_literal: true

module Gl
  module Reports
    # Bank Statement Report
    #
    # Generates a bank statement with running balance for any date range.
    # This is THE IMMEDIATE WIN - accurate historical running balances.
    #
    # Usage:
    #   report = Gl::Reports::BankStatement.new(corporate, provider: 'xero', tenant_id: 'abc')
    #   result = report.generate(account: bank_account, from_date: 30.days.ago, to_date: Date.current)
    #
    class BankStatement
      attr_reader :corporate, :external_provider, :external_tenant_id

      def initialize(corporate, provider: nil, tenant_id: nil)
        @corporate = corporate
        @external_provider = provider
        @external_tenant_id = tenant_id
      end

      # Generate bank statement for an account
      def generate(account:, from_date:, to_date:)
        unless account.is_bank_account
          raise ArgumentError, "Account #{account.code} is not a bank account"
        end

        calculator = Gl::BalanceCalculator.new(
          corporate,
          provider: external_provider,
          tenant_id: external_tenant_id
        )

        # Get running balance transactions
        transactions = calculator.running_balance(account, from_date, to_date)

        # Calculate totals
        deposits = transactions.sum { |t| t[:credit] || 0 }
        withdrawals = transactions.sum { |t| t[:debit] || 0 }
        opening_balance = transactions.first&.dig(:balance) || 0
        closing_balance = transactions.last&.dig(:balance) || 0

        {
          report_type: 'bank_statement',
          account: {
            id: account.id,
            code: account.code,
            name: account.name,
            currency: account.currency_code
          },
          from_date: from_date,
          to_date: to_date,
          generated_at: Time.current,
          provider: external_provider,
          tenant_id: external_tenant_id,

          # Summary
          summary: {
            opening_balance: opening_balance,
            total_deposits: deposits,
            total_withdrawals: withdrawals,
            net_movement: deposits - withdrawals,
            closing_balance: closing_balance,
            transaction_count: transactions.count - 1 # Exclude opening balance row
          },

          # Transactions with running balance
          transactions: transactions.drop(1), # Drop opening balance row

          # Daily summary (optional grouping)
          daily_summary: group_by_day(transactions.drop(1))
        }
      end

      # Generate statement for all bank accounts
      def generate_all(from_date:, to_date:)
        bank_accounts = scoped_accounts.where(is_bank_account: true).active.order(:code)

        accounts = bank_accounts.map do |account|
          statement = generate(account: account, from_date: from_date, to_date: to_date)
          {
            account: statement[:account],
            summary: statement[:summary]
          }
        end

        {
          report_type: 'bank_summary',
          from_date: from_date,
          to_date: to_date,
          generated_at: Time.current,
          accounts: accounts,
          totals: {
            total_deposits: accounts.sum { |a| a[:summary][:total_deposits] },
            total_withdrawals: accounts.sum { |a| a[:summary][:total_withdrawals] },
            combined_closing: accounts.sum { |a| a[:summary][:closing_balance] }
          }
        }
      end

      # Generate monthly statements for a bank account
      def generate_monthly(account:, financial_year:)
        periods = Gl::Period
          .where(corporate: corporate)
          .where(financial_year: financial_year)
          .order(:period_start)

        months = periods.map do |period|
          statement = generate(
            account: account,
            from_date: period.period_start,
            to_date: period.period_end
          )

          {
            period: period.period_name,
            period_number: period.period_number,
            from_date: period.period_start,
            to_date: period.period_end,
            opening_balance: statement[:summary][:opening_balance],
            deposits: statement[:summary][:total_deposits],
            withdrawals: statement[:summary][:total_withdrawals],
            closing_balance: statement[:summary][:closing_balance],
            transaction_count: statement[:summary][:transaction_count]
          }
        end

        {
          account: {
            id: account.id,
            code: account.code,
            name: account.name
          },
          financial_year: financial_year,
          months: months
        }
      end

      # Get balance at a specific point in time (quick lookup)
      def balance_at(account:, as_of_date:)
        calculator = Gl::BalanceCalculator.new(
          corporate,
          provider: external_provider,
          tenant_id: external_tenant_id
        )

        calculator.balance_at(account, as_of_date)
      end

      # Reconciliation helper - find unreconciled transactions
      def unreconciled_transactions(account:, as_of_date: Date.current)
        # This would integrate with bank feed reconciliation
        # For now, return all transactions that might need reconciliation
        transactions = Gl::LedgerLine
          .joins(:gl_journal_entry)
          .where(gl_account: account)
          .where(gl_journal_entries: { status: 'posted' })
          .where('gl_journal_entries.entry_date <= ?', as_of_date)
          .includes(:gl_journal_entry)
          .order('gl_journal_entries.entry_date DESC')
          .limit(100)

        transactions.map do |line|
          entry = line.gl_journal_entry
          {
            date: entry.entry_date,
            description: line.description || entry.description,
            reference: entry.source_number,
            source_type: entry.source_type,
            amount: line.debit.positive? ? -line.debit : line.credit,
            external_id: entry.external_source_id
          }
        end
      end

      private

      def group_by_day(transactions)
        transactions.group_by { |t| t[:date] }.transform_values do |day_txs|
          {
            deposits: day_txs.sum { |t| t[:credit] || 0 },
            withdrawals: day_txs.sum { |t| t[:debit] || 0 },
            net: day_txs.sum { |t| (t[:credit] || 0) - (t[:debit] || 0) },
            count: day_txs.count,
            closing_balance: day_txs.last[:balance]
          }
        end
      end

      def scoped_accounts
        scope = Gl::Account.where(corporate: corporate)
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
