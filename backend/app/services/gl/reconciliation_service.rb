# frozen_string_literal: true

module Gl
  # Reconciliation Service
  # Wraps reconciliation functionality for bank account reconciliation
  class ReconciliationService
    attr_reader :company, :account, :as_at_date

    def initialize(company, account = nil, as_at_date: nil)
      @company = company
      @account = account
      @as_at_date = as_at_date || Date.current
    end

    # Get matcher for auto-matching
    def matcher
      @matcher ||= ReconciliationMatcher.new(company)
    end

    # Create a new reconciliation
    def create_reconciliation(account:, statement_date:, statement_balance:)
      {
        account_id: account.id,
        statement_date: statement_date,
        statement_balance: statement_balance,
        gl_balance: calculate_gl_balance(account, statement_date),
        status: 'in_progress',
        created_at: Time.current
      }
    end

    # Get unreconciled transactions for an account
    def unreconciled_transactions(account, limit: 100)
      Gl::LedgerLine.joins(:gl_journal_entry)
                    .where(gl_account: account)
                    .where(reconciled: [nil, false])
                    .order('gl_journal_entries.entry_date DESC')
                    .limit(limit)
                    .map { |line| transaction_to_hash(line) }
    end

    # Auto-match transactions
    def auto_match(reconciliation_id)
      matcher.find_matches(account)
    end

    # Mark transaction as reconciled
    def reconcile_transaction(line_id)
      line = Gl::LedgerLine.find(line_id)
      line.update(reconciled: true, reconciled_at: Time.current)
      { success: true, line_id: line_id }
    end

    # Complete reconciliation
    def complete_reconciliation(reconciliation_id)
      {
        success: true,
        reconciliation_id: reconciliation_id,
        completed_at: Time.current
      }
    end

    # Get reconciliation status
    def status(account)
      unreconciled = unreconciled_transactions(account).count
      last_reconciled = last_reconciled_date(account)

      {
        account_id: account.id,
        account_name: account.name,
        unreconciled_count: unreconciled,
        last_reconciled: last_reconciled,
        status: unreconciled.zero? ? 'reconciled' : 'pending'
      }
    end

    private

    def calculate_gl_balance(account, as_at_date)
      Gl::LedgerLine.joins(:gl_journal_entry)
                    .where(gl_account: account)
                    .where('gl_journal_entries.entry_date <= ?', as_at_date)
                    .sum('debit - credit')
    end

    def last_reconciled_date(account)
      Gl::LedgerLine.where(gl_account: account, reconciled: true)
                    .maximum(:reconciled_at)&.to_date
    end

    def transaction_to_hash(line)
      {
        id: line.id,
        date: line.gl_journal_entry.entry_date,
        description: line.description || line.gl_journal_entry.description,
        debit: line.debit,
        credit: line.credit,
        amount: line.debit - line.credit,
        reference: line.reference
      }
    end
  end
end
