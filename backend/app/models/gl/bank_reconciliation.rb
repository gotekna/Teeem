# frozen_string_literal: true

module Gl
  class BankReconciliation < ApplicationRecord
    self.table_name = 'gl_bank_reconciliations'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :corporate, foreign_key: "company_id"
    belongs_to :gl_account, class_name: 'Gl::Account'
    belongs_to :completed_by, class_name: 'User', optional: true

    has_many :lines, class_name: 'Gl::ReconciliationLine',
             foreign_key: 'gl_bank_reconciliation_id', dependent: :destroy

    # ═══════════════════════════════════════════════════════════════
    # CONSTANTS
    # ═══════════════════════════════════════════════════════════════
    STATUSES = %w[in_progress completed locked].freeze

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :statement_date, presence: true
    validates :statement_closing_balance, presence: true
    validates :status, presence: true, inclusion: { in: STATUSES }
    validate :account_must_be_bank_account

    # ═══════════════════════════════════════════════════════════════
    # CALLBACKS
    # ═══════════════════════════════════════════════════════════════
    before_save :calculate_difference
    before_save :update_stats

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :in_progress, -> { where(status: 'in_progress') }
    scope :completed, -> { where(status: 'completed') }
    scope :locked, -> { where(status: 'locked') }
    scope :for_account, ->(account_id) { where(gl_account_id: account_id) }
    scope :recent, -> { order(statement_date: :desc) }

    # ═══════════════════════════════════════════════════════════════
    # CLASS METHODS
    # ═══════════════════════════════════════════════════════════════
    class << self
      # Start a new reconciliation for an account
      def start_for_account(account, statement_date:, statement_closing_balance:, statement_opening_balance: nil)
        # Check for existing in-progress reconciliation
        existing = in_progress.for_account(account.id).first
        return existing if existing

        # Get GL balances
        calculator = Gl::BalanceCalculator.new(
          account.corporate,
          provider: account.external_provider,
          tenant_id: account.external_tenant_id
        )

        # Determine period
        previous_recon = completed.for_account(account.id).recent.first
        period_start = previous_recon&.statement_date&.+ 1.day || account.created_at.to_date

        create!(
          corporate: account.corporate,
          gl_account: account,
          external_provider: account.external_provider,
          external_tenant_id: account.external_tenant_id,
          statement_date: statement_date,
          period_start: period_start,
          period_end: statement_date,
          statement_opening_balance: statement_opening_balance,
          statement_closing_balance: statement_closing_balance,
          gl_opening_balance: calculator.balance_at(account, period_start - 1.day),
          gl_closing_balance: calculator.balance_at(account, statement_date),
          status: 'in_progress'
        )
      end

      # Get last completed reconciliation for an account
      def last_completed_for(account)
        completed.for_account(account.id).recent.first
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Status
    # ═══════════════════════════════════════════════════════════════
    def in_progress?
      status == 'in_progress'
    end

    def completed?
      status == 'completed'
    end

    def locked?
      status == 'locked'
    end

    def can_edit?
      in_progress?
    end

    def can_complete?
      in_progress? && reconciled?
    end

    def reconciled?
      difference.abs < 0.01  # Within 1 cent
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Actions
    # ═══════════════════════════════════════════════════════════════
    def complete!(user = nil)
      return false unless can_complete?

      update!(
        status: 'completed',
        completed_at: Time.current,
        completed_by: user,
        reconciled_balance: statement_closing_balance
      )

      # Update account's last reconciled balance
      gl_account.update!(
        # Could add reconciled_balance and reconciled_date to gl_accounts if needed
      )

      true
    end

    def lock!
      return false unless completed?

      update!(status: 'locked')
      true
    end

    def reopen!
      return false if locked?

      update!(
        status: 'in_progress',
        completed_at: nil,
        completed_by: nil
      )
      true
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Lines
    # ═══════════════════════════════════════════════════════════════
    def matched_lines
      lines.where(status: 'matched')
    end

    def unmatched_lines
      lines.where(status: 'unmatched')
    end

    def excluded_lines
      lines.where(status: 'excluded')
    end

    def adjustment_lines
      lines.where(status: 'adjustment')
    end

    # Load unreconciled GL transactions for this account/period
    def load_gl_transactions
      return unless in_progress?

      # Get ledger lines for this bank account in the period
      ledger_lines = Gl::LedgerLine
        .joins(:gl_journal_entry)
        .where(gl_account: gl_account)
        .where(gl_journal_entries: { entry_date: period_start..period_end })
        .where.not(id: lines.where.not(gl_ledger_line_id: nil).select(:gl_ledger_line_id))

      ledger_lines.find_each do |line|
        lines.create!(
          gl_ledger_line: line,
          transaction_date: line.gl_journal_entry.entry_date,
          description: line.description || line.gl_journal_entry.description,
          amount: line.debit - line.credit,
          reference: line.reference,
          status: 'unmatched'
        )
      end
    end

    # Import statement transactions (from CSV, OFX, etc.)
    def import_statement_transactions(transactions)
      return unless in_progress?

      transactions.each do |tx|
        lines.create!(
          external_transaction_id: tx[:id],
          transaction_date: tx[:date],
          description: tx[:description],
          amount: tx[:amount],
          reference: tx[:reference],
          status: 'unmatched'
        )
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Matching
    # ═══════════════════════════════════════════════════════════════
    def run_auto_match!
      return unless in_progress?

      matcher = Gl::ReconciliationMatcher.new(self)
      matcher.auto_match_all

      update_stats
      save!
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS - Display
    # ═══════════════════════════════════════════════════════════════
    def display_name
      "#{gl_account.name} - #{statement_date.strftime('%d %b %Y')}"
    end

    def status_badge
      case status
      when 'in_progress' then { text: 'In Progress', color: 'blue' }
      when 'completed' then { text: 'Completed', color: 'green' }
      when 'locked' then { text: 'Locked', color: 'gray' }
      else { text: status.titleize, color: 'gray' }
      end
    end

    def reconciliation_summary
      {
        statement_balance: statement_closing_balance,
        gl_balance: gl_closing_balance,
        reconciled_balance: reconciled_balance || calculated_reconciled_balance,
        difference: difference,
        reconciled: reconciled?,
        matched_count: matched_count,
        unmatched_count: unmatched_count,
        adjustment_count: adjustment_count
      }
    end

    private

    def account_must_be_bank_account
      return unless gl_account.present?
      return if gl_account.is_bank_account?

      errors.add(:gl_account, 'must be a bank account')
    end

    def calculate_difference
      self.reconciled_balance ||= calculated_reconciled_balance
      self.difference = statement_closing_balance - reconciled_balance
    end

    def calculated_reconciled_balance
      # GL closing balance + unmatched statement items - unmatched GL items
      gl_balance = gl_closing_balance || 0

      unmatched_statement = lines.where(status: 'unmatched', gl_ledger_line_id: nil).sum(:amount)
      unmatched_gl = lines.where(status: 'unmatched').where.not(gl_ledger_line_id: nil).sum(:amount)
      adjustments = lines.where(status: 'adjustment').sum(:amount)

      gl_balance + unmatched_statement - unmatched_gl + adjustments
    end

    def update_stats
      self.matched_count = lines.matched.count
      self.unmatched_count = lines.unmatched.count
      self.adjustment_count = lines.adjustment.count
    end
  end
end
