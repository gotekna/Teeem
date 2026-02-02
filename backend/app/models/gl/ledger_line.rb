# frozen_string_literal: true

module Gl
  class LedgerLine < ApplicationRecord
    self.table_name = 'gl_ledger_lines'

    # ═══════════════════════════════════════════════════════════════
    # ASSOCIATIONS
    # ═══════════════════════════════════════════════════════════════
    belongs_to :gl_journal_entry, class_name: 'Gl::JournalEntry'
    belongs_to :gl_account, class_name: 'Gl::Account'
    belongs_to :job, optional: true
    belongs_to :contact, optional: true

    # Delegate to journal entry
    delegate :corporate, :entry_date, :gl_period, to: :gl_journal_entry
    delegate :account_type, :is_bank_account, to: :gl_account, prefix: :account

    # ═══════════════════════════════════════════════════════════════
    # VALIDATIONS
    # ═══════════════════════════════════════════════════════════════
    validates :debit, numericality: { greater_than_or_equal_to: 0 }
    validates :credit, numericality: { greater_than_or_equal_to: 0 }
    validates :tax_amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
    validate :debit_or_credit_not_both
    validate :debit_or_credit_required

    # ═══════════════════════════════════════════════════════════════
    # CALLBACKS
    # ═══════════════════════════════════════════════════════════════
    before_save :set_line_number
    after_save :update_running_balance, if: :account_is_bank_account

    # ═══════════════════════════════════════════════════════════════
    # SCOPES
    # ═══════════════════════════════════════════════════════════════
    scope :debits, -> { where('debit > 0') }
    scope :credits, -> { where('credit > 0') }
    scope :for_account, ->(account) { where(gl_account: account) }
    scope :for_job, ->(job) { where(job: job) }
    scope :for_contact, ->(contact) { where(contact: contact) }
    scope :ordered, -> { order(:line_number) }
    scope :posted, -> {
      joins(:gl_journal_entry).where(gl_journal_entries: { status: 'posted' })
    }
    scope :active, -> {
      joins(:gl_journal_entry).where.not(gl_journal_entries: { status: 'voided' })
    }

    # Date-based scopes (through journal entry)
    scope :for_date_range, ->(start_date, end_date) {
      joins(:gl_journal_entry).where(gl_journal_entries: { entry_date: start_date..end_date })
    }
    scope :before_date, ->(date) {
      joins(:gl_journal_entry).where('gl_journal_entries.entry_date < ?', date)
    }
    scope :on_or_before_date, ->(date) {
      joins(:gl_journal_entry).where('gl_journal_entries.entry_date <= ?', date)
    }

    # ═══════════════════════════════════════════════════════════════
    # INSTANCE METHODS
    # ═══════════════════════════════════════════════════════════════

    # Net amount (positive for debits, negative for credits)
    def net_amount
      debit - credit
    end

    # Absolute amount
    def amount
      [debit, credit].max
    end

    # Is this a debit line?
    def debit?
      debit > 0
    end

    # Is this a credit line?
    def credit?
      credit > 0
    end

    # Sign based on account type
    # For bank accounts: debits = money in, credits = money out
    # For expense accounts: debits = expense incurred
    # For revenue accounts: credits = revenue earned
    def signed_amount
      if gl_account.debit_normal?
        net_amount
      else
        -net_amount
      end
    end

    # Formatted amount for display
    def formatted_amount
      if debit?
        "+#{format('%.2f', debit)}"
      else
        "-#{format('%.2f', credit)}"
      end
    end

    # Full tracking info
    def tracking_info
      parts = []
      parts << "#{tracking_category_1}: #{tracking_option_1}" if tracking_category_1.present?
      parts << "#{tracking_category_2}: #{tracking_option_2}" if tracking_category_2.present?
      parts.join(' | ')
    end

    private

    def debit_or_credit_not_both
      return unless debit.to_f > 0 && credit.to_f > 0

      errors.add(:base, 'Cannot have both debit and credit on the same line')
    end

    def debit_or_credit_required
      return if debit.to_f > 0 || credit.to_f > 0

      errors.add(:base, 'Must have either a debit or credit amount')
    end

    def set_line_number
      return if line_number.present?

      max_line = gl_journal_entry.ledger_lines.maximum(:line_number) || 0
      self.line_number = max_line + 1
    end

    def update_running_balance
      # Running balance calculation is handled by the balance calculator service
      # This is just a placeholder for the callback
    end
  end
end
