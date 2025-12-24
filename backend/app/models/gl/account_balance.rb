# frozen_string_literal: true

module Gl
  class AccountBalance < ApplicationRecord
    self.table_name = 'gl_account_balances'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :gl_account, class_name: 'Gl::Account'
    belongs_to :gl_period, class_name: 'Gl::Period'

    # Delegate
    delegate :corporate_company, to: :gl_account
    delegate :account_type, :code, :name, to: :gl_account, prefix: :account
    delegate :financial_year, :period_number, :period_name, to: :gl_period, prefix: :period

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :gl_account_id, uniqueness: { scope: :gl_period_id }

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :for_account, ->(account) { where(gl_account: account) }
    scope :for_period, ->(period) { where(gl_period: period) }
    scope :for_financial_year, ->(fy) {
      joins(:gl_period).where(gl_periods: { financial_year: fy })
    }
    scope :with_movement, -> { where('net_movement != 0') }
    scope :calculated, -> { where.not(calculated_at: nil) }
    scope :stale, -> { where(calculated_at: nil) }
    scope :ordered_by_period, -> {
      joins(:gl_period).order('gl_periods.period_start')
    }

    # ═══════════════════════════════════════════════════════════════
    # CLASS METHODS
    # ═══════════════════════════════════════════════════════════════
    class << self
      # Find or create balance record for an account and period
      def for_account_and_period(account, period)
        find_or_create_by!(gl_account: account, gl_period: period)
      end

      # Get YTD balance for an account as of a period
      def ytd_balance_for(account, period)
        where(gl_account: account)
          .joins(:gl_period)
          .where(gl_periods: { financial_year: period.financial_year })
          .where('gl_periods.period_number <= ?', period.period_number)
          .sum(:net_movement)
      end
    end

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    # Recalculate this balance from ledger lines
    def recalculate!
      lines = Gl::LedgerLine
        .for_account(gl_account)
        .posted
        .joins(:gl_journal_entry)
        .where(gl_journal_entries: { gl_period_id: gl_period_id })

      self.period_debits = lines.sum(:debit)
      self.period_credits = lines.sum(:credit)
      self.transaction_count = lines.count

      # Net movement depends on account type
      if gl_account.debit_normal?
        self.net_movement = period_debits - period_credits
      else
        self.net_movement = period_credits - period_debits
      end

      # Get opening balance from previous period
      previous_balance = self.class
        .for_account(gl_account)
        .joins(:gl_period)
        .where('gl_periods.period_start < ?', gl_period.period_start)
        .order('gl_periods.period_start DESC')
        .first

      if previous_balance
        self.opening_balance = previous_balance.closing_balance
      else
        # Check for opening balance record
        ob = Gl::OpeningBalance
          .where(gl_account: gl_account)
          .where('effective_date <= ?', gl_period.period_start)
          .order(effective_date: :desc)
          .first
        self.opening_balance = ob&.balance || 0
      end

      self.closing_balance = opening_balance + net_movement

      # Calculate YTD
      self.ytd_debits = self.class
        .for_account(gl_account)
        .joins(:gl_period)
        .where(gl_periods: { financial_year: gl_period.financial_year })
        .where('gl_periods.period_number <= ?', gl_period.period_number)
        .sum(:period_debits)

      self.ytd_credits = self.class
        .for_account(gl_account)
        .joins(:gl_period)
        .where(gl_periods: { financial_year: gl_period.financial_year })
        .where('gl_periods.period_number <= ?', gl_period.period_number)
        .sum(:period_credits)

      if gl_account.debit_normal?
        self.ytd_balance = ytd_debits - ytd_credits
      else
        self.ytd_balance = ytd_credits - ytd_debits
      end

      self.calculated_at = Time.current
      save!
    end

    # Mark as needing recalculation
    def mark_stale!
      update!(calculated_at: nil)
    end

    # Is this balance stale?
    def stale?
      calculated_at.nil?
    end

    # Balance is positive in normal direction
    def in_credit?
      closing_balance > 0 && gl_account.credit_normal?
    end

    def in_debit?
      closing_balance > 0 && gl_account.debit_normal?
    end
  end
end
